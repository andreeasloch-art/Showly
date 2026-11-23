/* Datensicherung: alle Tabellen samt Konten in eine gepackte Datei.
 *
 * Läuft wöchentlich mit dem Zeitplan (/api/woche, montags 6 Uhr) und auf
 * Knopfdruck in der Verwaltung. Die Datei landet im privaten Speicher
 * „sicherungen“ (Migration 0030); behalten werden die letzten 12.
 * Wiederherstellen: scripts/sicherung/wiederherstellen.mjs, Anleitung in
 * docs/datensicherung.md.
 *
 * Früher sicherte der Export-Knopf nur 23 Tabellen und höchstens 1000 Zeilen
 * je Tabelle (Obergrenze der Datenbank-Schnittstelle). Hier wird jede
 * Tabelle seitenweise vollständig gelesen; ein Test prüft, dass jede Tabelle
 * aus den Migrationen entweder gesichert oder bewusst ausgelassen wird. */
import { gzipSync } from "fflate";
import { adminClient } from "./supabase.server";

/** Tabelle → Spalten für eine feste Reihenfolge beim seitenweisen Lesen */
export const BACKUP_TABLES: Record<string, string[]> = {
  admin_audit: ["id"],
  admin_emails: ["email"],
  anbieter: ["id"],
  anbieter_abzuege: ["id"],
  artists: ["id"],
  auszahlungen: ["id"],
  availability: ["artist_id", "day", "slot"],
  beleg_positionen: ["id"],
  belege: ["id"],
  blocks: ["blocker", "blocked"],
  booking_codes: ["booking_id"],
  bookings: ["id"],
  calendar_export: ["artist_id"],
  calendar_feeds: ["id"],
  complaints: ["id"],
  external_busy: ["id"],
  fee_rules: ["id"],
  guest_reviews: ["id"],
  identity_fingerprints: ["hash"],
  media: ["id"],
  messages: ["id"],
  notifications_sent: ["key"],
  nummernkreise: ["schluessel", "jahr"],
  orders: ["id"],
  payout_accounts: ["profile_id"],
  payouts: ["id"],
  penalties: ["id"],
  post_artists: ["post_id", "artist_id"],
  post_comments: ["id"],
  post_likes: ["post_id", "profile_id"],
  posts: ["id"],
  profiles: ["id"],
  provider_offers: ["id"],
  provider_views: ["kind", "ref", "day"],
  providers: ["id"],
  provision_korrekturen: ["id"],
  rental_claims: ["id"],
  reports: ["id"],
  reviews: ["id"],
  shop_orders: ["id"],
  spotlights: ["id"],
  stories: ["id"],
  stripe_events: ["id"],
  sub_orders: ["id"],
  support_tickets: ["id"],
  sweet_requests: ["id"],
  venue_bookings: ["id"],
  verifications: ["id"],
  verrechnungen: ["id"],
  vouchers: ["code"],
};

/** Bewusst nicht gesichert: kurzlebige Zähler, Reservierungen und Protokolle */
export const SKIP_TABLES = ["rate_limits", "slot_claims", "sms_log", "client_errors", "checkout_drafts"] as const;

export const BACKUP_BUCKET = "sicherungen";
export const KEEP = 12;
const PAGE = 1000;

export interface BackupFile {
  format: "showly-sicherung-1";
  createdAt: string;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
  /** Konten aus der Anmeldung (ohne Passwörter); zum Neuanlegen in einem neuen Projekt */
  authUsers: unknown[];
}

type Db = ReturnType<typeof adminClient>;

/** Eine Tabelle seitenweise komplett lesen */
export async function readAll(db: Db, table: string, order: string[]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table as never).select("*");
    for (const col of order) q = q.order(col as never, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data as unknown[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function readAuthUsers(db: Db): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Konten: ${error.message}`);
    for (const u of data.users)
      out.push({
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at ?? null,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
      });
    if (data.users.length < PAGE) return out;
  }
}

/** Alles einsammeln (ohne zu speichern) */
export async function collectBackup(db: Db = adminClient()): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const [t, order] of Object.entries(BACKUP_TABLES)) {
    tables[t] = await readAll(db, t, order);
    counts[t] = tables[t].length;
  }
  return { format: "showly-sicherung-1", createdAt: new Date().toISOString(), counts, tables, authUsers: await readAuthUsers(db) };
}

export function packBackup(b: BackupFile): Uint8Array {
  return gzipSync(new TextEncoder().encode(JSON.stringify(b)), { level: 9 });
}

/** Sichern, im privaten Speicher ablegen und alte Sicherungen aufräumen */
export async function runBackup(db: Db = adminClient()): Promise<{ path: string; bytes: number; rows: number; tables: number }> {
  const b = await collectBackup(db);
  const gz = packBackup(b);
  const d = new Date(b.createdAt);
  const path = `${d.getUTCFullYear()}/${b.createdAt.replace(/[:.]/g, "-")}.json.gz`;
  const { error } = await db.storage.from(BACKUP_BUCKET).upload(path, gz, { contentType: "application/gzip", upsert: false });
  if (error) throw new Error(`Speichern: ${error.message}`);
  await prune(db).catch(() => undefined);
  const rows = Object.values(b.counts).reduce((s, n) => s + n, 0);
  return { path, bytes: gz.byteLength, rows, tables: Object.keys(b.counts).length };
}

/** Nur die letzten KEEP Sicherungen behalten */
async function prune(db: Db) {
  const all: string[] = [];
  const { data: years } = await db.storage.from(BACKUP_BUCKET).list("", { limit: 100 });
  for (const y of years ?? []) {
    if (!/^\d{4}$/.test(y.name)) continue;
    const { data: files } = await db.storage.from(BACKUP_BUCKET).list(y.name, { limit: 1000 });
    for (const f of files ?? []) if (f.name.endsWith(".json.gz")) all.push(`${y.name}/${f.name}`);
  }
  all.sort();
  const old = all.slice(0, Math.max(0, all.length - KEEP));
  if (old.length) await db.storage.from(BACKUP_BUCKET).remove(old);
}
