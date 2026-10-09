-- Top Act der Woche: bezahlte Platzierung je Stadt, 99 € je Woche.
-- Je Stadt und Tag höchstens ein Top Act. Vor der Zahlung wird der Zeitraum
-- 30 Minuten reserviert (status 'reserved'), nach der Zahlung fest ('paid').

create table if not exists public.spotlights (
  id                 bigserial primary key,
  owner              uuid not null references public.profiles(id) on delete cascade,
  artist_id          bigint references public.artists(id) on delete set null,
  city               text not null check (char_length(city) between 2 and 80),
  city_slug          text not null check (city_slug ~ '^[a-z0-9-]{2,80}$'),
  name               text not null check (char_length(name) between 2 and 80),
  cat                text not null check (char_length(cat) <= 30),
  tagline            text not null check (char_length(tagline) between 3 and 120),
  link               text check (link is null or link ~ '^/kuenstler/'),
  starts_on          date not null,
  ends_on            date not null check (ends_on >= starts_on),
  weeks              integer not null check (weeks between 1 and 4),
  amount_cents       integer not null check (amount_cents > 0),
  status             text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  hold_until         timestamptz,
  stripe_session_id  text unique,
  created_at         timestamptz not null default now()
);
create index if not exists spotlights_city_idx on public.spotlights (city_slug, starts_on, ends_on);
alter table public.spotlights enable row level security;
drop policy if exists spotlights_select_public on public.spotlights;
create policy spotlights_select_public on public.spotlights for select using (status = 'paid' or owner = auth.uid());

-- Zeitraum reservieren: Stadt sperren, Überschneidung mit bezahlten oder noch
-- reservierten Wochen prüfen, Reservierung anlegen. Rückgabe: Zeile oder Fehler.
create or replace function public.spotlight_reservieren(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slug  text := p->>'city_slug';
  v_from  date := (p->>'starts_on')::date;
  v_to    date := (p->>'ends_on')::date;
  v_id    bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('spotlight:' || v_slug, 0));
  if exists (
    select 1 from public.spotlights
     where city_slug = v_slug
       and daterange(starts_on, ends_on, '[]') && daterange(v_from, v_to, '[]')
       and (status = 'paid' or (status = 'reserved' and hold_until > now()))
  ) then
    return jsonb_build_object('error', 'vergeben');
  end if;
  insert into public.spotlights (owner, artist_id, city, city_slug, name, cat, tagline, link, starts_on, ends_on, weeks, amount_cents, status, hold_until)
  values (
    (p->>'owner')::uuid, nullif(p->>'artist_id', '')::bigint, p->>'city', v_slug, p->>'name', p->>'cat', p->>'tagline',
    nullif(p->>'link', ''), v_from, v_to, (p->>'weeks')::int, (p->>'amount_cents')::int, 'reserved', now() + interval '30 minutes'
  ) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function public.spotlight_reservieren(jsonb) from public, anon, authenticated;
grant execute on function public.spotlight_reservieren(jsonb) to service_role;
