-- Showly 0012: Doppelbuchungen verhindern, Termine beim Bezahlen reservieren,
-- Teilbestellungen pro Anbieter, externe Kalender (iCal)
--
-- 1. slot_claims: jede belegte Zeit eines Künstlers (Reservierung während
--    des Bezahlens oder Buchung) steht hier genau einmal. Eine Ausschluss-
--    Regel (EXCLUDE) der Datenbank verbietet, dass sich zwei Einträge
--    desselben Künstlers überschneiden. Der Zeitraum "guard" ist die Show
--    plus je 30 Minuten davor und danach: Zwei solche Zeiträume überschneiden
--    sich genau dann, wenn zwischen zwei Shows weniger als eine Stunde
--    Fahrtzeit liegt (gleiche Regel wie showly/schedule.ts).
-- 2. claim_slots(): belegt mehrere Termine in einer Transaktion. Vor dem
--    Prüfen sperrt sie die Zeile des Künstlers (SELECT … FOR UPDATE), damit
--    zwei gleichzeitige Kassen für denselben Künstler nacheinander statt
--    gleichzeitig prüfen. Klappt ein Termin nicht, wird nichts belegt.
-- 3. Reservierungen (kind = 'hold') laufen nach wenigen Minuten ab und
--    werden beim nächsten Zugriff und im täglichen Lauf gelöscht.
-- 4. orders / sub_orders: ein Warenkorb (ein Event) wird in Teilbestellungen
--    je Anbieter aufgeteilt (Künstler, Konditorei, Deko-Anbieter, Showly).
-- 5. calendar_feeds / external_busy / calendar_export: Kalender aus Google,
--    Apple oder Outlook (iCal) einlesen; gespeichert werden nur belegte
--    Zeiten, keine Titel oder Orte. Und ein eigener iCal-Feed je Künstler.

-- Supabase legt Erweiterungen im Schema "extensions" ab
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Belegte Zeiten
-- ---------------------------------------------------------------------------
create table if not exists public.slot_claims (
  id          bigserial primary key,
  artist_id   bigint not null references public.artists(id) on delete cascade,
  day         date not null,
  slot        text not null check (slot ~ '^\d{2}:\d{2}$'),
  hours       integer not null check (hours between 1 and 24),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  guard       tstzrange not null,
  kind        text not null check (kind in ('hold', 'booking')),
  hold_key    text check (char_length(hold_key) <= 80),
  expires_at  timestamptz,
  booking_id  bigint unique references public.bookings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (kind = 'booking' or expires_at is not null),
  constraint slot_claims_no_overlap exclude using gist (artist_id with =, guard with &&)
);

create index if not exists slot_claims_artist_day_idx on public.slot_claims (artist_id, day);
create index if not exists slot_claims_hold_idx on public.slot_claims (hold_key) where hold_key is not null;

alter table public.slot_claims enable row level security;
-- Keine Richtlinien: nur der Server (Service-Rolle) liest und schreibt.

-- ---------------------------------------------------------------------------
-- 5a. Externe Kalender (vor claim_slots, das sie prüft)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_feeds (
  id              bigserial primary key,
  artist_id       bigint not null references public.artists(id) on delete cascade,
  url             text not null check (char_length(url) between 12 and 2000),
  label           text check (char_length(label) <= 60),
  last_synced_at  timestamptz,
  last_error      text check (char_length(last_error) <= 300),
  events_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (artist_id, url)
);
alter table public.calendar_feeds enable row level security;

