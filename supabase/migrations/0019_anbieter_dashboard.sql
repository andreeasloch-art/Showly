-- Showly 0019: Anbieter-Dashboard
--  1. Wochenendzuschlag und Saisonpreise (showly/surcharges.ts), Urlaubsmodus
--  2. Aufrufe der Profile zählen (nur Zahlen je Tag, keine Personendaten)
--  3. Auszahlungen auch für Konditoreien und Deko-/Kostümanbieter
--     (Teilbestellungen), nicht nur für Künstler

-- 1 ---------------------------------------------------------------------------
alter table public.artists
  add column if not exists surcharges jsonb,
  add column if not exists away_from date,
  add column if not exists away_until date;

create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business, media, work_hours, packages,
         cancel_tier, standby, cancel_rate, surcharges, away_until
  from public.artists
  where published and not blocked;
grant select on public.artists_public to anon, authenticated;

-- 2 ---------------------------------------------------------------------------
create table if not exists public.provider_views (
  kind   text   not null check (kind in ('artist', 'baker', 'deco')),
  ref    bigint not null,
  day    date   not null,
  views  integer not null default 0,
  primary key (kind, ref, day)
);
alter table public.provider_views enable row level security;
-- Lesen und Schreiben nur über Serverfunktionen (Dienstschlüssel)

create or replace function public.bump_view(p_kind text, p_ref bigint)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.provider_views (kind, ref, day, views)
  values (p_kind, p_ref, (now() at time zone 'Europe/Berlin')::date, 1)
  on conflict (kind, ref, day) do update set views = provider_views.views + 1
$$;
revoke all on function public.bump_view(text, bigint) from public, anon, authenticated;
grant execute on function public.bump_view(text, bigint) to service_role;

-- 3 ---------------------------------------------------------------------------
alter table public.payouts alter column booking_id drop not null;
alter table public.payouts
  add column if not exists sub_order_id bigint unique references public.sub_orders(id) on delete cascade,
  add column if not exists owner uuid references public.profiles(id) on delete set null,
  add column if not exists kind text not null default 'artist' check (kind in ('artist', 'baker', 'deco'));
create index if not exists payouts_owner_idx on public.payouts (owner, payout_on);

-- Anbieter sehen ihre eigenen Auszahlungen (Künstler wie bisher über artist_id)
drop policy if exists payouts_select_owner on public.payouts;
create policy payouts_select_owner on public.payouts
  for select using (owner = auth.uid());
alter table public.payouts add column if not exists event_day date;
