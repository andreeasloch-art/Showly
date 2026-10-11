import { beforeEach, describe, expect, it, vi } from "vitest";

/* Zählt, wie oft wirklich bei der Datenbank gefragt wird */
const calls = { artists: 0, spot: 0, avail: 0 };

function query(table: string) {
  const res = { data: table === "artists_public" ? [{ id: 100001 }] : [], error: null };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "lte", "gte", "limit"]) q[m] = () => q;
  q["then"] = (ok: (v: unknown) => unknown) => {
    if (table === "artists_public") calls.artists++;
    if (table === "spotlights") calls.spot++;
    return Promise.resolve(res).then(ok);
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: query }) }));
vi.mock("./supabase.server", () => ({ adminClient: () => ({ from: query }) }));
vi.mock("./schedule.server", () => ({
  scheduleEntries: async () => {
    calls.avail++;
    return new Map([["100001|2026-10-20", ["14:00"]]]);
  },
}));

describe("Zwischenspeicher der Startseite", () => {
  beforeEach(() => {
    process.env["VITE_SUPABASE_URL"] = "https://x.supabase.co";
    process.env["VITE_SUPABASE_ANON_KEY"] = "anon";
  });

  it("fragt die Datenbank nur nach Ablauf der Fristen erneut", async () => {
    const { cachedCatalog } = await import("./homecache.server");
    const t0 = 1_000_000;
    const a = await cachedCatalog(t0);
    expect(a.artists).toHaveLength(1);
    expect(a.avail[100001]?.["2026-10-20"]).toEqual(["14:00"]);

    /* 50 Besucher gleichzeitig und eine halbe Minute später: nichts Neues */
    await Promise.all(Array.from({ length: 50 }, () => cachedCatalog(t0 + 1000)));
    await cachedCatalog(t0 + 30_000);
    expect(calls).toEqual({ artists: 1, spot: 1, avail: 1 });

    /* Nach gut einer Minute: Termine neu, Katalog noch nicht */
    await cachedCatalog(t0 + 61_000);
    expect(calls).toEqual({ artists: 1, spot: 1, avail: 2 });

    /* Nach gut fünf Minuten: auch der Katalog neu */
    await cachedCatalog(t0 + 5 * 60_000 + 1000);
    expect(calls).toEqual({ artists: 2, spot: 2, avail: 3 });
  });
});
