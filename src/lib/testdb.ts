/* Gemeinsame Hilfen für Datenbanktests gegen ein echtes Postgres:
 * Supabase-Teile (auth, storage, pg_cron, pg_net) minimal nachbilden und
 * alle Migrationen der Reihe nach einspielen. Nur für Tests. */
import { readFileSync, readdirSync } from "node:fs";
import type pg from "pg";

const DIR = new URL("../../supabase/migrations/", import.meta.url);

export const STUBS = `
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; drop schema if exists storage cascade;
drop schema if exists cron cascade; drop schema if exists net cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, phone text,
  raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql
  as $$ insert into cron.job(jobname, schedule, command) values (n, s, c) returning jobid $$;
create function cron.unschedule(n bigint) returns boolean language sql as $$ select true $$;
create function cron.unschedule(n text) returns boolean language sql as $$ select true $$;
create schema net;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
  headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
}

export function migrationSql(f: string): string {
  return readFileSync(new URL(f, DIR), "utf8")
    .replace(/create extension if not exists pg_cron[^;]*;/gi, "")
    .replace(/create extension if not exists pg_net[^;]*;/gi, "")
    .replace(/create extension if not exists btree_gist with schema extensions/gi, "create extension if not exists btree_gist");
}

/** Datenbank leeren und mit allen Migrationen neu aufbauen */
export async function freshDb(pool: pg.Pool): Promise<void> {
  await pool.query(STUBS);
  for (const f of migrationFiles()) await pool.query(migrationSql(f));
}
