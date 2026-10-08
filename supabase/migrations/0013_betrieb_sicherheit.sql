-- Showly 0013: Zahlungen sicher verbuchen (Stripe-Webhook), Rückbuchungen,
-- Torten-Angaben (Allergene, Zutaten, Haltbarkeit, Tageskapazität),
-- Urlaub und Arbeitszeiten der Künstler, Verleih (Stückzahl, Puffer, Kaution).

-- ---------------------------------------------------------------------------
-- 1. Stripe-Webhook
-- ---------------------------------------------------------------------------
-- Warenkorb einer offenen Zahlung. Der Webhook verbucht damit die Zahlung,
-- auch wenn der Browser nach dem Bezahlen zugeht. Nach 2 Tagen gelöscht.
create table if not exists public.checkout_drafts (
  session_id   text primary key check (char_length(session_id) <= 200),
  customer     uuid not null references public.profiles(id) on delete cascade,
  environment  text not null check (environment in ('sandbox', 'live')),
  snapshot     jsonb not null,
  hold_key     text check (char_length(hold_key) <= 80),
  created_at   timestamptz not null default now()
);
create index if not exists checkout_drafts_created_idx on public.checkout_drafts (created_at);

-- Bereits verarbeitete Stripe-Nachrichten (Stripe wiederholt Nachrichten)
create table if not exists public.stripe_events (
  id           text primary key check (char_length(id) <= 100),
  type         text not null check (char_length(type) <= 100),
  received_at  timestamptz not null default now()
);

-- Rückbuchung (Chargeback) zur Bestellung
alter table public.orders add column if not exists dispute_status text
  check (dispute_status in ('open', 'won', 'lost'));

alter table public.checkout_drafts enable row level security;
alter table public.stripe_events   enable row level security;
-- keine Richtlinien: nur der Server (Dienstschlüssel) liest und schreibt


-- ---------------------------------------------------------------------------
-- 2. Arbeitszeiten und Urlaub der Künstler
-- ---------------------------------------------------------------------------
-- Wochenplan, z. B. {"1": [14, 20], "6": [10, 22]}: an diesen Wochentagen
-- (0 = Sonntag … 6 = Samstag) von 14 bis 20 Uhr buchbar; fehlender Tag =
-- frei. null = keine Einschränkung (wie bisher). Urlaub und einzelne freie
-- Tage sind Sperren mit slot = 'all' in public.availability (wie bisher).
alter table public.artists add column if not exists work_hours jsonb
  check (work_hours is null or jsonb_typeof(work_hours) = 'object');

