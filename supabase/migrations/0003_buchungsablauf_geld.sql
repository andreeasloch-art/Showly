-- ============================================================================
-- Showly · Teil 3: Buchungsablauf, Geld und Torten in der Datenbank
--
-- Bisher lagen Buchungen, Vertragsstrafen, Gutscheine, Auszahlungen,
-- Torten-Anfragen und Shop-Bestellungen nur im Browser. Damit Kunde und
-- Künstler dieselbe Buchung sehen, kommt alles hierher.
--
-- Grundregel: Lesen dürfen nur die Beteiligten. Geschrieben wird alles, was
-- Geld, Strafen oder den Status einer Buchung betrifft, ausschließlich vom
-- Server (mit dem Dienstschlüssel), nachdem er die Regeln aus den AGB geprüft
-- hat. Der Browser kann hier nichts direkt eintragen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kennungen: echte Künstlerprofile beginnen bei 100000
--
-- Die App kennt Künstler über eine Zahl. Die Beispielprofile im Katalog
-- haben kleine Zahlen. Damit sich echte Profile aus der Datenbank nie mit
-- ihnen überschneiden, fangen deren Kennungen weit oben an.
-- ---------------------------------------------------------------------------
do $$
begin
  if (select coalesce(max(id), 0) from public.artists) < 100000 then
    perform setval('public.artists_id_seq', 100000, false);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Buchungen: Felder für Absage, Check-in und Anzeige
-- ---------------------------------------------------------------------------
alter type public.booking_status add value if not exists 'noshow';

alter table public.bookings
  -- Buchung eines Beispielprofils aus dem Katalog (ohne Datensatz in artists)
  add column if not exists catalog_artist  integer,
  add column if not exists pkg             text,
  add column if not exists occasion        text,
  add column if not exists notes           text,
  add column if not exists address         text,
  add column if not exists customer_name   text,
  -- Zahlung autorisiert bzw. eingegangen
  add column if not exists paid            boolean not null default false,
  add column if not exists cancelled_by    text check (cancelled_by in ('customer', 'artist')),
  add column if not exists cancelled_at    timestamptz,
  -- Nachweis, dass der Künstler da war (AGB § 7 Abs. 6)
  add column if not exists checkin_code    text,
  add column if not exists checked_in_at   timestamptz,
  add column if not exists checked_in_by   text check (checked_in_by in ('artist', 'customer'));

create index if not exists bookings_catalog_artist_idx on public.bookings (catalog_artist);

comment on column public.bookings.checkin_code is
  'Vierstelliger Code, den der Kunde nennt und der Künstler vor Ort einträgt. '
  'Nur Kunde und gebuchter Künstler sehen die Buchung (Zugriffsregel).';

-- ---------------------------------------------------------------------------
-- 3. Vertragsstrafen (AGB § 9) mit Anhörung und Stufenmodell (§ 23)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.penalty_reason as enum ('late', 'noshow');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.penalty_status as enum ('hearing', 'due', 'proof', 'waived');
exception when duplicate_object then null; end $$;

