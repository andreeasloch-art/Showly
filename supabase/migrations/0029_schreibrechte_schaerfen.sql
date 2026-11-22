-- ============================================================================
-- 0029: Schreibrechte schärfen (Sicherheitsprüfung 22.11.2026)
--
-- Angemeldete Nutzer konnten mit dem öffentlichen Schlüssel und ihrer
-- Sitzung an einigen Stellen direkt in die Datenbank schreiben, am Server
-- vorbei. Die App selbst braucht das nicht: Bewertungen, Beiträge,
-- Kommentare, Likes und Künstlerprofile speichert sie über den Server
-- (Dienstschlüssel, siehe utils/*.functions.ts). Diese Migration nimmt die
-- direkten Wege weg.
--
--  1. Profil: E-Mail und Handynummer kann niemand mehr selbst ändern.
--     Die SMS-Anmeldung sucht das Konto über die Handynummer; eine selbst
--     eingetragene fremde Nummer hätte die echte Besitzerin ins Konto des
--     Angreifers geführt. Jede Nummer gehört höchstens zu einem Konto.
--  2. Bewertungen: anlegen und ändern nur noch über den Server. Vorher ließ
--     sich eine eigene Bewertung auf einen anderen Künstler umhängen, die
--     Sterne ändern oder selbst veröffentlichen.
--  3. Beiträge, Kommentare, Likes, verknüpfte Künstler: anlegen und ändern
--     nur noch über den Server (dort greifen Kontaktsperre und Prüfung).
--     Eigene Inhalte löschen bleibt erlaubt.
--  4. Künstlerprofile: ändern nur noch über den Server. Vorher konnten
--     Künstler „Superhost“, Antwortquote und Stornoquote selbst setzen.
--
-- Mehrfach ausführbar.
-- ============================================================================

-- 1. Profil ---------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role  = (select p.role  from public.profiles p where p.id = auth.uid())
    and email is not distinct from (select p.email from public.profiles p where p.id = auth.uid())
    and phone is not distinct from (select p.phone from public.profiles p where p.id = auth.uid())
  );

-- Eine Nummer = ein Konto. Gibt es schon doppelte Nummern, bleibt der
-- Index weg und die Migration läuft trotzdem durch (Hinweis im Protokoll);
-- dann bitte die Dubletten in der Verwaltung klären und erneut ausführen.
do $$
begin
  if exists (
    select phone from public.profiles where phone is not null group by phone having count(*) > 1
  ) then
    raise notice 'profiles.phone enthält doppelte Nummern, eindeutiger Index nicht angelegt';
  else
    create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;
  end if;
end $$;

-- 2. Bewertungen ------------------------------------------------------------
drop policy if exists reviews_insert_after_booking on public.reviews;
drop policy if exists reviews_update_own on public.reviews;
revoke insert, update on public.reviews from anon, authenticated;

-- 3. Beiträge, Kommentare, Likes --------------------------------------------
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
revoke insert, update on public.posts from anon, authenticated;

drop policy if exists post_comments_insert_own on public.post_comments;
revoke insert, update on public.post_comments from anon, authenticated;

drop policy if exists post_likes_write_own on public.post_likes;
revoke insert, update, delete on public.post_likes from anon, authenticated;

drop policy if exists post_artists_write_author on public.post_artists;
revoke insert, update, delete on public.post_artists from anon, authenticated;

-- 4. Künstlerprofile ------------------------------------------------------
drop policy if exists artists_update_own on public.artists;
revoke insert, update, delete on public.artists from anon, authenticated;
