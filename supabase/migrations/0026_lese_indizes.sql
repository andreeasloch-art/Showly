-- Verzeichnisse (Indizes) für die Abfragen, die bei jedem Besuch laufen.
-- Die meisten gab es schon (Termine, Reservierungen, Buchungen); hier die
-- zwei, die fehlten. Ändert keine Daten.

-- Laufende Acts/Locations der Woche (homecache.server.ts, activeSpotlights):
-- nur bezahlte Plätze, gesucht über das Enddatum
create index if not exists spotlights_paid_ends_idx
  on public.spotlights (ends_on, starts_on)
  where status = 'paid';

-- Freigeschaltete Anbieter (Ansicht providers_public)
create index if not exists providers_published_kind_idx
  on public.providers (kind)
  where published;
