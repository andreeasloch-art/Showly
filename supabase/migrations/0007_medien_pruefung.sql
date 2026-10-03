-- Fotos und Videos von Anbieterinnen und Anbietern, mit Freigabe durch das Team.
--
-- Ablauf: Die App prüft jede Datei zuerst im Browser auf Kontaktdaten
-- (Texterkennung, QR-Codes). Besteht sie, wird sie in den privaten
-- Speicher "medien" hochgeladen und hier mit Status "pending" eingetragen.
-- Öffentlich sichtbar wird sie erst, wenn die Verwaltung sie freigibt
-- ("approved"). Abgelehnte Dateien ("rejected") bekommen einen Grund, den
-- die Person in ihrer Profilbearbeitung sieht und per Mail erhält.
--
-- Die Dateien selbst sind nie direkt öffentlich: Die App bekommt vom Server
-- kurzlebige, signierte Adressen, und zwar nur für freigegebene Dateien,
-- für eigene Dateien der Person und für die Verwaltung (media.functions.ts).

-- Privater Speicherplatz; Ordner je Person: <user-id>/<datei>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medien', 'medien', false, 83886080,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

-- Hochladen und Löschen nur im eigenen Ordner; lesen nur die Eigentümerin
-- bzw. der Eigentümer selbst (alle anderen über signierte Adressen).
drop policy if exists medien_insert_own on storage.objects;
create policy medien_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists medien_select_own on storage.objects;
create policy medien_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'medien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists medien_delete_own on storage.objects;
create policy medien_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'medien' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  path         text not null unique,
  mime         text not null,
  bytes        integer not null check (bytes > 0),
  -- Sekunden, nur bei Videos
  duration     numeric(6, 2),
  ratio        numeric(6, 3),
  -- Ergebnis der automatischen Prüfung im Browser (zur Nachvollziehbarkeit)
  auto_check   jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason       text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists media_owner_idx on public.media (owner);
create index if not exists media_pending_idx on public.media (created_at) where status = 'pending';

alter table public.media enable row level security;

-- Lesen: eigene Einträge; Freigegebenes darf jede Person sehen.
drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select using (owner = auth.uid() or status = 'approved');

-- Anlegen und Ändern nur über den Server (media.functions.ts), damit niemand
-- den Status selbst auf "approved" setzen kann. Löschen darf die Person ihre
-- eigenen Einträge.
drop policy if exists media_delete_own on public.media;
create policy media_delete_own on public.media
  for delete using (owner = auth.uid());

-- Galerie eines Künstlerprofils: Liste von {id, kind, ratio}; die id zeigt
-- auf public.media. Gezeigt werden öffentlich nur freigegebene Einträge.
alter table public.artists add column if not exists media jsonb not null default '[]'::jsonb;

comment on table public.media is
  'Fotos und Videos von Anbietenden. Öffentlich erst nach Freigabe (status = approved). Datei im privaten Speicher "medien".';

-- Öffentliche Künstlersicht um die Galerie erweitern. Die Liste enthält nur
-- Kennungen; Adressen gibt der Server nur für freigegebene Dateien heraus.
create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business, media
  from public.artists
  where published and not blocked;