create table if not exists public.external_busy (
  id         bigserial primary key,
  feed_id    bigint not null references public.calendar_feeds(id) on delete cascade,
  artist_id  bigint not null references public.artists(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  all_day    boolean not null default false
);
create index if not exists external_busy_artist_idx on public.external_busy (artist_id, starts_at);
alter table public.external_busy enable row level security;

-- Geheimer Schlüssel für den eigenen iCal-Feed (nicht in artists, weil
-- veröffentlichte Profile öffentlich lesbar sind)
create table if not exists public.calendar_export (
  artist_id   bigint primary key references public.artists(id) on delete cascade,
  token       text not null unique check (char_length(token) between 24 and 80),
  created_at  timestamptz not null default now()
);
alter table public.calendar_export enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Termine belegen (alles oder nichts)
--
-- p_items: [{ "artist_id": 100001, "day": "2026-12-01", "slot": "14:00",
--             "hours": 2, "booking_id": 55 (optional) }]
-- p_kind:  'hold' (Reservierung, läuft nach p_minutes ab) oder 'booking'
-- p_hold_key: Schlüssel der Reservierung aus der Kasse. Bei 'booking' wird
--             eine noch gültige Reservierung mit diesem Schlüssel übernommen.
-- Antwort: {"ok": true} oder {"ok": false, "index": 0, "reason": "busy" |
--          "blocked" | "external" | "unknown"}
-- ---------------------------------------------------------------------------
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
      perform 1 from public.artists where id = v_artist for update;
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

-- Reservierung aufheben (Kasse abgebrochen)
create or replace function public.release_hold(p_hold_key text)
returns integer
language sql
security definer set search_path = public
as $$
  with d as (delete from public.slot_claims where hold_key = p_hold_key and kind = 'hold' returning 1)
  select count(*)::integer from d
$$;
revoke all on function public.release_hold(text) from public, anon, authenticated;

-- Abgelaufene Reservierungen und vergangene externe Termine aufräumen (täglicher Lauf)
create or replace function public.purge_slot_holds()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.slot_claims where kind = 'hold' and expires_at < now();
  delete from public.external_busy where ends_at < now() - interval '1 day';
$$;
revoke all on function public.purge_slot_holds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bestellung je Event, Teilbestellung je Anbieter
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                 bigserial primary key,
  customer           uuid references public.profiles(id) on delete set null,
  stripe_session_id  text unique,
  event_day          date,
  total_cents        integer not null default 0 check (total_cents >= 0),
  status             text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at         timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders (customer);

create table if not exists public.sub_orders (
  id              bigserial primary key,
  order_id        bigint not null references public.orders(id) on delete cascade,
  -- artist: Künstler · baker: Konditorei/Hobbybäcker · deco: Deko-Anbieter
  -- showly: Artikel aus dem Showly-Katalog (Kostüme, Katalog-Deko)
  provider_kind   text not null check (provider_kind in ('artist', 'baker', 'deco', 'showly')),
  provider_id     bigint,
  provider_owner  uuid references public.profiles(id) on delete set null,
  amount_cents    integer not null default 0 check (amount_cents >= 0),
  fee_cents       integer not null default 0 check (fee_cents >= 0),
  payout_cents    integer not null default 0 check (payout_cents >= 0),
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'requested', 'confirmed', 'declined', 'cancelled', 'refunded', 'fulfilled')),
  created_at      timestamptz not null default now(),
  unique nulls not distinct (order_id, provider_kind, provider_id)
);
create index if not exists sub_orders_order_idx on public.sub_orders (order_id);
create index if not exists sub_orders_owner_idx on public.sub_orders (provider_owner);

alter table public.bookings       add column if not exists sub_order_id bigint references public.sub_orders(id) on delete set null;
alter table public.sweet_requests add column if not exists sub_order_id bigint references public.sub_orders(id) on delete set null;
alter table public.shop_orders    add column if not exists sub_order_id bigint references public.sub_orders(id) on delete set null;

alter table public.orders     enable row level security;
alter table public.sub_orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (customer = auth.uid());

-- Kunde sieht alle Teilbestellungen seiner Bestellung, Anbieter nur die eigene
drop policy if exists sub_orders_select_party on public.sub_orders;
create policy sub_orders_select_party on public.sub_orders
  for select using (
    provider_owner = auth.uid()
    or exists (select 1 from public.orders o where o.id = sub_orders.order_id and o.customer = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Buchungsstatus → Belegung und Teilbestellung
-- ---------------------------------------------------------------------------
create or replace function public.trg_bookings_claims()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Abgesagt oder abgelehnt: Termin wird wieder frei
  if new.status::text in ('cancelled', 'declined') then
    delete from public.slot_claims where booking_id = new.id;
  end if;
  if new.sub_order_id is not null and new.status is distinct from old.status then
    update public.sub_orders
      set status = case new.status::text
                     when 'requested' then 'requested'
                     when 'pending'   then 'pending'
                     when 'confirmed' then 'confirmed'
                     when 'completed' then 'fulfilled'
                     when 'declined'  then 'declined'
                     when 'cancelled' then 'cancelled'
                     else status end
      where id = new.sub_order_id and provider_kind = 'artist';
  end if;
  return null;
end $$;

drop trigger if exists bookings_claims on public.bookings;
create trigger bookings_claims
  after update of status on public.bookings
  for each row execute function public.trg_bookings_claims();

-- Bestehende aktive Buchungen einmal eintragen (Überschneidungen werden übersprungen)
insert into public.slot_claims (artist_id, day, slot, hours, starts_at, ends_at, guard, kind, booking_id)
select b.artist_id, b.day, b.slot, b.hours,
       (b.day + b.slot::time) at time zone 'Europe/Berlin',
       ((b.day + b.slot::time) at time zone 'Europe/Berlin') + make_interval(hours => b.hours),
       tstzrange(((b.day + b.slot::time) at time zone 'Europe/Berlin') - interval '30 minutes',
                 ((b.day + b.slot::time) at time zone 'Europe/Berlin') + make_interval(hours => b.hours) + interval '30 minutes'),
       'booking', b.id
from public.bookings b
where b.artist_id is not null and b.slot ~ '^\d{2}:\d{2}$'
  and b.status::text in ('requested', 'pending', 'confirmed', 'completed')
  and b.day >= current_date
on conflict do nothing;
