-- Showly 0011: Shows und Bewertungen im Profil echt zählen
--
-- Im Profil steht, wie viele Shows ein Künstler schon über Showly gespielt
-- hat. Gezählt wird nur, was wirklich stattgefunden hat: eine bestätigte
-- Buchung, bei der der Künstler mit dem Code eingecheckt oder der Kunde die
-- Anwesenheit bestätigt hat (checked_in_at). Abgesagte, abgelehnte und
-- "nicht erschienen"-Buchungen zählen nicht.
--
-- Bewertungsschnitt und -anzahl kommen ebenso aus der Tabelle reviews.
-- Alle drei Werte rechnet die Datenbank selbst nach; ein Anbieter kann sie
-- an seinem Profil nicht von Hand ändern.

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
    review_count = (select count(*) from public.reviews r where r.artist_id = aid),
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.artist_id = aid), 0)
  where a.id = aid
$$;
revoke all on function public.refresh_artist_counts(bigint) from public, anon, authenticated;

create or replace function public.trg_bookings_counts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.artist_id is not null then perform public.refresh_artist_counts(new.artist_id); end if;
  elsif tg_op = 'DELETE' then
    if old.artist_id is not null then perform public.refresh_artist_counts(old.artist_id); end if;
  else
    if old.artist_id is not null then perform public.refresh_artist_counts(old.artist_id); end if;
    if new.artist_id is not null and new.artist_id is distinct from old.artist_id then
      perform public.refresh_artist_counts(new.artist_id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists bookings_counts on public.bookings;
create trigger bookings_counts
  after insert or delete or update of status, checked_in_at, artist_id on public.bookings
  for each row execute function public.trg_bookings_counts();

create or replace function public.trg_reviews_counts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_artist_counts(new.artist_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_artist_counts(old.artist_id);
  else
    perform public.refresh_artist_counts(old.artist_id);
    if new.artist_id <> old.artist_id then perform public.refresh_artist_counts(new.artist_id); end if;
  end if;
  return null;
end $$;

drop trigger if exists reviews_counts on public.reviews;
create trigger reviews_counts
  after insert or delete or update of rating, artist_id on public.reviews
  for each row execute function public.trg_reviews_counts();

-- Anbieter dürfen ihr Profil pflegen, aber diese Zahlen nicht anfassen
drop policy if exists artists_update_own on public.artists;
create policy artists_update_own on public.artists
  for update using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and verified  = (select a.verified  from public.artists a where a.id = artists.id)
    and published = (select a.published from public.artists a where a.id = artists.id)
    and blocked   = (select a.blocked   from public.artists a where a.id = artists.id)
    and business  = (select a.business  from public.artists a where a.id = artists.id)
    and blocked_reason is not distinct from (select a.blocked_reason from public.artists a where a.id = artists.id)
    and tax_ack_at     is not distinct from (select a.tax_ack_at     from public.artists a where a.id = artists.id)
    and events_count = (select a.events_count from public.artists a where a.id = artists.id)
    and review_count = (select a.review_count from public.artists a where a.id = artists.id)
    and rating       = (select a.rating       from public.artists a where a.id = artists.id)
  );

-- Bestehende Profile einmal nachrechnen
select public.refresh_artist_counts(id) from public.artists;
