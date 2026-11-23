/* Datensicherung (backup.server.ts): keine Tabelle vergessen, große
   Tabellen vollständig, Datei lässt sich wieder öffnen. */
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.server", () => ({ adminClient: () => ({}) }));
const { BACKUP_TABLES, SKIP_TABLES, packBackup, readAll } = await import("./backup.server");

describe("Datensicherung", () => {
  it("sichert jede Tabelle aus den Migrationen oder lässt sie bewusst aus", () => {
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    const tables = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(new URL(f, dir), "utf8");
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)\s*\(/gi)) tables.add(m[1]!.toLowerCase());
    }
    const covered = new Set([...Object.keys(BACKUP_TABLES), ...SKIP_TABLES]);
    expect([...tables].filter((t) => !covered.has(t)).sort()).toEqual([]);
    expect(Object.keys(BACKUP_TABLES).filter((t) => !tables.has(t))).toEqual([]);
  });

  it("liest große Tabellen seitenweise vollständig (über 1000 Zeilen)", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1 }));
    const q = {
      order: () => q,
      range: async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }),
    };
    const db = { from: () => ({ select: () => q }) } as unknown as Parameters<typeof readAll>[0];
    const rows = await readAll(db, "bookings", ["id"]);
    expect(rows).toHaveLength(2500);
    expect((rows[2499] as { id: number }).id).toBe(2500);
  });

  it("bricht bei einem Lesefehler ab, statt eine unvollständige Sicherung zu schreiben", async () => {
    const q = { order: () => q, range: async () => ({ data: null, error: { message: "Zeitüberschreitung" } }) };
    const db = { from: () => ({ select: () => q }) } as unknown as Parameters<typeof readAll>[0];
    await expect(readAll(db, "bookings", ["id"])).rejects.toThrow(/bookings: Zeitüberschreitung/);
  });

  it("packt und entpackt die Datei verlustfrei", () => {
    const b = {
      format: "showly-sicherung-1" as const,
      createdAt: "2026-11-23T05:00:00.000Z",
      counts: { posts: 1 },
      tables: { posts: [{ id: 1, body: "Grüße 🎉" }] },
      authUsers: [],
    };
    expect(JSON.parse(gunzipSync(packBackup(b)).toString("utf8"))).toEqual(b);
  });
});
