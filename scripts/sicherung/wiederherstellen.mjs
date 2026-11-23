#!/usr/bin/env node
/* Showly-Sicherung zurückspielen.
 *
 *   node scripts/sicherung/wiederherstellen.mjs <datei.json.gz|datei.json> <postgres-url> [--ersetzen]
 *
 * <postgres-url>: Verbindungsadresse der Datenbank (Lovable Cloud bzw.
 * Supabase → Project Settings → Database → Connection string, „Session“).
 * Ohne --ersetzen wird nur in leere Tabellen geschrieben; sind Tabellen
 * nicht leer, bricht das Skript ab und ändert nichts. Mit --ersetzen werden
 * die gesicherten Tabellen vorher geleert. Alles läuft in einer Transaktion:
 * Bei einem Fehler bleibt die Datenbank, wie sie war.
 * Anleitung: docs/datensicherung.md */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import pg from "pg";

const CHUNK = 2000;
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

/** Liest die wöchentliche Sicherung (.json.gz) oder den Download aus der Verwaltung (.json) */
export function readBackup(file) {
  const raw = readFileSync(file);
  const gz = raw[0] === 0x1f && raw[1] === 0x8b;
  const b = JSON.parse((gz ? gunzipSync(raw) : raw).toString("utf8"));
  if (b.format !== "showly-sicherung-1") throw new Error("Unbekanntes Format: " + b.format);
  return b;
}

/** Spielt die Sicherung b in die Datenbank (pg.Client) ein. Gibt die Zeilen je Tabelle zurück. */
export async function restore(client, b, { replace = false, log = () => {} } = {}) {
  const { rows: existing } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
  );
  const have = new Set(existing.map((r) => r.table_name));
  const tables = Object.keys(b.tables).filter((t) => have.has(t));
  const missing = Object.keys(b.tables).filter((t) => !have.has(t));
  if (missing.length) log(`Hinweis: nicht in der Datenbank, übersprungen: ${missing.join(", ")}`);

  await client.query("begin");
  try {
    /* Fremdschlüssel und Trigger (z. B. Schreibschutz der Belege) während
       des Einspielens aus; die Daten waren beim Sichern schon stimmig. */
    await client.query("set local session_replication_role = replica");
    if (!replace) {
      const full = [];
      for (const t of tables) {
        const { rows } = await client.query(`select exists (select 1 from public.${q(t)}) as x`);
        if (rows[0].x) full.push(t);
      }
      if (full.length) throw new Error(`Nicht leer: ${full.join(", ")}. Mit --ersetzen werden sie vorher geleert.`);
    } else {
      /* Zeilenweise löschen statt TRUNCATE: TRUNCATE ginge nicht, solange
         nicht gesicherte Tabellen (z. B. offene Kassen) darauf verweisen.
         Fremdschlüssel sind hier ausgeschaltet (replica). */
      for (const t of tables) await client.query(`delete from public.${q(t)}`);
    }
    const counts = {};
    for (const t of tables) {
      const rows = b.tables[t] || [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        await client.query(
          `insert into public.${q(t)} select * from json_populate_recordset(null::public.${q(t)}, $1::json)`,
          [JSON.stringify(rows.slice(i, i + CHUNK))],
        );
      }
      counts[t] = rows.length;
      log(`${t}: ${rows.length}`);
    }
    /* Zähler für neue Nummern hinter die höchste vorhandene setzen */
    const { rows: seqs } = await client.query(`
      select c.table_name, c.column_name, pg_get_serial_sequence('public.' || quote_ident(c.table_name), c.column_name) as seq
      from information_schema.columns c
      where c.table_schema = 'public' and (c.column_default like 'nextval(%' or c.is_identity = 'YES')`);
    for (const s of seqs) {
      if (!s.seq || !tables.includes(s.table_name)) continue;
      await client.query(
        `select setval($1, coalesce((select max(${q(s.column_name)}) from public.${q(s.table_name)}), 0) + 1, false)`,
        [s.seq],
      );
    }
    await client.query("commit");
    return counts;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, url] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const replace = process.argv.includes("--ersetzen");
  if (!file || !url) {
    console.error("Aufruf: node scripts/sicherung/wiederherstellen.mjs <datei.json.gz> <postgres-url> [--ersetzen]");
    process.exit(2);
  }
  const b = readBackup(file);
  console.log(`Sicherung vom ${b.createdAt}, ${Object.keys(b.tables).length} Tabellen, ${b.authUsers?.length ?? 0} Konten`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const counts = await restore(client, b, { replace, log: (m) => console.log("  " + m) });
    console.log(`Fertig: ${Object.values(counts).reduce((s, n) => s + n, 0)} Zeilen eingespielt.`);
  } catch (e) {
    console.error("Abgebrochen, nichts geändert: " + e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
