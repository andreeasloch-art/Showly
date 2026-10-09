/* Belegsystem gegen ein echtes Postgres (Migration 0021): Nummernvergabe
 * unter Last, Idempotenz, Schreibschutz und Wochenabrechnung.
 *
 * Läuft nur, wenn BELEGE_TEST_DB gesetzt ist, z. B.
 *   BELEGE_TEST_DB=postgres://postgres@localhost:55432/postgres?host=/tmp
 * Die Supabase-Teile (auth.uid, profiles, Tabellen aus früheren
 * Migrationen) werden dafür minimal nachgebildet. */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const DB = process.env["BELEGE_TEST_DB"];
const MIG = readFileSync(new URL("../../supabase/migrations/0021_belege.sql", import.meta.url), "utf8");

const STUBS = `
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table public.profiles (id uuid primary key, email text);
create table public.orders (id bigserial primary key);
create table public.sub_orders (id bigserial primary key, order_id bigint);
create table public.payouts (id bigserial primary key, owner uuid);
`;

const A = "11111111-1111-1111-1111-111111111111";
const K = "22222222-2222-2222-2222-222222222222";

function beleg(quelle: string | null, kreis = `R:${A}`, praefix = "V1042", stellen = 4) {
  return {
    art: "rechnung",
    kreis,
    praefix,
    stellen,
    jahr: 2026,
    quelle,
    aussteller_typ: "anbieter",
    anbieter_id: A,
    im_namen_von_anbieter: true,
    kunde_id: K,
    aussteller_snapshot: { name: "Test" },
    empfaenger_snapshot: { name: "Kunde" },
    netto_cent: 8403,
    steuer_cent: 1597,
    brutto_cent: 10000,
    steuer_aufstellung: [{ satz: 19, netto_cent: 8403, steuer_cent: 1597, brutto_cent: 10000 }],
    pflichthinweise: ["Rechnung erstellt durch Showly im Namen und für Rechnung von Test."],
    positionen: [{ beschreibung: "Auftritt", menge: 1, einzel_brutto_cent: 10000, brutto_cent: 10000, steuersatz: 19 }],
  };
}

