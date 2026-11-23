/* Tägliche Prüfung und Alarm-Mails (alert.server.ts) */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
const marks = new Set<string>();
let errors: { message: string }[] = [];

vi.mock("./mail.server", () => ({
  sendMail: async (to: string, subject: string) => {
    sent.push({ to, subject });
    return true;
  },
}));
vi.mock("./supabase.server", () => ({
  adminClient: () => ({
    from: (t: string) => {
      if (t === "admin_emails") return { select: async () => ({ data: [{ email: "chefin@example.org" }] }) };
      if (t === "notifications_sent")
        return {
          insert: async ({ key }: { key: string }) => {
            if (marks.has(key)) return { error: { message: "doppelt" } };
            marks.add(key);
            return { error: null };
          },
        };
      /* client_errors */
      const q = {
        select: () => q,
        gte: () => q,
        order: () => q,
        limit: async () => ({ data: errors, count: errors.length }),
      };
      return q;
    },
  }),
}));

const { healthCheck, ERROR_THRESHOLD } = await import("./alert.server");

describe("tägliche Prüfung", () => {
  beforeEach(() => {
    sent.length = 0;
    marks.clear();
    errors = [];
  });

  it("bleibt still, wenn alles in Ordnung ist", async () => {
    errors = Array.from({ length: 3 }, () => ({ message: "selten" }));
    expect(await healthCheck({ payoutsFailed: 0, calendarsFailed: 0 })).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it("warnt bei vielen Browserfehlern und nennt die häufigsten", async () => {
    errors = [
      ...Array.from({ length: ERROR_THRESHOLD }, () => ({ message: "Kasse lädt nicht" })),
      { message: "anderer Fehler" },
    ];
    const p = await healthCheck({ payoutsFailed: 0, calendarsFailed: 0 });
    expect(p[0]).toMatch(/26 Fehler/);
    expect(p[0]).toMatch(/25× Kasse lädt nicht/);
    expect(sent).toEqual([{ to: "chefin@example.org", subject: "Showly-Warnung: Auffälligkeiten im Betrieb" }]);
  });

  it("warnt bei fehlgeschlagenen Auszahlungen", async () => {
    expect((await healthCheck({ payoutsFailed: 2, calendarsFailed: 0 }))[0]).toMatch(/2 Auszahlung/);
  });

  it("schickt dieselbe Warnung höchstens einmal am Tag", async () => {
    await healthCheck({ payoutsFailed: 1, calendarsFailed: 0 });
    await healthCheck({ payoutsFailed: 1, calendarsFailed: 0 });
    expect(sent).toHaveLength(1);
  });
});
