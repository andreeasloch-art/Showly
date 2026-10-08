-- Showly 0018: Stornoregel der Torte (kostenlos bis Produktionsbeginn) mit
-- der Bestellung speichern, wie bei Künstler-Buchungen und Verleih (0016)
alter table public.sweet_requests add column if not exists policy jsonb;
