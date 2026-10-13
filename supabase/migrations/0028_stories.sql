-- Stories wie bei Instagram: Künstler, Torten- und Deko-Anbieter und
-- Locations posten ein Foto oder Video mit kurzem Text. Es erscheint
-- 24 Stunden lang in der Leiste auf der Startseite.
--
-- Die Datei läuft durch denselben Weg wie jedes andere Foto (0007):
-- Prüfung auf Kontaktdaten im Browser, privater Speicher "medien",
-- Freigabe durch das Team. Die 24 Stunden beginnen erst mit der Freigabe;
-- das übernimmt der Auslöser unten, die Verwaltung muss nichts extra tun.
--
-- Gelesen und geschrieben wird nur über den Server (story.functions.ts).
-- Er gibt nur freigegebene, laufende Stories heraus und dazu kurz gültige
-- Adressen der Dateien.

create table if not exists public.stories (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references public.profiles(id) on delete cascade,
  provider_kind  text not null check (provider_kind in ('artist', 'baker', 'deco', 'location')),
  -- artists.id bzw. providers.id
  provider_id    bigint not null,
  media_id       uuid not null references public.media(id) on delete cascade,
  caption        text not null default '' check (char_length(caption) <= 160),
  -- gesetzt mit der Freigabe der Datei
  live_from      timestamptz,
  expires_at     timestamptz,
  -- von der Verwaltung oder der Person selbst entfernt
  removed        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists stories_live_idx on public.stories (expires_at desc) where not removed and live_from is not null;
create index if not exists stories_owner_idx on public.stories (owner, created_at desc);
create index if not exists stories_media_idx on public.stories (media_id);

alter table public.stories enable row level security;

-- Eigene Stories darf man sehen (Übersicht im Konto); alles andere geht
-- über den Server.
drop policy if exists stories_select_own on public.stories;
create policy stories_select_own on public.stories
  for select using (owner = auth.uid());

revoke insert, update, delete on public.stories from anon, authenticated;

-- Freigabe der Datei startet die 24 Stunden
create or replace function public.stories_on_media_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.stories
       set live_from = now(), expires_at = now() + interval '24 hours'
     where media_id = new.id and live_from is null and not removed;
  end if;
  return new;
end;
$$;

revoke execute on function public.stories_on_media_review() from public, anon, authenticated;

drop trigger if exists stories_media_review on public.media;
create trigger stories_media_review
  after update of status on public.media
  for each row execute function public.stories_on_media_review();

-- Stories lassen sich melden wie Beiträge und Bewertungen
alter type public.report_target add value if not exists 'story';

comment on table public.stories is
  'Stories der Anbietenden (24 Stunden ab Freigabe der Datei). Lesen und Schreiben über den Server.';
