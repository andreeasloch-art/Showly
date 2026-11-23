/* Wiederherstellung gegen ein echtes Postgres: Sicherung erstellen, Daten
 * zerstören, Sicherung zurückspielen, alles wieder da.
 *
 * Läuft nur, wenn SICHERUNG_TEST_DB auf eine Wegwerf-Datenbank zeigt, z. B.
 *   SICHERUNG_TEST_DB=postgres://postgres@localhost:55432/sicherung?host=/tmp
 * Die Datenbank wird dabei komplett neu aufgebaut. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { freshDb } from "./testdb";

vi.mock("./supabase.server", () => ({ adminClient: () => ({}) }));
const { BACKUP_TABLES } = await import("./backup.server");
// @ts-expect-error: reines JavaScript-Skript ohne Typen
const { restore } = await import("../../scripts/sicherung/wiederherstellen.mjs");

const DB = process.env["SICHERUNG_TEST_DB"];
const KUNDE = "11111111-1111-1111-1111-111111111111";
const ARTIST = "22222222-2222-2222-2222-222222222222";

/* Rechnung im Namen des Künstlers (wie in belege.db.test.ts) */
const beleg = (quelle: string) => ({
  art: "rechnung",
  kreis: `R:${ARTIST}`,
  praefix: "V1042",
  stellen: 4,
  jahr: 2026,
  quelle,
  aussteller_typ: "anbieter",
  anbieter_id: ARTIST,
  im_namen_von_anbieter: true,
  kunde_id: KUNDE,
  aussteller_snapshot: { name: "Test" },
  empfaenger_snapshot: { name: "Kunde" },
  netto_cent: 8403,
  steuer_cent: 1597,
  brutto_cent: 10000,
  steuer_aufstellung: [{ satz: 19, netto_cent: 8403, steuer_cent: 1597, brutto_cent: 10000 }],
  pflichthinweise: ["Rechnung erstellt durch Showly im Namen und für Rechnung von Test."],
  positionen: [{ beschreibung: "Auftritt", menge: 1, einzel_brutto_cent: 10000, brutto_cent: 10000, steuersatz: 19 }],
});

describe.skipIf(!DB)("Sicherung zurückspielen", () => {
  const pool = new pg.Pool({ connectionString: DB, max: 2 });

  /* Sicherung wie der Server sie baut, nur direkt aus Postgres gelesen */
  async function snapshot() {
    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const [t, order] of Object.entries(BACKUP_TABLES)) {
      const { rows } = await pool.query(
        `select coalesce(json_agg(x order by ${order.map((c) => `x."${c}"`).join(", ")}), '[]'::json) as r from public."${t}" x`,
      );
      const list = rows[0].r as unknown[];
      tables[t] = list;
      counts[t] = list.length;
    }
    return { format: "showly-sicherung-1", createdAt: new Date().toISOString(), counts, tables, authUsers: [] };
  }
  const count = async (t: string) => Number((await pool.query(`select count(*) from public."${t}"`)).rows[0].count);

  beforeAll(async () => {
    await freshDb(pool);
    await pool.query(`insert into auth.users(id, email) values ($1, 'kunde@test.de'), ($2, 'artist@test.de')`, [KUNDE, ARTIST]);
    await pool.query(
      `insert into public.artists(id, owner, cat, name, loc, price_cents, published) values (1, $1, 'zauberer', '"A"', '"Berlin"', 10000, true)`,
      [ARTIST],
    );
    /* mehr als 1000 Zeilen in einer Tabelle */
    await pool.query(
      `insert into public.bookings(artist_id, customer, day, slot, status, amount_cents)
       select 1, $1, date '2027-01-01' + g, '10:00', 'completed', 10000 from generate_series(0, 1499) g`,
      [KUNDE],
    );
    await pool.query(`insert into public.reviews(artist_id, author, rating, body) values (1, $1, 5, 'Sehr gut, gerne wieder')`, [KUNDE]);
    await pool.query(`insert into public.posts(author, body) values ($1, 'Unser Fest mit Grüßen 🎉')`, [KUNDE]);
    await pool.query("select public.beleg_anlegen($1::jsonb)", [JSON.stringify(beleg("test-1"))]);
  }, 120_000);

  afterAll(async () => {
    await pool.end();
  });

  it("stellt nach Datenverlust alles wieder her, auch über 1000 Zeilen", async () => {
    const b = await snapshot();
    expect(b.counts["bookings"]).toBe(1500);

    /* Unglück: Daten gelöscht bzw. verändert */
    await pool.query("delete from public.reviews");
    await pool.query("delete from public.posts");
    await pool.query("update public.bookings set amount_cents = 1");

    const c = await pool.connect();
    try {
      await restore(c, b, { replace: true });
    } finally {
      c.release();
    }
    expect(await count("bookings")).toBe(1500);
    expect(await count("reviews")).toBe(1);
    expect((await pool.query("select body from public.posts")).rows[0].body).toBe("Unser Fest mit Grüßen 🎉");
    expect(Number((await pool.query("select sum(amount_cents) from public.bookings")).rows[0].sum)).toBe(1500 * 10000);
    expect(Number((await pool.query("select count(*) from public.profiles")).rows[0].count)).toBe(2);
    /* Rechnungen sind gegen Löschen gesperrt; die Wiederherstellung kommt trotzdem durch */
    expect((await pool.query("select nummer from public.belege")).rows.map((r) => r.nummer)).toEqual(["V1042-2026-0001"]);
  });

  it("vergibt danach die nächste Rechnungsnummer ohne Lücke und ohne Doppel", async () => {
    const { rows } = await pool.query("select (public.beleg_anlegen($1::jsonb)).nummer", [JSON.stringify(beleg("test-2"))]);
    expect(rows[0].nummer).toBe("V1042-2026-0002");
  });

  it("vergibt danach neue Nummern hinter den alten", async () => {
    const { rows } = await pool.query(
      `insert into public.bookings(artist_id, customer, day, slot, status, amount_cents) values (1, $1, '2028-01-01', '10:00', 'completed', 1) returning id`,
      [KUNDE],
    );
    expect(Number(rows[0].id)).toBeGreaterThan(1500);
  });

  it("ändert ohne --ersetzen nichts, wenn Tabellen nicht leer sind", async () => {
    const b = await snapshot();
    const before = await count("bookings");
    const c = await pool.connect();
    try {
      await expect(restore(c, b, { replace: false })).rejects.toThrow(/Nicht leer/);
    } finally {
      c.release();
    }
    expect(await count("bookings")).toBe(before);
  });
});
