-- Rechte aufräumen (Sicherheitsprüfung 13.10.2026). Ändert keine Daten.
--
-- Die öffentlichen Ansichten sind nur zum Lesen da. Schreiben ging über sie
-- ohnehin nur im Rahmen der Zugriffsregeln der Tabellen (security_invoker),
-- jetzt ist es ganz zu.
revoke insert, update, delete on public.artists_public, public.providers_public, public.provider_offers_public
  from anon, authenticated;

-- Trigger-Funktionen braucht niemand direkt aufzurufen
revoke execute on function public.grant_admin_by_email() from anon, authenticated, public;
revoke execute on function public.trg_bookings_counts() from anon, authenticated, public;
revoke execute on function public.trg_reviews_counts() from anon, authenticated, public;
revoke execute on function public.trg_bookings_claims() from anon, authenticated, public;
revoke execute on function public.strafe_als_abzug() from anon, authenticated, public;
