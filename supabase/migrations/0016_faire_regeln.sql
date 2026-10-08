-- Showly 0016: faire Regeln für Storno, Absage, Reklamation, Mietschäden,
-- Bewertungen und Auszahlung (Regeln in src/showly/policies.ts)

-- 1. Stornostufe je Anbieter, Springer-Liste, Stornoquote ---------------------
alter table public.artists
  add column if not exists cancel_tier text not null default 'moderat'
    check (cancel_tier in ('flexibel', 'moderat', 'streng')),
  add column if not exists standby boolean not null default false,
  add column if not exists cancel_rate numeric(4,3) not null default 0;

comment on column public.artists.cancel_tier is
  'Stornostufe für neue Buchungen. Bestehende Buchungen behalten ihre gespeicherte Stufe (bookings.policy).';
comment on column public.artists.standby is
  'Springer-Liste: kurzfristig einspringen bei Ausfall eines anderen Künstlers, mit Bonus.';

-- 2. Buchung: gespeicherte Stornoregel, Umbuchung, Hinweis ohne Check-in ------
alter table public.bookings
  add column if not exists policy jsonb,
  add column if not exists rebooked_at timestamptz,
  add column if not exists rebooked_from date,
  add column if not exists checkin_alert_at timestamptz,
  add column if not exists replacements jsonb;

alter table public.shop_orders
  add column if not exists policy jsonb,
  add column if not exists carefree boolean not null default false,
  add column if not exists handover jsonb not null default '{}'::jsonb,
  add column if not exists damage jsonb,
  add column if not exists damage_reported_at timestamptz,
  add column if not exists deposit_released_at timestamptz;

comment on column public.shop_orders.handover is
  'Übergabeprotokoll: {"out": {"photos": [...], "at": ..., "confirmed_at": ...}, "back": {...}}';

-- 3. Auszahlung: Geschwindigkeit, Gebühr, eingefroren, Strafen verrechnet ------
alter table public.payouts
  add column if not exists speed text not null default 'standard'
    check (speed in ('standard', 'fast', 'express')),
  add column if not exists express_fee_cents integer not null default 0 check (express_fee_cents >= 0),
  add column if not exists frozen boolean not null default false,
  add column if not exists offset_cents integer not null default 0 check (offset_cents >= 0);

alter table public.penalties
  add column if not exists offset_cents integer not null default 0 check (offset_cents >= 0);

-- 4. Reklamationen ------------------------------------------------------------
create table if not exists public.complaints (
  id              bigserial primary key,
  booking_id      bigint references public.bookings(id) on delete cascade,
  shop_order_id   bigint references public.shop_orders(id) on delete cascade,
  sweet_request_id bigint references public.sweet_requests(id) on delete cascade,
  customer        uuid not null references public.profiles(id) on delete cascade,
  provider_owner  uuid references public.profiles(id) on delete set null,
  category        text not null check (category in ('late', 'short', 'different', 'rude', 'cake', 'item', 'damage')),
  body            text not null check (char_length(body) between 10 and 4000),
  evidence        jsonb not null default '[]'::jsonb,
  amount_cents    integer not null default 0,
  status          text not null default 'open'
    check (status in ('open', 'offer', 'agreed', 'escalated', 'decided', 'withdrawn')),
  statement       text,
  statement_at    timestamptz,
  statement_due   timestamptz not null,
  offer_cents     integer,
  offer_by        text check (offer_by in ('customer', 'provider')),
  refund_cents    integer,
  decision        text,
  decide_by       timestamptz not null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (booking_id is not null or shop_order_id is not null or sweet_request_id is not null)
);
create index if not exists complaints_customer_idx on public.complaints (customer);
create index if not exists complaints_provider_idx on public.complaints (provider_owner);
create unique index if not exists complaints_booking_once on public.complaints (booking_id) where booking_id is not null;

alter table public.complaints enable row level security;
drop policy if exists complaints_select_party on public.complaints;
create policy complaints_select_party on public.complaints
  for select using (customer = auth.uid() or provider_owner = auth.uid());
-- Schreiben nur über Serverfunktionen (Dienstschlüssel)

-- 5. Bewertungen: verifiziert, Teilnoten, Antwort, doppelt verdeckt -----------
alter table public.reviews
  add column if not exists booking_id bigint references public.bookings(id) on delete set null,
  add column if not exists verified boolean not null default false,
  add column if not exists sub jsonb not null default '{}'::jsonb,
  add column if not exists reply text check (char_length(reply) <= 2000),
  add column if not exists reply_at timestamptz,
  add column if not exists published_at timestamptz;

-- Bestehende Bewertungen bleiben sichtbar
update public.reviews set published_at = coalesce(published_at, created_at) where published_at is null;

create table if not exists public.guest_reviews (
  id           bigserial primary key,
  booking_id   bigint not null unique references public.bookings(id) on delete cascade,
  artist_id    bigint not null references public.artists(id) on delete cascade,
  customer     uuid not null references public.profiles(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  body         text check (char_length(body) <= 2000),
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.guest_reviews enable row level security;
drop policy if exists guest_reviews_select on public.guest_reviews;
create policy guest_reviews_select on public.guest_reviews
  for select using (
    published_at is not null and customer = auth.uid()
    or exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  );

-- Öffentlich nur veröffentlichte Bewertungen; die eigene sieht man immer
drop policy if exists reviews_select_all on public.reviews;
create policy reviews_select_all on public.reviews
  for select using (published_at is not null or author = auth.uid());

-- 6. Zähler: Schnitt nur aus veröffentlichten Bewertungen, Stornoquote --------
create or replace function public.refresh_artist_counts(aid bigint)
returns void
language sql
security definer set search_path = public
as $$
  update public.artists a set
    events_count = (
      select count(*) from public.bookings b
      where b.artist_id = aid
        and b.status in ('confirmed', 'completed')
        and b.checked_in_at is not null
    ),
    review_count = (select count(*) from public.reviews r where r.artist_id = aid and r.published_at is not null),
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r
                       where r.artist_id = aid and r.published_at is not null), 0),
    cancel_rate = coalesce((
      select round(
        count(*) filter (where b.cancelled_by = 'artist' or b.status::text = 'noshow')::numeric
        / nullif(count(*) filter (where b.status::text in ('confirmed', 'completed', 'noshow')
                                     or b.cancelled_by = 'artist'), 0), 3)
      from public.bookings b
      where b.artist_id = aid and b.created_at > now() - interval '12 months'
    ), 0)
  where a.id = aid
$$;
revoke all on function public.refresh_artist_counts(bigint) from public, anon, authenticated;

drop trigger if exists reviews_counts on public.reviews;
create trigger reviews_counts
  after insert or delete or update of rating, artist_id, published_at on public.reviews
  for each row execute function public.trg_reviews_counts();

drop trigger if exists bookings_counts on public.bookings;
create trigger bookings_counts
  after insert or delete or update of status, checked_in_at, artist_id, cancelled_by on public.bookings
  for each row execute function public.trg_bookings_counts();

-- 7. Öffentliche Sicht mit Stornostufe, Springer und Stornoquote --------------
create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business, media, work_hours, packages,
         cancel_tier, standby, cancel_rate
  from public.artists
  where published and not blocked;
grant select on public.artists_public to anon, authenticated;

-- 8. Nachweise (Fotos/Videos) für Reklamation und Übergabeprotokoll --------
-- Privat; Hochladen und Lesen nur über signierte Adressen vom Server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
