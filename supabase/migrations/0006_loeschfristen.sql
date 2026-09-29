-- ============================================================================
-- Showly 0006: Löschfristen, wie in der Datenschutzerklärung zugesagt
--
-- Die Funktion wird vom Server regelmäßig aufgerufen (bei eingehenden
-- Fehlermeldungen und Support-Anfragen, siehe support.functions.ts). Wer einen
-- Zeitplan im Datenbank-Dashboard (pg_cron) einrichten kann, ruft sie
-- zusätzlich täglich auf:  select public.purge_old_data();
-- ============================================================================

create or replace function public.purge_old_data()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Technische Fehlermeldungen: 90 Tage
  delete from public.client_errors where created_at < now() - interval '90 days';
  -- Support-Anfragen: 24 Monate nach Eingang, sobald beantwortet oder erledigt
  delete from public.support_tickets
    where status <> 'open' and created_at < now() - interval '24 months';
  -- Nachrichten zu Buchungen und Anfragen: 24 Monate
  delete from public.messages where created_at < now() - interval '24 months';
  -- Zähler gegen Missbrauch: 2 Tage
  delete from public.rate_limits where window_start < now() - interval '2 days';
end;
$$;

revoke all on function public.purge_old_data() from public, anon, authenticated;
