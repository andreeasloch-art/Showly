-- ============================================================================
-- Showly · Erweiterung 2
--
--  1. Buchungsmodus: Künstler wählen "sofort buchbar" oder "erst anfragen".
--  2. Konto löschen: Buchungen bleiben anonymisiert erhalten, weil Rechnungen
--     und Buchungsbelege bis zu zehn Jahre aufbewahrt werden müssen
--     (§ 147 AO, § 257 HGB). Vorher hätte das Löschen eines Kontos alle
--     Buchungen der Person mitgelöscht, und bei Künstlern mit Buchungen wäre
--     es an "on delete restrict" gescheitert.
--  3. Melden und Blockieren von Beiträgen, Kommentaren, Bewertungen und
--     Profilen (App-Store-Pflicht, Art. 16 Digital Services Act).
--
-- Nach 0001_showly_grundlage.sql im SQL Editor ausführen.
-- ============================================================================

-- 1. Buchungsmodus -----------------------------------------------------------
alter type public.booking_status add value if not exists 'requested';
alter type public.booking_status add value if not exists 'declined';

alter table public.artists
  add column if not exists instant_book boolean not null default true;

comment on column public.artists.instant_book is
  'true: Kunden buchen freie Termine sofort verbindlich. false: jede Buchung '
  'kommt als Anfrage, die der Künstler innerhalb von 48 Stunden annimmt oder ablehnt.';

alter table public.bookings
  add column if not exists requested_at timestamptz;

-- Der Künstler beantwortet Anfragen über den Server (Statuswechsel auf
-- confirmed oder declined). Direkte Änderungen aus dem Browser bleiben wie
-- bisher gesperrt; es gibt dafür bewusst keine update-Regel.

-- 2. Konto löschen, Buchungen bleiben ---------------------------------------
alter table public.bookings alter column customer drop not null;
alter table public.bookings drop constraint if exists bookings_customer_fkey;
alter table public.bookings
  add constraint bookings_customer_fkey
  foreign key (customer) references public.profiles(id) on delete set null;

alter table public.bookings alter column artist_id drop not null;
alter table public.bookings drop constraint if exists bookings_artist_id_fkey;
alter table public.bookings
  add constraint bookings_artist_id_fkey
  foreign key (artist_id) references public.artists(id) on delete set null;

comment on column public.bookings.customer is
  'Leer, wenn das Kundenkonto gelöscht wurde. Die Buchung bleibt für die '
  'Buchhaltung erhalten, ohne Bezug zur Person.';

-- 3. Melden und Blockieren ---------------------------------------------------
create type public.report_target as enum ('post', 'comment', 'review', 'profile');
create type public.report_status as enum ('open', 'removed', 'kept');

create table public.reports (
  id          bigserial primary key,
  reporter    uuid references public.profiles(id) on delete set null,
  target_type public.report_target not null,
  target_id   text not null,
  reason      text not null check (char_length(reason) between 1 and 60),
  details     text check (char_length(details) <= 1000),
  status      public.report_status not null default 'open',
  -- Begründung der Entscheidung für die Betroffenen (Art. 17 DSA)
  decision    text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at);

create table public.blocks (
  blocker    uuid not null references public.profiles(id) on delete cascade,
  blocked    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.reports enable row level security;
alter table public.blocks  enable row level security;

-- Melden darf jede angemeldete Person, sehen nur die eigenen Meldungen.
-- Bearbeitet werden Meldungen im Supabase-Dashboard oder über den Server.
create policy reports_insert_own on public.reports
  for insert with check (reporter = auth.uid());
create policy reports_select_own on public.reports
  for select using (reporter = auth.uid());

-- Blockieren: jede Person verwaltet nur ihre eigene Liste.
create policy blocks_own on public.blocks
  for all using (blocker = auth.uid()) with check (blocker = auth.uid());
