/* Anfragegrenzen bei gestörter Datenbank: heikle Aktionen blockieren,
   harmlose lassen durch (guard.server.ts, STRICT). */
import { describe, expect, it, vi } from "vitest";

/* Einfache Ersatzfunktion statt vi.fn: Vitest werten Fehler aus vi.fn als
   Testfehler, auch wenn der Code sie wie gewollt abfängt. */
let impl: () => Promise<{ data: unknown; error: unknown }> = async () => ({ data: true, error: null });
const rpc = () => impl();
vi.mock("./supabase.server", () => ({ adminClient: () => ({ rpc }), requireUser: () => undefined }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

const { allow } = await import("./guard.server");
const STRICT = ["signup", "support", "report", "connect", "upload", "cart", "message"] as const;
const OPEN = ["view", "error", "action", "offer"] as const;

describe("allow bei Datenbankstörung", () => {
  it("blockiert heikle Aktionen, wenn der Zähler einen Fehler meldet", async () => {
    impl = async () => ({ data: null, error: { message: "kaputt" } });
    for (const k of STRICT) expect(await allow(k, "1.2.3.4")).toBe(false);
  });

  it("blockiert heikle Aktionen, wenn die Datenbank nicht erreichbar ist", async () => {
    impl = () => new Promise((_, reject) => setTimeout(() => reject(new TypeError("fetch failed")), 0));
    for (const k of STRICT) expect(await allow(k, "1.2.3.4")).toBe(false);
  });

  it("lässt harmlose Aktionen bei Störung durch", async () => {
    impl = async () => ({ data: null, error: { message: "kaputt" } });
    for (const k of OPEN) expect(await allow(k, "1.2.3.4")).toBe(true);
  });

  it("zählt normal: unter der Grenze erlaubt, darüber nicht", async () => {
    impl = async () => ({ data: true, error: null });
    expect(await allow("signup", "1.2.3.4")).toBe(true);
    impl = async () => ({ data: false, error: null });
    expect(await allow("signup", "1.2.3.4")).toBe(false);
  });
});
