-- Showly 0015: Pakete der Hochzeits- und Eventplaner (Basic, Premium, Luxus)
-- mit Preis, Leistungen und Beschreibung. Der Server rechnet bei einer
-- Paketbuchung mit dem Preis aus dieser Spalte (cart.server.ts).
alter table public.artists add column if not exists packages jsonb
  check (packages is null or jsonb_typeof(packages) = 'array');

create or replace view public.artists_public
  with (security_invoker = on) as
  select id, cat, name, loc, descr, tags, langs, includes, specs,
         price_cents, color, image_path, verified, superhost,
         rating, review_count, events_count, response_time, response_rate,
         instant_book, business, media, work_hours, packages
  from public.artists
  where published and not blocked;
