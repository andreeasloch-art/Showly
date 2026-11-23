-- ============================================================================
-- 0030: Speicher für die wöchentliche Datensicherung
--
-- Privat: Kein Browser kommt heran, nur der Server mit dem Dienstschlüssel
-- (lib/backup.server.ts). Es gibt deshalb absichtlich keine Zugriffsregeln
-- auf storage.objects für diesen Speicher. Mehrfach ausführbar.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('sicherungen', 'sicherungen', false)
on conflict (id) do update set public = false;
