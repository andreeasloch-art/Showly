/* Schreibrechte gegen ein echtes Postgres (alle Migrationen bis 0029).
 *
 * Spielt die Angriffe aus der Sicherheitsprüfung vom 22.11.2026 als
 * angemeldete Person durch: fremde Handynummer eintragen, Bewertungen
 * umhängen, Beiträge am Server vorbei, Vertrauenszeichen selbst setzen.
 * Alles muss scheitern, normale Pflege (Anzeigename, Verfügbarkeit) und der
 * Server (Dienstschlüssel) müssen weiter gehen.
 *
 * Läuft nur, wenn RECHTE_TEST_DB auf eine leere Wegwerf-Datenbank zeigt, z. B.
 *   RECHTE_TEST_DB=postgres://postgres@localhost:55432/rechte?host=/tmp
 * Die Datenbank wird dabei komplett neu aufgebaut. Supabase-Teile (auth,
 * storage, pg_cron, pg_net) werden minimal nachgebildet. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { freshDb } from "./testdb";

const DB = process.env["RECHTE_TEST_DB"];


const KUNDE = "11111111-1111-1111-1111-111111111111";
const ARTIST = "22222222-2222-2222-2222-222222222222";
const ANDERE = "33333333-3333-3333-3333-333333333333";

describe.skipIf(!DB)("Schreibrechte in der Datenbank", () => {
  const pool = new pg.Pool({ connectionString: DB, max: 1 });

  /* Eine Anweisung als angemeldete Person; liefert true, wenn sie eine Zeile geändert hat */
  async function als(uid: string, sql: string, params: unknown[] = []): Promise<boolean> {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      const r = await c.query(sql, params);
      await c.query("commit");
      return (r.rowCount ?? 0) > 0;
    } catch {
      await c.query("rollback").catch(() => undefined);
      return false;
    } finally {
      c.release();
    }
  }

  beforeAll(async () => {
    await freshDb(pool);
    await pool.query(`insert into auth.users(id, email) values ($1, 'kunde@test.de'), ($2, 'artist@test.de'), ($3, 'andere@test.de')`, [KUNDE, ARTIST, ANDERE]);
    await pool.query(`update public.profiles set phone = '+491700000003' where id = $1`, [ANDERE]);
    await pool.query(
      `insert into public.artists(id, owner, cat, name, loc, price_cents, published)
       values (1, $1, 'zauberer', '"A"', '"Berlin"', 10000, true), (2, $2, 'dj', '"B"', '"Berlin"', 10000, true)`,
      [ARTIST, ANDERE],
    );
    await pool.query(
      `insert into public.bookings(id, artist_id, customer, day, slot, status, amount_cents)
       values (1, 1, $1, '2026-11-01', '10:00', 'completed', 10000)`,
      [KUNDE],
    );
    await pool.query(`insert into public.reviews(id, artist_id, author, rating, body) values (1, 1, $1, 5, 'Sehr gut, gerne wieder')`, [KUNDE]);
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  it("Handynummer und E-Mail im Profil kann niemand selbst ändern", async () => {
    expect(await als(KUNDE, "update public.profiles set phone = '+491709999999' where id = auth.uid()")).toBe(false);
    expect(await als(KUNDE, "update public.profiles set email = 'fremd@test.de' where id = auth.uid()")).toBe(false);
  });

  it("Anzeigename bleibt änderbar", async () => {
    expect(await als(KUNDE, "update public.profiles set display_name = 'Neu' where id = auth.uid()")).toBe(true);
  });

  it("Bewertungen lassen sich weder umhängen noch selbst veröffentlichen oder neu anlegen", async () => {
    expect(await als(KUNDE, "update public.reviews set artist_id = 2, rating = 1, published_at = now() where id = 1")).toBe(false);
    expect(
      await als(KUNDE, "insert into public.reviews(artist_id, author, rating, body, published_at) values (1, auth.uid(), 5, 'Noch eine Bewertung', now())"),
    ).toBe(false);
  });

  it("Beiträge, Kommentare und Likes nur über den Server", async () => {
    expect(await als(KUNDE, "insert into public.posts(author, body) values (auth.uid(), 'Ruf mich an 0170 123')")).toBe(false);
  });

  it("Künstler setzen Superhost, Antwort- und Stornoquote nicht selbst", async () => {
    expect(await als(ARTIST, "update public.artists set superhost = true, response_rate = 100, cancel_rate = 0 where id = 1")).toBe(false);
  });

  it("Künstler pflegen ihre Verfügbarkeit weiter selbst", async () => {
    expect(await als(ARTIST, "insert into public.availability(artist_id, day, slot, blocked) values (1, '2026-12-24', 'all', true)")).toBe(true);
  });

  it("eine Handynummer gehört höchstens zu einem Konto", async () => {
    await expect(pool.query(`update public.profiles set phone = '+491700000003' where id = $1`, [KUNDE])).rejects.toThrow();
  });

  it("der Server (Dienstschlüssel) schreibt weiter", async () => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role service_role");
      const r = await c.query("update public.artists set superhost = true where id = 1");
      await c.query("rollback");
      expect(r.rowCount).toBe(1);
    } finally {
      c.release();
    }
  });
});
