-- Showly 0010: SMS-Codes mit Kostenbremse
--
-- Jede verschickte SMS und jeder Prüfversuch wird hier gezählt, damit der
-- Server Limits je Nummer, je Internetadresse, je Land und pro Tag
-- durchsetzen kann (lib/sms.server.ts). Gespeichert werden nur gekürzte
-- Prüfwerte (Hash) von Nummer und IP, nie die Nummer oder IP selbst, und
-- nach 30 Tagen wird alles gelöscht.

create table if not exists public.sms_log (
  id          bigserial primary key,
  kind        text not null check (kind in ('send', 'check')),
  phone_hash  text not null check (char_length(phone_hash) <= 64),
  ip_hash     text not null check (char_length(ip_hash) <= 64),
  country     text not null check (char_length(country) = 2),
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists sms_log_phone_idx on public.sms_log (phone_hash, created_at);
create index if not exists sms_log_ip_idx on public.sms_log (ip_hash, created_at);
create index if not exists sms_log_day_idx on public.sms_log (kind, created_at);

-- Nur der Server liest und schreibt hier
alter table public.sms_log enable row level security;

-- Löschfrist 30 Tage (ruft der tägliche Lauf auf, siehe daily.server.ts)
create or replace function public.purge_sms_log()
returns void
language sql
security definer set search_path = public
as $$ delete from public.sms_log where created_at < now() - interval '30 days' $$;
revoke all on function public.purge_sms_log() from public, anon, authenticated;
