-- ============================================================================
-- Showly 0005: private und gewerbliche Anbieter, Steuerhinweis
--
-- Auf Showly dürfen auch Privatpersonen auftreten. Vertragsstrafen in AGB
-- sind gegenüber Privatpersonen unwirksam (§ 309 Nr. 6 BGB); der Server
-- setzt bei privaten Anbietern deshalb keine Geldstrafe an, das Stufenmodell
-- gilt für alle. Kunden sehen im Profil, ob sie bei einer Privatperson buchen.
-- ============================================================================

alter table public.artists
  add column if not exists business    boolean not null default false,
  add column if not exists tax_ack_at  timestamptz;

-- Bis hierhin mussten alle Künstler "gewerblich" bestätigen
update public.artists set business = true where created_at < now();

create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business
  from public.artists
  where published and not blocked;

-- Status, Sperre und Freischaltung ändert nur der Server bzw. die Verwaltung.
-- Sonst könnte sich ein Anbieter nach einer Absage selbst auf "privat"
-- stellen oder eine Sperre aufheben.
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
  );
