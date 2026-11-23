/* Anfragegrenzen bei gestörter Datenbank: heikle Aktionen blockieren,
   harmlose lassen durch (guard.server.ts, STRICT). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase.server", () => ({ adminClient: () => ({ rpc }), requireUser: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

const { allow } = await import("./guard.server");

describe("allow bei Datenbankstörung", () => {
  beforeEach(() => rpc.mockReset());

  it("blockiert heikle Aktionen, wenn der Zähler einen Fehler meldet", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "kaputt" } });
    for (const k of ["signup", "support", "report", "connect", "upload", "cart", "message"] as const)
      expect(await allow(k, "1.2.3.4")).toBe(false);
  });

  it("blockiert heikle Aktionen, wenn die Datenbank nicht erreichbar ist", async () => {
    rpc.mockImplementation(async () => {
      throw new Error("netz weg");
    });
    expect(await allow("signup", "1.2.3.4")).toBe(false);
  });

  it("lässt harmlose Aktionen bei Störung durch", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "kaputt" } });
    for (const k of ["view", "error", "action", "offer"] as const) expect(await allow(k, "1.2.3.4")).toBe(true);
  });

  it("zählt normal: unter der Grenze erlaubt, darüber nicht", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await allow("signup", "1.2.3.4")).toBe(true);
    expect(await allow("signup", "1.2.3.4")).toBe(false);
  });
});
