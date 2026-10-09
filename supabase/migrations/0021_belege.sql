-- Belegsystem (GoBD): Rechnungen im Namen der Anbieter, Buchungsquittungen,
-- Storno- und Korrekturbelege, Provisionsrechnungen und Auszahlungsabrechnungen.
--
-- Grundregeln
--  - Showly verkauft nichts selbst, sondern vermittelt. Kunden zahlen keine
--    Gebühr an Showly. Showly nimmt Provision von den Anbietern (Standard
--    20 % = 2000 Basispunkte, zzgl. 19 % USt), abgerechnet jeden Montag.
--  - Gewerbliche Anbieter und Kleinunternehmer: Rechnung im Namen des
--    Anbieters (eigener Nummernkreis je Anbieter). Private Anbieter:
--    Buchungsquittung von Showly (Kreis Q).
--  - Belege sind nach dem Erstellen unveränderbar (Trigger unten), werden nie
--    gelöscht und 10 Jahre aufbewahrt. Korrekturen nur über neue Belege.
--  - Nummern lückenlos: Zähler und Beleg entstehen in derselben Transaktion
--    (beleg_anlegen). Schlägt das Anlegen fehl, wird auch die Nummer nicht
--    verbraucht.

-- 1 Anbieter-Steuerdaten (eine Zeile je Person bzw. Firma = Konto) ----------
create table if not exists public.anbieter (
  id                     uuid primary key references public.profiles(id) on delete restrict,
  typ                    text not null default 'privat' check (typ in ('gewerblich', 'kleinunternehmer', 'privat')),
  name                   text,                 -- Vor- und Nachname
  firma                  text,                 -- Firmenname, falls vorhanden
  strasse                text,
  plz                    text,
  ort                    text,
  land                   text not null default 'DE',
  steuernummer           text,
  ust_id                 text,
  handelsregister        text,
  -- Präfix der eigenen Rechnungsnummern, z. B. V1042 -> V1042-2026-0001
  rechnung_praefix       text unique,
  -- Steuersatz für Auftritte und Leistungen ohne eigene Angabe (19 oder 7)
  ust_satz_standard      integer not null default 19 check (ust_satz_standard in (0, 7, 19)),
  -- DAC7 (Plattformen-Steuertransparenzgesetz): Meldedaten
  geburtsdatum           date,
  steuer_id              text,                 -- steuerliche Identifikationsnummer
  iban                   text,                 -- Kennung des Finanzkontos für die Meldung
  -- ohne vollständige Daten keine Auszahlung (oder von der Verwaltung gesperrt)
  auszahlungen_gesperrt  boolean not null default true,
  sperrgrund             text,
  -- Zähler je Kalenderjahr (beleg_zaehlen setzt am Jahreswechsel zurück)
  zaehler_jahr           integer not null default extract(year from now())::int,
  umsatz_jahr_cent       bigint not null default 0,
  buchungen_jahr         integer not null default 0,
  -- private Anbieter über der Schwelle: Hinweis auf Kleinunternehmer
  hinweis_gewerbe        boolean not null default false,
  hinweis_gewerbe_am     timestamptz,
  -- Kleinunternehmer nahe an der Umsatzgrenze
  warnung_umsatzgrenze   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.anbieter enable row level security;
drop policy if exists anbieter_select_own on public.anbieter;
create policy anbieter_select_own on public.anbieter for select using (id = auth.uid());

-- 2 Nummernkreise ------------------------------------------------------------
create table if not exists public.nummernkreise (
  schluessel     text    not null,   -- 'R:<anbieter-uuid>', 'Q', 'PR', 'AB'
  jahr           integer not null,
  letzte_nummer  integer not null check (letzte_nummer > 0),
  primary key (schluessel, jahr)
);
alter table public.nummernkreise enable row level security;

create or replace function public.nummernkreise_schutz()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Nummernkreise dürfen nicht gelöscht werden';
  end if;
  if new.letzte_nummer < old.letzte_nummer or new.schluessel <> old.schluessel or new.jahr <> old.jahr then
    raise exception 'Nummernkreise dürfen nicht zurückgesetzt werden';
  end if;
  return new;
end $$;
drop trigger if exists nummernkreise_schutz on public.nummernkreise;
create trigger nummernkreise_schutz before update or delete on public.nummernkreise
  for each row execute function public.nummernkreise_schutz();

-- 3 Belege -------------------------------------------------------------------
create table if not exists public.belege (
  id                       bigserial primary key,
  art                      text not null check (art in ('rechnung', 'quittung', 'storno', 'korrektur', 'provisionsrechnung', 'auszahlungsabrechnung', 'kaution')),
  nummer                   text not null,
  kreis                    text not null,
  jahr                     integer not null,
  laufnummer               integer not null,
  aussteller_typ           text not null check (aussteller_typ in ('anbieter', 'plattform')),
  anbieter_id              uuid references public.profiles(id) on delete restrict,
  im_namen_von_anbieter    boolean not null default false,
  kunde_id                 uuid references public.profiles(id) on delete set null,
  order_id                 bigint,
  buchung_id               bigint,       -- Teilbestellung je Anbieter (sub_orders.id)
  bezug_beleg_id           bigint references public.belege(id) on delete restrict,
  -- Idempotenz: z. B. 'kauf:<sub_order>' oder 'storno:<beleg>:<erstattung>'
  quelle                   text unique,
  belegdatum               date not null default (now() at time zone 'Europe/Berlin')::date,
  leistung_von             date,
  leistung_bis             date,
  aussteller_snapshot      jsonb not null,
  empfaenger_snapshot      jsonb not null,
  netto_cent               bigint not null,
  steuer_cent              bigint not null,
  brutto_cent              bigint not null,
  steuer_aufstellung       jsonb not null default '[]',
  pflichthinweise          text[] not null default '{}',
  kleinbetrag              boolean not null default false,
  e_rechnung_erforderlich  boolean not null default false,
  -- Ablage (einmalig nach dem Erzeugen gesetzt, danach fest)
  pdf_pfad                 text,
  sha256                   text,
  xml_pfad                 text,
  auszahlung_id            bigint,
  erstellt_am              timestamptz not null default now(),
  unique (kreis, jahr, laufnummer),
  unique (nummer)
);
create index if not exists belege_anbieter_idx on public.belege (anbieter_id, jahr);
create index if not exists belege_kunde_idx on public.belege (kunde_id);
create index if not exists belege_buchung_idx on public.belege (buchung_id);
alter table public.belege enable row level security;
drop policy if exists belege_select_beteiligt on public.belege;
create policy belege_select_beteiligt on public.belege for select
  using (anbieter_id = auth.uid() or kunde_id = auth.uid());

create table if not exists public.beleg_positionen (
  id                 bigserial primary key,
  beleg_id           bigint not null references public.belege(id) on delete restrict,
  pos                integer not null,
  beschreibung       text not null,
  menge              integer not null default 1,
  einzel_brutto_cent bigint not null,
  brutto_cent        bigint not null,
  steuersatz         integer not null default 0,
  leistung_von       date,
  leistung_bis       date,
  referenz           text,          -- z. B. 'booking:123', 'sweet:9', 'payout:5'
  unique (beleg_id, pos)
);
alter table public.beleg_positionen enable row level security;
drop policy if exists beleg_positionen_select on public.beleg_positionen;
create policy beleg_positionen_select on public.beleg_positionen for select
  using (exists (select 1 from public.belege b where b.id = beleg_id and (b.anbieter_id = auth.uid() or b.kunde_id = auth.uid())));

-- Unveränderbar: Inhalte nie ändern, nie löschen. Nur die Ablage-Felder
-- (PDF, Prüfsumme, XML, Zuordnung zur Wochenabrechnung) werden einmalig
-- gesetzt, solange sie leer sind.
create or replace function public.belege_schutz()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Belege dürfen nicht gelöscht werden (GoBD)';
  end if;
  if (to_jsonb(new) - array['pdf_pfad', 'sha256', 'xml_pfad', 'auszahlung_id'])
     is distinct from (to_jsonb(old) - array['pdf_pfad', 'sha256', 'xml_pfad', 'auszahlung_id']) then
    raise exception 'Belege sind unveränderbar; Korrekturen nur über Storno- oder Korrekturbeleg';
  end if;
  if (old.pdf_pfad is not null and new.pdf_pfad is distinct from old.pdf_pfad)
     or (old.sha256 is not null and new.sha256 is distinct from old.sha256)
     or (old.xml_pfad is not null and new.xml_pfad is distinct from old.xml_pfad)
     or (old.auszahlung_id is not null and new.auszahlung_id is distinct from old.auszahlung_id) then
    raise exception 'Ablage eines Belegs ist schon festgeschrieben';
  end if;
  return new;
end $$;
drop trigger if exists belege_schutz on public.belege;
create trigger belege_schutz before update or delete on public.belege
  for each row execute function public.belege_schutz();

create or replace function public.beleg_positionen_schutz()
returns trigger language plpgsql as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Belegpositionen sind unveränderbar (GoBD)';
  end if;
  if exists (select 1 from public.belege b where b.id = new.beleg_id and b.sha256 is not null) then
    raise exception 'Beleg ist abgeschlossen; keine weiteren Positionen';
  end if;
  return new;
end $$;
drop trigger if exists beleg_positionen_schutz on public.beleg_positionen;
create trigger beleg_positionen_schutz before insert or update or delete on public.beleg_positionen
  for each row execute function public.beleg_positionen_schutz();

-- Beleg samt Positionen anlegen, mit lückenloser Nummer. Gibt es zu
-- p.quelle schon einen Beleg (z. B. Webhook kommt zweimal), kommt dieser
-- zurück. Die Zeilensperre im Nummernkreis gilt bis zum Ende der
-- Transaktion; gleichzeitige Aufrufe bekommen nacheinander die nächste Nummer.
create or replace function public.beleg_anlegen(p jsonb)
returns public.belege
language plpgsql security definer set search_path = public as $$
declare
  v_row    public.belege;
  v_quelle text := nullif(p->>'quelle', '');
  v_kreis  text := p->>'kreis';
  v_jahr   integer := coalesce((p->>'jahr')::int, extract(year from (now() at time zone 'Europe/Berlin'))::int);
  v_nr     integer;
  v_pos    jsonb;
  v_i      integer := 0;
begin
  if v_kreis is null or coalesce(p->>'praefix', '') = '' then
    raise exception 'Nummernkreis fehlt';
  end if;
  if v_quelle is not null then
    perform pg_advisory_xact_lock(hashtextextended('beleg:' || v_quelle, 0));
    select * into v_row from public.belege where quelle = v_quelle;
    if found then
      return v_row;
    end if;
  end if;

  insert into public.nummernkreise (schluessel, jahr, letzte_nummer)
  values (v_kreis, v_jahr, 1)
  on conflict (schluessel, jahr) do update set letzte_nummer = public.nummernkreise.letzte_nummer + 1
  returning letzte_nummer into v_nr;

  insert into public.belege (
    art, nummer, kreis, jahr, laufnummer, aussteller_typ, anbieter_id, im_namen_von_anbieter,
    kunde_id, order_id, buchung_id, bezug_beleg_id, quelle, belegdatum, leistung_von, leistung_bis,
    aussteller_snapshot, empfaenger_snapshot, netto_cent, steuer_cent, brutto_cent,
    steuer_aufstellung, pflichthinweise, kleinbetrag, e_rechnung_erforderlich
  ) values (
    p->>'art',
    (p->>'praefix') || '-' || v_jahr || '-' || lpad(v_nr::text, coalesce((p->>'stellen')::int, 6), '0'),
    v_kreis, v_jahr, v_nr,
    p->>'aussteller_typ',
    nullif(p->>'anbieter_id', '')::uuid,
    coalesce((p->>'im_namen_von_anbieter')::boolean, false),
    nullif(p->>'kunde_id', '')::uuid,
    nullif(p->>'order_id', '')::bigint,
    nullif(p->>'buchung_id', '')::bigint,
    nullif(p->>'bezug_beleg_id', '')::bigint,
    v_quelle,
    coalesce(nullif(p->>'belegdatum', '')::date, (now() at time zone 'Europe/Berlin')::date),
    nullif(p->>'leistung_von', '')::date,
    nullif(p->>'leistung_bis', '')::date,
    coalesce(p->'aussteller_snapshot', '{}'),
    coalesce(p->'empfaenger_snapshot', '{}'),
    (p->>'netto_cent')::bigint,
    (p->>'steuer_cent')::bigint,
    (p->>'brutto_cent')::bigint,
    coalesce(p->'steuer_aufstellung', '[]'),
    coalesce(array(select jsonb_array_elements_text(p->'pflichthinweise')), '{}'),
    coalesce((p->>'kleinbetrag')::boolean, false),
    coalesce((p->>'e_rechnung_erforderlich')::boolean, false)
  ) returning * into v_row;

  for v_pos in select * from jsonb_array_elements(coalesce(p->'positionen', '[]')) loop
    v_i := v_i + 1;
    insert into public.beleg_positionen (beleg_id, pos, beschreibung, menge, einzel_brutto_cent, brutto_cent, steuersatz, leistung_von, leistung_bis, referenz)
    values (
      v_row.id, v_i, v_pos->>'beschreibung',
      coalesce((v_pos->>'menge')::int, 1),
      (v_pos->>'einzel_brutto_cent')::bigint,
      (v_pos->>'brutto_cent')::bigint,
      coalesce((v_pos->>'steuersatz')::int, 0),
      nullif(v_pos->>'leistung_von', '')::date,
      nullif(v_pos->>'leistung_bis', '')::date,
      nullif(v_pos->>'referenz', '')
    );
  end loop;
  return v_row;
end $$;
revoke all on function public.beleg_anlegen(jsonb) from public, anon, authenticated;
grant execute on function public.beleg_anlegen(jsonb) to service_role;

-- Zähler je Anbieter und Jahr; gibt die neuen Werte zurück (für Hinweise)
create or replace function public.beleg_zaehlen(p_anbieter uuid, p_cent bigint, p_buchungen integer)
returns public.anbieter
language plpgsql security definer set search_path = public as $$
declare
  v_jahr integer := extract(year from (now() at time zone 'Europe/Berlin'))::int;
  v_row  public.anbieter;
begin
  insert into public.anbieter (id) values (p_anbieter) on conflict (id) do nothing;
  update public.anbieter
     set umsatz_jahr_cent = case when zaehler_jahr = v_jahr then umsatz_jahr_cent else 0 end + p_cent,
         buchungen_jahr   = case when zaehler_jahr = v_jahr then buchungen_jahr else 0 end + p_buchungen,
         zaehler_jahr     = v_jahr,
         updated_at       = now()
   where id = p_anbieter
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.beleg_zaehlen(uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.beleg_zaehlen(uuid, bigint, integer) to service_role;

-- Am 1.1. (täglicher Job) alle Zähler zurücksetzen
create or replace function public.anbieter_jahreswechsel()
returns integer language sql security definer set search_path = public as $$
  with u as (
    update public.anbieter
       set umsatz_jahr_cent = 0, buchungen_jahr = 0, hinweis_gewerbe = false, warnung_umsatzgrenze = false,
           zaehler_jahr = extract(year from (now() at time zone 'Europe/Berlin'))::int
     where zaehler_jahr < extract(year from (now() at time zone 'Europe/Berlin'))::int
    returning 1)
  select count(*)::int from u
$$;
revoke all on function public.anbieter_jahreswechsel() from public, anon, authenticated;
grant execute on function public.anbieter_jahreswechsel() to service_role;

-- 4 Abzüge (Strafgebühren, Schäden, Sonstiges; ohne Umsatzsteuer) --------------
create table if not exists public.anbieter_abzuege (
  id               bigserial primary key,
  anbieter_id      uuid not null references public.profiles(id) on delete restrict,
  art              text not null check (art in ('strafgebuehr', 'schaden', 'sonstiges')),
  betrag_cent      integer not null check (betrag_cent <> 0),   -- negativ = Gutschrift (z. B. Rundungsausgleich)
  grund            text not null,
  buchung_id       bigint,
  verrechnet_cent  integer not null default 0,
  erstellt_von     uuid,
  erstellt_am      timestamptz not null default now()
);
create index if not exists anbieter_abzuege_offen_idx on public.anbieter_abzuege (anbieter_id) where verrechnet_cent <> betrag_cent;
alter table public.anbieter_abzuege enable row level security;
drop policy if exists anbieter_abzuege_select_own on public.anbieter_abzuege;
create policy anbieter_abzuege_select_own on public.anbieter_abzuege for select using (anbieter_id = auth.uid());

-- 5 Korrekturen nach Erstattung, wenn schon ausgezahlt war ---------------------
create table if not exists public.provision_korrekturen (
  id                   bigserial primary key,
  anbieter_id          uuid not null references public.profiles(id) on delete restrict,
  buchung_id           bigint,                 -- sub_orders.id
  payout_id            bigint,
  beleg_id             bigint references public.belege(id),
  umsatz_cent          integer not null check (umsatz_cent < 0),
  provision_netto_cent integer not null check (provision_netto_cent <= 0),
  provision_ust_cent   integer not null check (provision_ust_cent <= 0),
  -- was der Anbieter zurückzahlt: Erstattung minus Provisionsgutschrift (brutto)
  rueckforderung_cent  integer not null check (rueckforderung_cent >= 0),
  verrechnet_cent      integer not null default 0,
  quelle               text unique,
  auszahlung_id        bigint,
  erstellt_am          timestamptz not null default now()
);
alter table public.provision_korrekturen enable row level security;
drop policy if exists provision_korrekturen_select_own on public.provision_korrekturen;
create policy provision_korrekturen_select_own on public.provision_korrekturen for select using (anbieter_id = auth.uid());

-- Verrechnung von Abzügen und Rückforderungen mit einzelnen Auszahlungen
create table if not exists public.verrechnungen (
  id             bigserial primary key,
  payout_id      bigint not null,
  abzug_id       bigint references public.anbieter_abzuege(id),
  korrektur_id   bigint references public.provision_korrekturen(id),
  betrag_cent    integer not null,
  auszahlung_id  bigint,
  erstellt_am    timestamptz not null default now(),
  check ((abzug_id is null) <> (korrektur_id is null))
);
alter table public.verrechnungen enable row level security;

-- 6 Wochenabrechnung je Anbieter ----------------------------------------------
create table if not exists public.auszahlungen (
  id                     bigserial primary key,
  anbieter_id            uuid not null references public.profiles(id) on delete restrict,
  zeitraum_von           date not null,
  zeitraum_bis           date not null,
  umsatz_brutto_cent     bigint not null default 0,
  provision_netto_cent   bigint not null default 0,
  provision_steuer_cent  bigint not null default 0,
  provision_brutto_cent  bigint not null default 0,
  gebuehren_cent         bigint not null default 0,   -- schnellere Auszahlung (brutto)
  einbehalt_cent         bigint not null default 0,   -- Sicherheitseinbehalt (+ einbehalten, − freigegeben)
  abzuege_cent           bigint not null default 0,
  korrekturen_cent       bigint not null default 0,
  vortrag_cent           bigint not null default 0,   -- noch offen nach dieser Woche (negativ)
  auszahlung_cent        bigint not null default 0,   -- in der Woche überwiesen
  status                 text not null check (status in ('bereit', 'ausgezahlt', 'erledigt', 'vortrag')),
  provisionsrechnung_id  bigint references public.belege(id),
  abrechnung_id          bigint references public.belege(id),
  erstellt_am            timestamptz not null default now(),
  unique (anbieter_id, zeitraum_bis)
);
alter table public.auszahlungen enable row level security;
drop policy if exists auszahlungen_select_own on public.auszahlungen;
create policy auszahlungen_select_own on public.auszahlungen for select using (anbieter_id = auth.uid());

-- 7 Bestehende Tabellen ergänzen ------------------------------------------------
alter table public.orders
  add column if not exists kunde_name     text,
  add column if not exists kunde_firma    text,
  add column if not exists kunde_ust_id   text,
  add column if not exists kunde_anschrift text;
alter table public.sub_orders
  add column if not exists provision_bp   integer,
  add column if not exists erstattet_cent integer not null default 0;
alter table public.payouts
  add column if not exists provision_bp        integer,
  add column if not exists provision_ust_cent  integer not null default 0,
  add column if not exists erstattet_cent      integer not null default 0,
  add column if not exists ausgezahlt_am       timestamptz,
  add column if not exists einbehalt_frei_am   timestamptz,
  add column if not exists auszahlung_id       bigint,
  add column if not exists einbehalt_auszahlung_id bigint;

alter table public.payouts
  add column if not exists ueberwiesen_cent integer;   -- erster Teil, nach Verrechnung

-- Präfix für Rechnungsnummern eines Anbieters (V1001, V1002, …), einmalig
create or replace function public.anbieter_praefix(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_p text;
  v_n integer;
begin
  insert into public.anbieter (id) values (p_id) on conflict (id) do nothing;
  select rechnung_praefix into v_p from public.anbieter where id = p_id for update;
  if v_p is not null then
    return v_p;
  end if;
  insert into public.nummernkreise (schluessel, jahr, letzte_nummer) values ('praefix', 0, 1)
  on conflict (schluessel, jahr) do update set letzte_nummer = public.nummernkreise.letzte_nummer + 1
  returning letzte_nummer into v_n;
  v_p := 'V' || (1000 + v_n)::text;
  update public.anbieter set rechnung_praefix = v_p where id = p_id;
  return v_p;
end $$;
revoke all on function public.anbieter_praefix(uuid) from public, anon, authenticated;
grant execute on function public.anbieter_praefix(uuid) to service_role;

-- Fällige Vertragsstrafen der Künstler (penalties) werden zu Abzügen und
-- mit der nächsten Auszahlung verrechnet
alter table public.anbieter_abzuege add column if not exists penalty_id bigint unique;
do $$
begin
  if to_regclass('public.penalties') is not null and to_regclass('public.artists') is not null then
    create or replace function public.strafe_als_abzug()
    returns trigger language plpgsql security definer set search_path = public as $f$
    declare v_owner uuid;
    begin
      if new.status::text = 'due' and new.amount_cents > 0 and (tg_op = 'INSERT' or old.status::text is distinct from 'due') then
        select owner into v_owner from public.artists where id = new.artist_id;
        if v_owner is not null then
          insert into public.anbieter_abzuege (anbieter_id, art, betrag_cent, grund, penalty_id, verrechnet_cent)
          values (v_owner, 'strafgebuehr', new.amount_cents, 'Vertragsstrafe ' || new.reason::text || ' (Buchung ' || new.booking_id || ')', new.id, coalesce(new.offset_cents, 0))
          on conflict (penalty_id) do nothing;
        end if;
      end if;
      return new;
    end $f$;
    drop trigger if exists strafe_als_abzug on public.penalties;
    create trigger strafe_als_abzug after insert or update of status on public.penalties
      for each row execute function public.strafe_als_abzug();
  end if;
end $$;

-- Wochenabrechnung atomar buchen: Anbieter sperren, nichts doppelt, alles
-- Verwendete markieren. Rechnet nicht selbst (showly/belege.ts), sondern
-- prüft und schreibt fest. Rückgabe: {status, id}.
create or replace function public.wochenabrechnung_buchen(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_anbieter uuid := (p->>'anbieter_id')::uuid;
  v_bis      date := (p->>'zeitraum_bis')::date;
  v_a        public.anbieter;
  v_vorh     public.auszahlungen;
  v_pr       public.belege;
  v_ab       public.belege;
  v_id       bigint;
  v_n        integer;
begin
  select * into v_a from public.anbieter where id = v_anbieter for update;
  if not found then
    return jsonb_build_object('status', 'unbekannt');
  end if;
  if v_a.auszahlungen_gesperrt then
    return jsonb_build_object('status', 'gesperrt');
  end if;
  select * into v_vorh from public.auszahlungen where anbieter_id = v_anbieter and zeitraum_bis = v_bis;
  if found then
    return jsonb_build_object('status', 'vorhanden', 'id', v_vorh.id);
  end if;

  -- Was abgerechnet wird, darf noch keiner Woche zugeordnet sein
  perform 1 from public.payouts
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'payout_ids', '[]')) x)
   for update;
  select count(*) into v_n from public.payouts
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'payout_ids', '[]')) x)
     and auszahlung_id is not null;
  if v_n > 0 then
    raise exception 'Auszahlung schon abgerechnet';
  end if;

  if p->'provisionsrechnung' is not null and jsonb_typeof(p->'provisionsrechnung') = 'object' then
    v_pr := public.beleg_anlegen(p->'provisionsrechnung');
  end if;
  v_ab := public.beleg_anlegen(p->'abrechnung');

  insert into public.auszahlungen (
    anbieter_id, zeitraum_von, zeitraum_bis, umsatz_brutto_cent, provision_netto_cent, provision_steuer_cent,
    provision_brutto_cent, gebuehren_cent, einbehalt_cent, abzuege_cent, korrekturen_cent, vortrag_cent,
    auszahlung_cent, status, provisionsrechnung_id, abrechnung_id
  ) values (
    v_anbieter, (p->>'zeitraum_von')::date, v_bis,
    coalesce((p->'summen'->>'umsatz_brutto_cent')::bigint, 0),
    coalesce((p->'summen'->>'provision_netto_cent')::bigint, 0),
    coalesce((p->'summen'->>'provision_steuer_cent')::bigint, 0),
    coalesce((p->'summen'->>'provision_brutto_cent')::bigint, 0),
    coalesce((p->'summen'->>'gebuehren_cent')::bigint, 0),
    coalesce((p->'summen'->>'einbehalt_cent')::bigint, 0),
    coalesce((p->'summen'->>'abzuege_cent')::bigint, 0),
    coalesce((p->'summen'->>'korrekturen_cent')::bigint, 0),
    coalesce((p->'summen'->>'vortrag_cent')::bigint, 0),
    coalesce((p->'summen'->>'auszahlung_cent')::bigint, 0),
    p->'summen'->>'status',
    v_pr.id, v_ab.id
  ) returning id into v_id;

  update public.payouts set auszahlung_id = v_id
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'payout_ids', '[]')) x);
  update public.payouts set einbehalt_auszahlung_id = v_id
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'einbehalt_ids', '[]')) x)
     and einbehalt_auszahlung_id is null;
  update public.verrechnungen set auszahlung_id = v_id
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'verrechnung_ids', '[]')) x);
  update public.provision_korrekturen set auszahlung_id = v_id
   where id in (select (x)::bigint from jsonb_array_elements_text(coalesce(p->'korrektur_ids', '[]')) x)
     and auszahlung_id is null;
  if v_pr.id is not null then
    update public.belege set auszahlung_id = v_id where id = v_pr.id and auszahlung_id is null;
  end if;
  update public.belege set auszahlung_id = v_id where id = v_ab.id and auszahlung_id is null;
  return jsonb_build_object('status', 'neu', 'id', v_id, 'provisionsrechnung_id', v_pr.id, 'abrechnung_id', v_ab.id);
end $$;
revoke all on function public.wochenabrechnung_buchen(jsonb) from public, anon, authenticated;
grant execute on function public.wochenabrechnung_buchen(jsonb) to service_role;

-- 8 Ablage der PDFs: privater Speicher "belege". Nur der Server schreibt;
-- Kunden und Anbieter bekommen kurz gültige Links. Überschreiben und Löschen
-- sind für Nutzer nicht erlaubt (keine Richtlinie dafür). Für echten
-- Schreibschutz (WORM) zusätzlich eine Sicherung mit Object Lock einrichten,
-- siehe EINRICHTUNG.md.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('belege', 'belege', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- 9 Zeitplan: Wochenabrechnung montags 06:00 Uhr deutscher Zeit (der
-- Endpunkt prüft die Uhrzeit; 04:00 UTC im Sommer, 05:00 UTC im Winter)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('private.call_app(text)') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'showly-woche';
    perform cron.schedule('showly-woche', '0 4,5 * * 1', $c$select private.call_app('/api/woche')$c$);
  end if;
end $$;