-- claim_slots wie in 0012, zusätzlich mit Prüfung der Arbeitszeiten
create or replace function public.claim_slots(
  p_items jsonb,
  p_kind text,
  p_hold_key text default null,
  p_minutes integer default 15
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  it        jsonb;
  idx       integer;
  v_artist  bigint;
  v_day     date;
  v_slot    text;
  v_hours   integer;
  v_booking bigint;
  v_start   timestamptz;
  v_end     timestamptz;
  v_guard   tstzrange;
  v_reason  text;
  v_work    jsonb;
  v_entry   jsonb;
  v_h       integer;
begin
  if p_kind not in ('hold', 'booking') then
    raise exception 'kind';
  end if;
  begin
    -- Immer in derselben Reihenfolge (nach Künstler) sperren, damit sich
    -- zwei Kassen nie gegenseitig blockieren (Deadlock)
    for it, idx in
      select e.value, (e.ordinality - 1)::integer
      from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
      order by (e.value ->> 'artist_id')::bigint, e.ordinality
    loop
      v_artist  := (it ->> 'artist_id')::bigint;
      v_day     := (it ->> 'day')::date;
      v_slot    := it ->> 'slot';
      v_hours   := greatest(1, least(24, coalesce((it ->> 'hours')::integer, 2)));
      v_booking := nullif(it ->> 'booking_id', '')::bigint;
      v_start   := (v_day + v_slot::time) at time zone 'Europe/Berlin';
      v_end     := v_start + make_interval(hours => v_hours);
      v_guard   := tstzrange(v_start - interval '30 minutes', v_end + interval '30 minutes');

      -- Zeilensperre: alle Belegungen dieses Künstlers laufen nacheinander
      select work_hours into v_work from public.artists where id = v_artist for update;
      if not found then
        v_reason := 'unknown';
        raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
      end if;

      -- Abgelaufene Reservierungen geben den Termin frei
      delete from public.slot_claims
        where artist_id = v_artist and kind = 'hold' and expires_at < now();

      -- Eigene Reservierung aus der Kasse übernehmen
      if p_hold_key is not null then
        update public.slot_claims
          set kind = p_kind,
              booking_id = coalesce(v_booking, booking_id),
              expires_at = case when p_kind = 'hold' then now() + make_interval(mins => p_minutes) else null end
          where hold_key = p_hold_key and artist_id = v_artist and starts_at = v_start and ends_at = v_end
            and kind = 'hold';
        if found then
          continue;
        end if;
      end if;

      -- Arbeitszeiten des Künstlers (0013): Show muss ganz hineinpassen.
      -- Schlüssel wie in JavaScript getDay(): 0 = Sonntag … 6 = Samstag
      if v_work is not null and jsonb_typeof(v_work) = 'object' then
        v_entry := v_work -> (extract(dow from v_day)::integer)::text;
        v_h := extract(hour from v_slot::time)::integer;
        if v_entry is null or jsonb_typeof(v_entry) <> 'array'
           or v_h < (v_entry ->> 0)::integer
           or v_h + v_hours > (v_entry ->> 1)::integer then
          v_reason := 'hours';
          raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
        end if;
      end if;

      -- Vom Künstler gesperrte Stunden (ohne Fahrtzeit, wie im Kalender)
      if exists (
        select 1 from public.availability a
        where a.artist_id = v_artist and a.day = v_day and a.blocked
          and (a.slot = 'all'
               or (a.slot ~ '^\d{2}:\d{2}$'
                   and tstzrange((a.day + a.slot::time) at time zone 'Europe/Berlin',
                                 ((a.day + a.slot::time) at time zone 'Europe/Berlin') + interval '1 hour')
                       && tstzrange(v_start, v_end)))
      ) then
        v_reason := 'blocked';
        raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
      end if;

      -- Termine aus dem eigenen Kalender des Künstlers (Google, Apple,
      -- Outlook), mit einer Stunde Fahrtzeit davor und danach
      if exists (
        select 1 from public.external_busy x
        where x.artist_id = v_artist
          and tstzrange(x.starts_at - interval '1 hour', x.ends_at + interval '1 hour') && tstzrange(v_start, v_end)
      ) then
        v_reason := 'external';
        raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
      end if;

      begin
        insert into public.slot_claims
          (artist_id, day, slot, hours, starts_at, ends_at, guard, kind, hold_key, expires_at, booking_id)
        values
          (v_artist, v_day, v_slot, v_hours, v_start, v_end, v_guard, p_kind, p_hold_key,
           case when p_kind = 'hold' then now() + make_interval(mins => p_minutes) else null end,
           v_booking);
      exception when exclusion_violation or unique_violation then
        v_reason := 'busy';
        raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
      end;
    end loop;
  exception when sqlstate 'P0001' then
    -- Rollback dieses Blocks: keine einzige Belegung bleibt stehen
    get stacked diagnostics v_slot = pg_exception_detail, v_reason = pg_exception_hint;
    return jsonb_build_object('ok', false, 'index', v_slot::integer, 'reason', v_reason);
  end;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.claim_slots(jsonb, text, text, integer) from public, anon, authenticated;

-- Arbeitszeiten sind öffentlich, damit der Kalender sie Kunden anzeigt
create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business, media, work_hours
  from public.artists
  where published and not blocked;

-- ---------------------------------------------------------------------------
-- 3. Verleih: Stückzahl je Zeitraum, Puffer nach der Rückgabe, Kaution
-- ---------------------------------------------------------------------------
-- Jede Miete belegt einen Artikel (item_ref = provider_offers.id) vom
-- ersten Miettag bis zum letzten Tag des Puffers (until_day). An keinem Tag
-- dürfen mehr Stück belegt sein, als es gibt (stock). Während des Bezahlens
-- ist die Miete kurz reserviert (kind = 'hold'), wie Künstlertermine.
create table if not exists public.rental_claims (
  id             bigserial primary key,
  item_ref       bigint not null,
  from_day       date not null,
  until_day      date not null check (until_day >= from_day),
  qty            integer not null check (qty between 1 and 99),
  kind           text not null check (kind in ('hold', 'booking')),
  hold_key       text check (char_length(hold_key) <= 80),
  expires_at     timestamptz,
  shop_order_id  bigint references public.shop_orders(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists rental_claims_item_idx on public.rental_claims (item_ref, from_day, until_day);
create index if not exists rental_claims_hold_idx on public.rental_claims (hold_key) where hold_key is not null;
alter table public.rental_claims enable row level security;

-- Kaution und Rückgabe je Shop-Bestellung
alter table public.shop_orders add column if not exists deposit_cents integer not null default 0 check (deposit_cents >= 0);
alter table public.shop_orders add column if not exists deposit_refunded_cents integer not null default 0 check (deposit_refunded_cents >= 0);
alter table public.shop_orders add column if not exists returned_at timestamptz;
alter table public.shop_orders add column if not exists condition_note text check (char_length(condition_note) <= 2000);

-- Mietartikel belegen: alle oder keiner. p_items: [{item_ref, from, until, qty, stock}]
-- (stock rechnet der Server aus dem Angebot; die Funktion ist nur für ihn).
create or replace function public.claim_rentals(
  p_items jsonb,
  p_kind text,
  p_hold_key text default null,
  p_minutes integer default 15,
  p_order bigint default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  it      jsonb;
  idx     integer;
  v_item  bigint;
  v_from  date;
  v_until date;
  v_qty   integer;
  v_stock integer;
  v_used  integer;
  v_reason text;
begin
  if p_kind not in ('hold', 'booking') then
    raise exception 'kind';
  end if;
  begin
    for it, idx in
      select e.value, (e.ordinality - 1)::integer
      from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
      order by (e.value ->> 'item_ref')::bigint, e.ordinality
    loop
      v_item  := (it ->> 'item_ref')::bigint;
      v_from  := (it ->> 'from')::date;
      v_until := (it ->> 'until')::date;
      v_qty   := greatest(1, least(99, coalesce((it ->> 'qty')::integer, 1)));
      v_stock := greatest(1, coalesce((it ->> 'stock')::integer, 1));

      -- Sperre je Artikel: zwei Kassen prüfen denselben Artikel nacheinander
      perform pg_advisory_xact_lock(hashtextextended('rental:' || v_item::text, 0));

      delete from public.rental_claims where item_ref = v_item and kind = 'hold' and expires_at < now();

      if p_hold_key is not null then
        update public.rental_claims
          set kind = p_kind,
              shop_order_id = coalesce(p_order, shop_order_id),
              expires_at = case when p_kind = 'hold' then now() + make_interval(mins => p_minutes) else null end
          where hold_key = p_hold_key and item_ref = v_item and from_day = v_from and until_day = v_until and qty = v_qty
            and kind = 'hold';
        if found then
          continue;
        end if;
      end if;

      select coalesce(max(used), 0) into v_used
      from (
        select d, sum(c.qty) as used
        from generate_series(v_from, v_until, interval '1 day') as g(d)
        join public.rental_claims c on c.item_ref = v_item and g.d::date between c.from_day and c.until_day
        group by d
      ) s;

      if v_used + v_qty > v_stock then
        v_reason := 'busy';
        raise exception using errcode = 'P0001', message = 'claim', detail = idx::text, hint = v_reason;
      end if;

      insert into public.rental_claims (item_ref, from_day, until_day, qty, kind, hold_key, expires_at, shop_order_id)
      values (v_item, v_from, v_until, v_qty, p_kind, p_hold_key,
              case when p_kind = 'hold' then now() + make_interval(mins => p_minutes) else null end, p_order);
    end loop;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_reason = pg_exception_detail;
    return jsonb_build_object('ok', false, 'index', v_reason::integer, 'reason', 'busy');
  end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.claim_rentals(jsonb, text, text, integer, bigint) from public, anon, authenticated;

-- Reservierungen freigeben bzw. aufräumen: jetzt auch Mietartikel
create or replace function public.release_hold(p_hold_key text)
returns integer
language sql
security definer set search_path = public
as $$
  with d as (delete from public.slot_claims where hold_key = p_hold_key and kind = 'hold' returning 1),
       r as (delete from public.rental_claims where hold_key = p_hold_key and kind = 'hold' returning 1)
  select ((select count(*) from d) + (select count(*) from r))::integer
$$;
revoke all on function public.release_hold(text) from public, anon, authenticated;

create or replace function public.purge_slot_holds()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.slot_claims where kind = 'hold' and expires_at < now();
  delete from public.rental_claims where kind = 'hold' and expires_at < now();
  delete from public.rental_claims where until_day < current_date - 30;
  delete from public.external_busy where ends_at < now() - interval '1 day';
$$;
revoke all on function public.purge_slot_holds() from public, anon, authenticated;
