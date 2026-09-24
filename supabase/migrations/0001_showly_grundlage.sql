-- ============================================================================
-- Showly: Datenbank-Grundlage
--
-- Aufbau: Supabase Postgres. Die Anmeldung selbst liegt in auth.users und wird
-- von Supabase verwaltet (Google, E-Mail-Code, SMS-Code). Diese Datei legt an,
-- was Showly darüber hinaus braucht, und stellt die Zugriffsregeln so ein,
-- dass niemand Daten sieht oder ändert, die ihm nicht gehören.
--
-- Grundsatz bei jeder Tabelle: Zeilenschutz an, dann ausdrücklich erlauben.
-- Ohne Regel gilt: kein Zugriff.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Konten
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'artist', 'planner', 'admin');

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  role          public.user_role not null default 'customer',
  display_name  text not null default '',
  email         text,
  phone         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Ein Datensatz je angemeldeter Person. Die Rolle entscheidet über Rechte und '
  'wird nur vom Server gesetzt, nie vom Browser.';

-- Beim ersten Anmelden automatisch ein Profil anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, display_name, avatar_url)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Künstlerprofile
-- ---------------------------------------------------------------------------
create table public.artists (
  id             bigserial primary key,
  owner          uuid not null references public.profiles(id) on delete cascade,
  cat            text not null,
  -- Mehrsprachige Felder als JSON: {"de": "...", "en": "...", "es": "..."}
  name           jsonb not null,
  loc            jsonb not null,
  descr          jsonb not null default '{}'::jsonb,
  tags           jsonb not null default '{}'::jsonb,
  langs          jsonb not null default '{}'::jsonb,
  includes       jsonb not null default '{}'::jsonb,
  specs          jsonb not null default '{}'::jsonb,
  -- Preis in Cent, damit nie gerundet werden muss
  price_cents    integer not null check (price_cents >= 0),
  color          text default '#F1EAFF',
  image_path     text,
  -- Wird nur nach bestandener Ausweisprüfung gesetzt, ausschließlich vom Server
  verified       boolean not null default false,
  superhost      boolean not null default false,
  published      boolean not null default false,
  rating         numeric(3,2) not null default 0,
  review_count   integer not null default 0,
  events_count   integer not null default 0,
  response_time  jsonb default '{}'::jsonb,
  response_rate  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index artists_owner_idx     on public.artists (owner);
create index artists_cat_idx       on public.artists (cat);
create index artists_published_idx on public.artists (published) where published;

comment on column public.artists.verified is
  'Nur der Server setzt dieses Feld, nach einer bestandenen Prüfung bei Stripe Identity.';

-- ---------------------------------------------------------------------------
-- 3. Verfügbarkeit und Buchungen
-- ---------------------------------------------------------------------------
create table public.availability (
  artist_id  bigint not null references public.artists(id) on delete cascade,
  day        date   not null,
  slot       text   not null,
  blocked    boolean not null default true,
  primary key (artist_id, day, slot)
);

create index availability_artist_day_idx on public.availability (artist_id, day);

create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');

create table public.bookings (
  id                bigserial primary key,
  customer          uuid   not null references public.profiles(id) on delete cascade,
  artist_id         bigint not null references public.artists(id) on delete restrict,
  day               date   not null,
  slot              text,
  hours             integer not null default 2 check (hours between 1 and 24),
  -- Beträge legt ausschließlich der Server fest, aus dem Preis des Profils
  amount_cents      integer not null check (amount_cents >= 0),
  fee_cents         integer not null default 0 check (fee_cents >= 0),
  payout_cents      integer not null default 0 check (payout_cents >= 0),
  status            public.booking_status not null default 'pending',
  figure            text,
  location          text,
  guests            integer,
  stripe_session_id text unique,
  created_at        timestamptz not null default now()
);

create index bookings_customer_idx on public.bookings (customer);
create index bookings_artist_idx   on public.bookings (artist_id);
create index bookings_day_idx      on public.bookings (day);

-- ---------------------------------------------------------------------------
-- 4. Bewertungen und Beiträge
-- ---------------------------------------------------------------------------
create table public.reviews (
  id         bigserial primary key,
  artist_id  bigint not null references public.artists(id) on delete cascade,
  author     uuid   not null references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text   not null check (char_length(body) between 10 and 4000),
  event_date date,
  media      jsonb  not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  -- Eine Bewertung je Person und Profil
  unique (artist_id, author)
);

create index reviews_artist_idx on public.reviews (artist_id);

create table public.posts (
  id         bigserial primary key,
  author     uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 10 and 5000),
  city       text,
  media      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx  on public.posts (author);

-- Markierte Acts an einem Beitrag
create table public.post_artists (
  post_id   bigint not null references public.posts(id) on delete cascade,
  artist_id bigint not null references public.artists(id) on delete cascade,
  primary key (post_id, artist_id)
);

create index post_artists_artist_idx on public.post_artists (artist_id);

create table public.post_likes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  profile_id uuid   not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table public.post_comments (
  id         bigserial primary key,
  post_id    bigint not null references public.posts(id) on delete cascade,
  author     uuid   not null references public.profiles(id) on delete cascade,
  body       text   not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on public.post_comments (post_id);

-- ---------------------------------------------------------------------------
-- 5. Ausweisprüfung
--    Hier liegen niemals Bilder oder Ausweisdaten, nur das Ergebnis und die
--    Vorgangsnummer beim Prüfdienst.
-- ---------------------------------------------------------------------------
create type public.verification_status as enum
  ('none', 'pending', 'processing', 'verified', 'failed', 'cancelled');

create table public.verifications (
  id                    bigserial primary key,
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  provider              text not null default 'stripe_identity',
  provider_session_id   text unique,
  status                public.verification_status not null default 'none',
  -- Grund einer Ablehnung, wie ihn der Dienst meldet. Kein Klartext aus dem Ausweis.
  failure_code          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index verifications_profile_idx on public.verifications (profile_id);

comment on table public.verifications is
  'Ergebnis der Ausweis- und Gesichtsprüfung. Ausweisbilder und biometrische '
  'Merkmale bleiben beim Prüfdienst und werden hier nie gespeichert.';

-- ============================================================================
-- Zugriffsregeln
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.artists       enable row level security;
alter table public.availability  enable row level security;
alter table public.bookings      enable row level security;
alter table public.reviews       enable row level security;
alter table public.posts         enable row level security;
alter table public.post_artists  enable row level security;
alter table public.post_likes    enable row level security;
alter table public.post_comments enable row level security;
alter table public.verifications enable row level security;

-- Profile: jeder sieht nur sich selbst, Anzeigename ändern erlaubt.
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Künstlerprofile: veröffentlichte sind für alle sichtbar, ändern nur der Besitzer.
create policy artists_select_published on public.artists
  for select using (published or owner = auth.uid());

create policy artists_insert_own on public.artists
  for insert with check (owner = auth.uid());

create policy artists_update_own on public.artists
  for update using (owner = auth.uid())
  with check (
    owner = auth.uid()
    -- Prüfsiegel und Veröffentlichung darf der Besitzer nicht selbst setzen
    and verified = (select verified from public.artists a where a.id = artists.id)
  );

-- Verfügbarkeit: öffentlich lesbar, pflegen nur der Besitzer des Profils.
create policy availability_select_all on public.availability
  for select using (true);

create policy availability_write_owner on public.availability
  for all using (
    exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  )
  with check (
    exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  );

-- Buchungen: sichtbar für Kundin und für den gebuchten Act. Anlegen und
-- Statuswechsel laufen über den Server, nicht über den Browser.
create policy bookings_select_involved on public.bookings
  for select using (
    customer = auth.uid()
    or exists (select 1 from public.artists a where a.id = artist_id and a.owner = auth.uid())
  );

-- Bewertungen: öffentlich lesbar, schreiben nur mit eigenem Konto und nur,
-- wenn es zu diesem Act eine abgeschlossene Buchung gibt.
create policy reviews_select_all on public.reviews
  for select using (true);

create policy reviews_insert_after_booking on public.reviews
  for insert with check (
    author = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.artist_id = reviews.artist_id
        and b.customer  = auth.uid()
        and b.status in ('confirmed', 'completed')
    )
  );

create policy reviews_update_own on public.reviews
  for update using (author = auth.uid()) with check (author = auth.uid());

create policy reviews_delete_own on public.reviews
  for delete using (author = auth.uid());

-- Beiträge: öffentlich lesbar, schreiben und löschen nur die eigene Person.
create policy posts_select_all on public.posts for select using (true);

create policy posts_insert_own on public.posts
  for insert with check (author = auth.uid());

create policy posts_update_own on public.posts
  for update using (author = auth.uid()) with check (author = auth.uid());

create policy posts_delete_own on public.posts
  for delete using (author = auth.uid());

create policy post_artists_select_all on public.post_artists for select using (true);

create policy post_artists_write_author on public.post_artists
  for all using (
    exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
  )
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
  );

create policy post_likes_select_all on public.post_likes for select using (true);

create policy post_likes_write_own on public.post_likes
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy post_comments_select_all on public.post_comments for select using (true);

create policy post_comments_insert_own on public.post_comments
  for insert with check (author = auth.uid());

create policy post_comments_delete_own on public.post_comments
  for delete using (author = auth.uid());

-- Prüfungen: nur die betroffene Person sieht ihren eigenen Stand.
-- Geschrieben wird ausschließlich vom Server mit dem Dienstschlüssel.
create policy verifications_select_own on public.verifications
  for select using (profile_id = auth.uid());

-- ============================================================================
-- Öffentliche Sicht auf Künstler, ohne Besitzerkennung
-- ============================================================================
create view public.artists_public as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate
  from public.artists
  where published;

comment on view public.artists_public is
  'Für die Katalogansicht. Enthält bewusst keine Besitzerkennung.';
