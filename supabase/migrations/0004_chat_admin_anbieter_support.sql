-- ============================================================================
-- Showly · Teil 4: Chat, Verwaltung, Anbieter-Konten, Hilfe, Fehlerprotokoll
-- und Schutz vor Missbrauch
--
-- Grundregel wie in Teil 3: Lesen dürfen nur die Beteiligten, geschrieben
-- wird über den Server, der vorher prüft (Kontaktdaten-Filter, Rolle,
-- Häufigkeit). Die Verwaltung (Rolle "admin") arbeitet ausschließlich über
-- Serverfunktionen, die die Rolle selbst nachprüfen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Verwaltung: wer Admin ist
--
-- E-Mail-Adressen in dieser Liste bekommen beim Anlegen des Profils die Rolle
-- "admin". Weitere Admins trägt man hier ein; die Rolle kann niemand über
-- sein Profil selbst setzen (Zugriffsregel profiles_update_own).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security;

create or replace function public.grant_admin_by_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is not null and exists (select 1 from public.admin_emails a where a.email = lower(new.email)) then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_grant_admin on public.profiles;
create trigger profiles_grant_admin
  before insert on public.profiles
  for each row execute function public.grant_admin_by_email();

-- ---------------------------------------------------------------------------
-- 2. Künstler sperren
-- Gesperrte Profile bleiben unsichtbar, auch wenn die Ausweisprüfung
-- bestanden ist.
-- ---------------------------------------------------------------------------
alter table public.artists
  add column if not exists blocked        boolean not null default false,
  add column if not exists blocked_reason text check (char_length(blocked_reason) <= 1000);

create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book
  from public.artists
  where published and not blocked;

-- ---------------------------------------------------------------------------
-- 3. Erstattungen an Kunden
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists refunded_cents integer not null default 0 check (refunded_cents >= 0),
  add column if not exists refunded_at    timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Anbieter-Konten für Konditoreien, private Bäcker und Deko-Anbieter
--
-- Kennungen ab 100000, damit sie sich nie mit den Beispielen im Katalog
-- überschneiden. Sichtbar werden Anbieter, wenn die Verwaltung sie
-- freischaltet (Nachweis Lebensmittelregistrierung bzw. Gewerbe).
-- ---------------------------------------------------------------------------
create sequence if not exists public.providers_id_seq start with 100000;
create sequence if not exists public.provider_offers_id_seq start with 100000;

create table if not exists public.providers (
  id          bigint primary key default nextval('public.providers_id_seq'),
  owner       uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('baker', 'deco')),
  -- Angaben wie im Katalog: Name, Stadt, Beschreibung, gewerblich/privat …
  data        jsonb not null check (jsonb_typeof(data) = 'object'),
  published   boolean not null default false,
  blocked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, kind)
);

create table if not exists public.provider_offers (
  id           bigint primary key default nextval('public.provider_offers_id_seq'),
  provider_id  bigint not null references public.providers(id) on delete cascade,
  kind         text not null check (kind in ('sweet', 'deco')),
  data         jsonb not null check (jsonb_typeof(data) = 'object'),
  -- Preis in Cent (Torte: je Einheit, Deko: Kauf bzw. Miete)
  price_cents  integer not null default 0 check (price_cents >= 0),
  rent_cents   integer not null default 0 check (rent_cents >= 0),
  direct       boolean not null default false,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists provider_offers_provider_idx on public.provider_offers (provider_id);

-- Öffentliche Sichten ohne Besitzerkennung
create or replace view public.providers_public
  with (security_invoker = on) as
  select id, kind, data, created_at
  from public.providers
  where published and not blocked;

create or replace view public.provider_offers_public
  with (security_invoker = on) as
  select o.id, o.provider_id, o.kind, o.data, o.price_cents, o.rent_cents, o.direct
  from public.provider_offers o
  join public.providers p on p.id = o.provider_id
  where o.published and p.published and not p.blocked;

-- Shop-Bestellungen: Deko-Anbieter sehen Bestellungen mit ihren Artikeln
alter table public.shop_orders
  add column if not exists provider_owners uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 5. Nachrichten zwischen Kunde und Anbieter
--
-- Je Buchung bzw. Torten-Anfrage ein Verlauf. Der Server prüft jede
-- Nachricht auf Kontaktdaten (AGB § 20 Abs. 4), bevor er sie speichert.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id                bigserial primary key,
  booking_id        bigint references public.bookings(id) on delete cascade,
  sweet_request_id  bigint references public.sweet_requests(id) on delete cascade,
  sender            uuid references public.profiles(id) on delete set null,
  sender_role       text not null check (sender_role in ('customer', 'provider', 'admin')),
  body              text not null check (char_length(body) between 1 and 2000),
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  check (num_nonnulls(booking_id, sweet_request_id) = 1)
);

create index if not exists messages_booking_idx on public.messages (booking_id, created_at);
create index if not exists messages_sweet_idx   on public.messages (sweet_request_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. Hilfe und Kontakt
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id           bigserial primary key,
  profile      uuid references public.profiles(id) on delete set null,
  email        text not null check (char_length(email) <= 200),
  name         text check (char_length(name) <= 120),
  topic        text not null check (topic in ('booking', 'payment', 'account', 'provider', 'report', 'other')),
  body         text not null check (char_length(body) between 5 and 4000),
  status       text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answer       text check (char_length(answer) <= 4000),
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at);

-- ---------------------------------------------------------------------------
-- 7. Fehlerprotokoll aus der App (nur für die Verwaltung lesbar)
-- ---------------------------------------------------------------------------
create table if not exists public.client_errors (
  id          bigserial primary key,
  profile     uuid references public.profiles(id) on delete set null,
  message     text not null check (char_length(message) <= 1000),
  stack       text check (char_length(stack) <= 8000),
  url         text check (char_length(url) <= 500),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Schutz vor Missbrauch: Zähler je Person und Aktion in einem Zeitfenster
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_bucket text, p_max integer, p_seconds integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
  n integer;
begin
  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  -- gelegentlich aufräumen
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return n <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ============================================================================
-- Zugriffsregeln
-- ============================================================================
alter table public.providers        enable row level security;
alter table public.provider_offers  enable row level security;
alter table public.messages         enable row level security;
alter table public.support_tickets  enable row level security;
alter table public.client_errors    enable row level security;

drop policy if exists providers_select on public.providers;
create policy providers_select on public.providers
  for select using ((published and not blocked) or owner = auth.uid());

drop policy if exists provider_offers_select on public.provider_offers;
create policy provider_offers_select on public.provider_offers
  for select using (
    exists (
      select 1 from public.providers p
      where p.id = provider_offers.provider_id
        and ((p.published and not p.blocked and provider_offers.published) or p.owner = auth.uid())
    )
  );

drop policy if exists messages_select_involved on public.messages;
create policy messages_select_involved on public.messages
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer = auth.uid()
             or exists (select 1 from public.artists a where a.id = b.artist_id and a.owner = auth.uid()))
    )
    or exists (
      select 1 from public.sweet_requests s
      where s.id = sweet_request_id and (s.customer = auth.uid() or s.baker_owner = auth.uid())
    )
  );

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (profile = auth.uid());

drop policy if exists shop_orders_select_own on public.shop_orders;
create policy shop_orders_select_own on public.shop_orders
  for select using (customer = auth.uid() or auth.uid() = any (provider_owners));
