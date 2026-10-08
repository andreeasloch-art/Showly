-- Showly 0017: Zeitplan in der Datenbank (pg_cron + pg_net)
--
--  - alle 5 Minuten: Check-in-Wächter  POST /api/checkin
--  - täglich 6:00 Uhr deutscher Zeit:  POST /api/taeglich
--
-- Adresse der App und Schlüssel stehen in private.cron_settings (nicht über
-- die API erreichbar). Solange keine Adresse eingetragen ist (App noch nicht
-- veröffentlicht), tun die Aufträge nichts. Nach dem Veröffentlichen genügt:
--   update private.cron_settings set base_url = 'https://<deine-domain>';

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_settings (
  id        boolean primary key default true check (id),
  base_url  text,
  token     text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  updated_at timestamptz not null default now()
);
insert into private.cron_settings (id) values (true) on conflict (id) do nothing;
revoke all on private.cron_settings from public, anon, authenticated;

-- Der Server prüft den Schlüssel über diese Funktion (nur mit Dienstschlüssel)
create or replace function public.cron_token_ok(p_token text)
returns boolean
language sql
security definer set search_path = private, public
stable
as $$
  select exists (select 1 from private.cron_settings where token = p_token and length(p_token) >= 32)
$$;
revoke all on function public.cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.cron_token_ok(text) to service_role;

-- Aufruf eines Endpunkts der App, wenn eine Adresse eingetragen ist
create or replace function private.call_app(p_path text)
returns void
language plpgsql
security definer set search_path = private, public, extensions
as $$
declare s private.cron_settings;
begin
  select * into s from private.cron_settings limit 1;
  if s.base_url is null or s.base_url = '' then return; end if;
  perform net.http_post(
    url := rtrim(s.base_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || s.token, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function private.call_app(text) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('showly-checkin', 'showly-taeglich');
select cron.schedule('showly-checkin', '*/5 * * * *', $$select private.call_app('/api/checkin')$$);
-- 4:00 UTC = 6:00 Uhr Sommerzeit bzw. 5:00 Uhr Winterzeit
select cron.schedule('showly-taeglich', '0 4 * * *', $$select private.call_app('/api/taeglich')$$);