create table if not exists public.penalties (
  id             bigserial primary key,
  booking_id     bigint not null unique references public.bookings(id) on delete cascade,
  artist_id      bigint references public.artists(id) on delete set null,
  amount_cents   integer not null check (amount_cents >= 0),
  reason         public.penalty_reason not null,
  status         public.penalty_status not null,
  -- Ende der 7-tägigen Anhörung bei gemeldetem Nichterscheinen
  hearing_until  timestamptz,
  -- ab hier fällig; zählt für das Stufenmodell (12 Monate)
  due_at         timestamptz,
  -- Stellungnahme des Künstlers bzw. Hinweis auf Nachweis
  statement      text check (char_length(statement) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists penalties_artist_idx on public.penalties (artist_id, status, due_at);

-- ---------------------------------------------------------------------------
-- 4. Gutscheine für Kunden (50 € nach später Absage oder Nichterscheinen)
-- ---------------------------------------------------------------------------
create table if not exists public.vouchers (
  code           text primary key check (code ~ '^[A-Z0-9-]{6,24}$'),
  owner          uuid references public.profiles(id) on delete cascade,
  booking_id     bigint unique references public.bookings(id) on delete set null,
  amount_cents   integer not null check (amount_cents > 0),
  valid_until    date not null,
  redeemed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists vouchers_owner_idx on public.vouchers (owner);

-- ---------------------------------------------------------------------------
-- 5. Auszahlungen an Künstler (AGB § 21): 5 Werktage nach dem Termin,
--    bei den ersten 5 Buchungen 20 % Einbehalt für 30 Tage
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.payout_status as enum ('scheduled', 'held', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.payouts (
  id                  bigserial primary key,
  artist_id           bigint references public.artists(id) on delete set null,
  booking_id          bigint not null unique references public.bookings(id) on delete cascade,
  gross_cents         integer not null check (gross_cents >= 0),
  fee_cents           integer not null default 0 check (fee_cents >= 0),
  net_cents           integer not null check (net_cents >= 0),
  reserve_cents       integer not null default 0 check (reserve_cents >= 0),
  reserve_until       date,
  payout_on           date not null,
  status              public.payout_status not null default 'scheduled',
  stripe_transfer_id  text,
  created_at          timestamptz not null default now()
);

create index if not exists payouts_artist_idx on public.payouts (artist_id, payout_on);

-- Auszahlungskonto: Stripe Connect verwaltet Bankdaten und Identität.
-- Showly speichert nur die Kontokennung von Stripe, nie eine IBAN.
-- Eigene Tabelle, damit niemand sie über sein Profil selbst ändern kann.
create table if not exists public.payout_accounts (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id  text not null unique,
  payouts_enabled    boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Torten & Süßes: Anfragen und Direktbuchungen
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.sweet_status as enum ('sent', 'confirmed', 'declined', 'booked', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.sweet_requests (
  id              bigserial primary key,
  customer        uuid references public.profiles(id) on delete set null,
  -- Anbieter aus dem Katalog; eigenes Konto folgt, sobald Bäcker sich anmelden
  baker_ref       integer not null,
  baker_owner     uuid references public.profiles(id) on delete set null,
  sweet_ref       integer not null,
  day             date not null,
  qty             integer not null check (qty between 1 and 5000),
  city            text check (char_length(city) <= 80),
  wishes          text check (char_length(wishes) <= 2000),
  customer_name   text,
  -- Festpreis (direkt) bzw. Richtpreis (Anfrage), in Cent
  price_cents     integer not null default 0 check (price_cents >= 0),
  direct          boolean not null default false,
  status          public.sweet_status not null default 'sent',
  stripe_session_id text,
  created_at      timestamptz not null default now()
);

create index if not exists sweet_requests_customer_idx on public.sweet_requests (customer);
create index if not exists sweet_requests_baker_idx on public.sweet_requests (baker_owner);

-- ---------------------------------------------------------------------------
-- 7. Shop-Bestellungen (Kostüme und Deko)
-- ---------------------------------------------------------------------------
create table if not exists public.shop_orders (
  id                bigserial primary key,
  customer          uuid references public.profiles(id) on delete set null,
  -- [{ "shopId": 3, "mode": "rent", "qty": 1, "price_cents": 2900 }]
  items             jsonb not null check (jsonb_typeof(items) = 'array'),
  total_cents       integer not null check (total_cents >= 0),
  status            text not null default 'paid'
                    check (status in ('paid', 'shipped', 'returned', 'cancelled')),
  ship_to           text,
  stripe_session_id text unique,
  created_at        timestamptz not null default now()
);

create index if not exists shop_orders_customer_idx on public.shop_orders (customer);

-- Eine bezahlte Checkout-Sitzung darf nur einmal eingetragen werden
create unique index if not exists sweet_requests_session_idx
  on public.sweet_requests (stripe_session_id, sweet_ref, day) where stripe_session_id is not null;

-- ============================================================================
-- Zugriffsregeln: nur lesen, und nur die Beteiligten
-- ============================================================================
alter table public.penalties        enable row level security;
alter table public.vouchers         enable row level security;
alter table public.payouts          enable row level security;
alter table public.payout_accounts  enable row level security;
alter table public.sweet_requests   enable row level security;
alter table public.shop_orders      enable row level security;

drop policy if exists penalties_select_artist on public.penalties;
create policy penalties_select_artist on public.penalties
  for select using (
    exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  );

drop policy if exists vouchers_select_own on public.vouchers;
create policy vouchers_select_own on public.vouchers
  for select using (owner = auth.uid());

drop policy if exists payouts_select_artist on public.payouts;
create policy payouts_select_artist on public.payouts
  for select using (
    exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  );

drop policy if exists payout_accounts_select_own on public.payout_accounts;
create policy payout_accounts_select_own on public.payout_accounts
  for select using (profile_id = auth.uid());

drop policy if exists sweet_requests_select_involved on public.sweet_requests;
create policy sweet_requests_select_involved on public.sweet_requests
  for select using (customer = auth.uid() or baker_owner = auth.uid());

drop policy if exists shop_orders_select_own on public.shop_orders;
create policy shop_orders_select_own on public.shop_orders
  for select using (customer = auth.uid());

-- ============================================================================
-- Öffentliche Künstlersicht: mit den Rechten der abfragenden Person
-- (Lovable hat die Sicht bereits so angelegt; hier festgehalten, damit die
-- Datei für sich allein stimmt.)
-- ============================================================================
create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate
  from public.artists
  where published;
