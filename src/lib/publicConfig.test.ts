import { afterEach, describe, expect, it } from "vitest";
import { publicSupabaseScript, serverPublicSupabase } from "./publicConfig";

const KEEP = { ...process.env };
afterEach(() => {
  process.env = { ...KEEP };
});

describe("Öffentliche Datenbank-Angaben", () => {
  it("liest auch Lovables Namen (PUBLISHABLE_KEY, PROJECT_ID)", () => {
    delete process.env["VITE_SUPABASE_URL"];
    delete process.env["VITE_SUPABASE_ANON_KEY"];
    process.env["VITE_SUPABASE_PROJECT_ID"] = "abc123";
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = "pub";
    expect(serverPublicSupabase()).toEqual({ url: "https://abc123.supabase.co", key: "pub" });
  });

  it("schreibt das Skript ohne Möglichkeit, das Skript-Tag zu schließen", () => {
    const s = publicSupabaseScript({ url: "https://x.supabase.co", key: "</script><b>" });
    expect(s).not.toContain("</script>");
    expect(publicSupabaseScript(null)).toBe("window.__SHOWLY_SB=null;");
  });
});