describe.skipIf(!DB)("Belege in der Datenbank", () => {
  const pool = new pg.Pool({ connectionString: DB, max: 25 });
  const anlegen = async (p: object) => (await pool.query("select (public.beleg_anlegen($1::jsonb)).*", [JSON.stringify(p)])).rows[0];

  beforeAll(async () => {
    await pool.query(STUBS);
    await pool.query(MIG);
    await pool.query("insert into public.profiles (id) values ($1), ($2)", [A, K]);
    await pool.query("insert into public.anbieter (id, typ, rechnung_praefix, auszahlungen_gesperrt) values ($1, 'gewerblich', 'V1042', false)", [A]);
  });
  afterAll(async () => {
    await pool.end();
  });

  it("Nummernformat und Positionen", async () => {
    const b = await anlegen(beleg("kauf:1"));
    expect(b.nummer).toBe("V1042-2026-0001");
    const { rows } = await pool.query("select * from public.beleg_positionen where beleg_id = $1", [b.id]);
    expect(rows).toHaveLength(1);
  });

  it("doppelter Webhook gibt den vorhandenen Beleg zurück", async () => {
    const a = await anlegen(beleg("kauf:2"));
    const b = await anlegen(beleg("kauf:2"));
    expect(b.id).toBe(a.id);
    expect(b.nummer).toBe(a.nummer);
    const { rows } = await pool.query("select count(*)::int n from public.belege where quelle = 'kauf:2'");
    expect(rows[0].n).toBe(1);
  });

  it("20 gleichzeitige Buchungen: 20 verschiedene, fortlaufende Nummern ohne Lücke", async () => {
    const before = (await pool.query("select coalesce(max(laufnummer),0)::int m from public.belege where kreis = 'Q' and jahr = 2026")).rows[0].m;
    const res = await Promise.all(
      Array.from({ length: 20 }, (_, i) => anlegen({ ...beleg(`quittung:${i}`, "Q", "Q", 6), art: "quittung", aussteller_typ: "plattform" })),
    );
    const nr = res.map((r) => r.laufnummer as number).sort((x, y) => x - y);
    expect(new Set(nr).size).toBe(20);
    expect(nr).toEqual(Array.from({ length: 20 }, (_, i) => before + i + 1));
    expect(res.map((r) => r.nummer)).toContain(`Q-2026-${String(before + 20).padStart(6, "0")}`);
  });

  it("gleichzeitig zweimal derselbe Webhook: nur ein Beleg, keine verbrauchte Nummer", async () => {
    const before = (await pool.query(`select letzte_nummer from public.nummernkreise where schluessel = 'R:${A}' and jahr = 2026`)).rows[0].letzte_nummer;
    const [x, y] = await Promise.all([anlegen(beleg("kauf:race")), anlegen(beleg("kauf:race"))]);
    expect(x.id).toBe(y.id);
    const after = (await pool.query(`select letzte_nummer from public.nummernkreise where schluessel = 'R:${A}' and jahr = 2026`)).rows[0].letzte_nummer;
    expect(after).toBe(before + 1);
  });

  it("Belege sind unveränderbar und unlöschbar", async () => {
    const b = await anlegen(beleg("kauf:fest"));
    await expect(pool.query("update public.belege set brutto_cent = 1 where id = $1", [b.id])).rejects.toThrow(/unveränderbar/);
    await expect(pool.query("delete from public.belege where id = $1", [b.id])).rejects.toThrow(/gelöscht/);
    await expect(pool.query("update public.beleg_positionen set brutto_cent = 1 where beleg_id = $1", [b.id])).rejects.toThrow(/unveränderbar/);
    /* Ablage einmalig setzen geht, danach nicht mehr */
    await pool.query("update public.belege set pdf_pfad = 'x.pdf', sha256 = 'abc' where id = $1", [b.id]);
    await expect(pool.query("update public.belege set sha256 = 'neu' where id = $1", [b.id])).rejects.toThrow(/festgeschrieben/);
    await expect(
      pool.query("insert into public.beleg_positionen (beleg_id, pos, beschreibung, einzel_brutto_cent, brutto_cent) values ($1, 9, 'x', 1, 1)", [b.id]),
    ).rejects.toThrow(/abgeschlossen/);
  });

  it("Nummernkreise lassen sich nicht zurücksetzen", async () => {
    await expect(pool.query("update public.nummernkreise set letzte_nummer = 1 where schluessel = 'Q'")).rejects.toThrow(/zurückgesetzt/);
  });

  describe("Wochenabrechnung", () => {
    const p = (bis: string, payoutIds: number[]) => ({
      anbieter_id: A,
      zeitraum_von: "2026-10-05",
      zeitraum_bis: bis,
      payout_ids: payoutIds,
      provisionsrechnung: { ...beleg(`pr:${A}:${bis}`, "PR", "PR", 6), art: "provisionsrechnung", aussteller_typ: "plattform", positionen: [] },
      abrechnung: { ...beleg(`ab:${A}:${bis}`, "AB", "AB", 6), art: "auszahlungsabrechnung", aussteller_typ: "plattform", positionen: [] },
      summen: { umsatz_brutto_cent: 53000, provision_netto_cent: 7950, provision_steuer_cent: 1511, provision_brutto_cent: 9461, auszahlung_cent: 43539, status: "ausgezahlt" },
    });
    const buchen = async (x: object) => (await pool.query("select public.wochenabrechnung_buchen($1::jsonb) r", [JSON.stringify(x)])).rows[0].r;

    it("zweimal ausführen erzeugt nichts doppelt", async () => {
      const ids = (await pool.query("insert into public.payouts (owner) values ($1), ($1), ($1) returning id", [A])).rows.map((r) => Number(r.id));
      const a = await buchen(p("2026-10-11", ids));
      expect(a.status).toBe("neu");
      const b = await buchen(p("2026-10-11", ids));
      expect(b).toMatchObject({ status: "vorhanden", id: a.id });
      const { rows } = await pool.query("select count(*)::int n from public.belege where art = 'provisionsrechnung'");
      expect(rows[0].n).toBe(1);
      const marked = await pool.query("select count(*)::int n from public.payouts where auszahlung_id = $1", [a.id]);
      expect(marked.rows[0].n).toBe(3);
      /* Dieselben Auszahlungen lassen sich keiner zweiten Woche zuordnen */
      await expect(buchen(p("2026-10-18", ids))).rejects.toThrow(/schon abgerechnet/);
    });

    it("gesperrter Anbieter wird übersprungen", async () => {
      await pool.query("update public.anbieter set auszahlungen_gesperrt = true where id = $1", [A]);
      const r = await buchen(p("2026-10-25", []));
      expect(r.status).toBe("gesperrt");
      await pool.query("update public.anbieter set auszahlungen_gesperrt = false where id = $1", [A]);
    });
  });
});
