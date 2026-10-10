-- Locations: Räume, Säle, Restaurants und Freizeitanbieter für Feiern.
--
-- Eine Location ist ein Anbieter mit kind = 'location'; alle Angaben (Preise,
-- Pakete, Extras, Wochenplan, Kapazität) stehen in providers.data und werden
-- im Browser und auf dem Server gleich geprüft (src/showly/locations.ts).
-- Die genaue Adresse steht ebenfalls dort; öffentlich ist sie nicht, weil
-- die öffentliche Sicht sie herausnimmt.
--
-- Gebucht wird über venue_bookings. venue_reservieren prüft unter einer
-- Sperre je Location, dass zur gewählten Zeit (samt Reinigungspuffer) noch
-- ein Platz frei ist; Freizeitanbieter haben mehrere Partytische (parallel).

-- 1 --------------------------------------------------------------------------
alter table public.providers drop constraint if exists providers_kind_check;
alter table public.providers add constraint providers_kind_check check (kind in ('baker', 'deco', 'location'));

alter table public.sub_orders drop constraint if exists sub_orders_provider_kind_check;
alter table public.sub_orders add constraint sub_orders_provider_kind_check
  check (provider_kind in ('artist', 'baker', 'deco', 'location', 'showly'));

alter table public.provider_views drop constraint if exists provider_views_kind_check;
alter table public.provider_views add constraint provider_views_kind_check check (kind in ('artist', 'baker', 'deco', 'location'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check check (kind in ('artist', 'baker', 'deco', 'location'));

alter table public.fee_rules drop constraint if exists fee_rules_scope_check;
alter table public.fee_rules add constraint fee_rules_scope_check check (scope in ('category', 'artist', 'baker', 'deco', 'location'));

-- Öffentliche Sicht ohne Adresse der Location
create or replace view public.providers_public
  with (security_invoker = on) as
  select id, kind, (case when kind = 'location' then data - 'address' else data end) as data, created_at
  from public.providers
  where published and not blocked;

-- 2 --------------------------------------------------------------------------
create table if not exists public.venue_bookings (
  id                 bigserial primary key,
  customer           uuid references public.profiles(id) on delete set null,
  venue_id           bigint not null references public.providers(id) on delete restrict,
  owner              uuid references public.profiles(id) on delete set null,
  day                date not null,
  start              text not null check (start ~ '^\d{2}:\d{2}$'),
  hours              integer not null check (hours between 1 and 16),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  guests             integer not null check (guests between 1 and 2000),
  pkg                text check (char_length(pkg) <= 20),
  extras             jsonb not null default '[]',
  occasion           text check (char_length(occasion) <= 120),
  notes              text check (char_length(notes) <= 2000),
  customer_name      text check (char_length(customer_name) <= 120),
  amount_cents       integer not null default 0 check (amount_cents >= 0),
  fee_cents          integer not null default 0 check (fee_cents >= 0),
  payout_cents       integer not null default 0 check (payout_cents >= 0),
  deposit_cents      integer not null default 0 check (deposit_cents >= 0),
  -- Kaution: gehalten, zurückgezahlt oder (bei gemeldetem Schaden) einbehalten
  deposit_status     text not null default 'held' check (deposit_status in ('held', 'released', 'kept', 'none')),
  status             text not null default 'requested'
                     check (status in ('hold', 'requested', 'confirmed', 'declined', 'cancelled', 'completed')),
  hold_until         timestamptz,
  paid               boolean not null default false,
  stripe_session_id  text unique,
  sub_order_id       bigint references public.sub_orders(id) on delete set null,
  policy             jsonb,
  requested_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists venue_bookings_venue_day_idx on public.venue_bookings (venue_id, day);
create index if not exists venue_bookings_owner_idx on public.venue_bookings (owner);
create index if not exists venue_bookings_customer_idx on public.venue_bookings (customer);

alter table public.venue_bookings enable row level security;
drop policy if exists venue_bookings_select_party on public.venue_bookings;
create policy venue_bookings_select_party on public.venue_bookings
  for select using (customer = auth.uid() or owner = auth.uid());

-- 3 --------------------------------------------------------------------------
-- p: { venue_id, day, start, hours, parallel, buffer_min, booking: {...} }
-- Antwort: {"id": 12} oder {"error": "voll"}
create or replace function public.venue_reservieren(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_venue    bigint := (p->>'venue_id')::bigint;
  v_day      date := (p->>'day')::date;
  v_start    timestamptz := (v_day + (p->>'start')::time) at time zone 'Europe/Berlin';
  v_end      timestamptz := v_start + make_interval(hours => greatest(1, least(16, (p->>'hours')::int)));
  v_parallel integer := greatest(1, least(50, coalesce((p->>'parallel')::int, 1)));
  v_buffer   interval := make_interval(mins => greatest(0, least(600, coalesce((p->>'buffer_min')::int, 0))));
  b          jsonb := coalesce(p->'booking', '{}'::jsonb);
  v_busy     integer;
  v_id       bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('venue:' || v_venue, 0));
  select count(*) into v_busy
    from public.venue_bookings x
   where x.venue_id = v_venue
     and x.status in ('requested', 'confirmed', 'hold')
     and (x.status <> 'hold' or x.hold_until > now())
     and x.starts_at < v_end + v_buffer
     and v_start < x.ends_at + v_buffer;
  if v_busy >= v_parallel then
    return jsonb_build_object('error', 'voll');
  end if;
  insert into public.venue_bookings (
    customer, venue_id, owner, day, start, hours, starts_at, ends_at, guests, pkg, extras, occasion, notes,
    customer_name, amount_cents, fee_cents, payout_cents, deposit_cents, deposit_status, status, paid,
    stripe_session_id, sub_order_id, policy, requested_at
  ) values (
    nullif(b->>'customer', '')::uuid, v_venue, nullif(b->>'owner', '')::uuid, v_day, p->>'start',
    greatest(1, least(16, (p->>'hours')::int)), v_start, v_end,
    greatest(1, least(2000, coalesce((b->>'guests')::int, 1))), nullif(b->>'pkg', ''), coalesce(b->'extras', '[]'::jsonb),
    nullif(b->>'occasion', ''), nullif(b->>'notes', ''), nullif(b->>'customer_name', ''),
    coalesce((b->>'amount_cents')::int, 0), coalesce((b->>'fee_cents')::int, 0), coalesce((b->>'payout_cents')::int, 0),
    coalesce((b->>'deposit_cents')::int, 0),
    case when coalesce((b->>'deposit_cents')::int, 0) > 0 then 'held' else 'none' end,
    coalesce(nullif(b->>'status', ''), 'requested'), coalesce((b->>'paid')::boolean, false),
    nullif(b->>'stripe_session_id', ''), nullif(b->>'sub_order_id', '')::bigint, b->'policy',
    case when b->>'status' = 'requested' then now() else null end
  ) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function public.venue_reservieren(jsonb) from public, anon, authenticated;
grant execute on function public.venue_reservieren(jsonb) to service_role;
