-- Top Act der Woche: bis zu fünf Acts je Stadt und Tag (statt einem).
-- Sie wechseln sich oben auf der Startseite alle fünf Sekunden ab.
-- Ein Act kann denselben Tag in derselben Stadt nicht doppelt buchen.
create or replace function public.spotlight_reservieren(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slug  text := p->>'city_slug';
  v_from  date := (p->>'starts_on')::date;
  v_to    date := (p->>'ends_on')::date;
  v_owner uuid := (p->>'owner')::uuid;
  v_id    bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('spotlight:' || v_slug, 0));
  if exists (
    select 1 from public.spotlights
     where city_slug = v_slug and owner = v_owner
       and daterange(starts_on, ends_on, '[]') && daterange(v_from, v_to, '[]')
       and (status = 'paid' or (status = 'reserved' and hold_until > now()))
  ) then
    return jsonb_build_object('error', 'doppelt');
  end if;
  if exists (
    select 1
      from generate_series(v_from, v_to, interval '1 day') as d(tag)
     where (select count(*) from public.spotlights s
             where s.city_slug = v_slug
               and d.tag::date between s.starts_on and s.ends_on
               and (s.status = 'paid' or (s.status = 'reserved' and s.hold_until > now()))) >= 5
  ) then
    return jsonb_build_object('error', 'vergeben');
  end if;
  insert into public.spotlights (owner, artist_id, city, city_slug, name, cat, tagline, link, starts_on, ends_on, weeks, amount_cents, status, hold_until)
  values (
    v_owner, nullif(p->>'artist_id', '')::bigint, p->>'city', v_slug, p->>'name', p->>'cat', p->>'tagline',
    nullif(p->>'link', ''), v_from, v_to, (p->>'weeks')::int, (p->>'amount_cents')::int, 'reserved', now() + interval '30 minutes'
  ) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function public.spotlight_reservieren(jsonb) from public, anon, authenticated;
grant execute on function public.spotlight_reservieren(jsonb) to service_role;
