-- Showly 0014: Chat-Anhänge, automatische E-Mails, Provision je Kategorie
-- oder Anbieter, Audit-Log der Verwaltung.

-- ---------------------------------------------------------------------------
-- 1. Chat-Anhänge (Fotos, nach Buchung auch PDF) im privaten Speicher "chat"
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists attachment jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
-- keine Richtlinien auf storage.objects für "chat": Hochladen nur über vom
-- Server ausgestellte signierte Adressen, Lesen nur über signierte Adressen.

-- ---------------------------------------------------------------------------
-- 2. Provision je Kategorie oder Anbieter (showly/feeRules.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.fee_rules (
  id          bigserial primary key,
  scope       text not null check (scope in ('category', 'artist', 'baker', 'deco')),
  ref         text not null check (char_length(ref) between 1 and 40),
  rate        numeric(6, 4) not null check (rate >= 0 and rate <= 0.5),
  created_at  timestamptz not null default now(),
  unique (scope, ref)
);
alter table public.fee_rules enable row level security;

-- Rabatt aus einem Code (trägt Showly, Anbieter bekommen den vollen Anteil)
alter table public.orders add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);

-- ---------------------------------------------------------------------------
-- 3. Audit-Log: jede Aktion der Verwaltung
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id          bigserial primary key,
  actor       uuid references public.profiles(id) on delete set null,
  action      text not null check (char_length(action) <= 80),
  target      text check (char_length(target) <= 200),
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
-- Einträge können nicht geändert werden, auch nicht vom Server
create or replace function public.admin_audit_readonly() returns trigger language plpgsql as $$
begin
  raise exception 'Audit-Log ist unveränderlich';
end $$;
drop trigger if exists admin_audit_no_update on public.admin_audit;
create trigger admin_audit_no_update before update on public.admin_audit
  for each row execute function public.admin_audit_readonly();
