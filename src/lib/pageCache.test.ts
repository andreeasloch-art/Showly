import { describe, expect, it } from "vitest";
import { pageCacheKey } from "./pageCache";

const req = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request("https://showly.de" + path, { method, headers: { accept: "text/html,*/*", ...headers } });

describe("Seiten-Zwischenspeicher", () => {
  it("merkt öffentliche Seiten, mit Sprache, Land und Build im Schlüssel", () => {
    const k = pageCacheKey(req("/kuenstler/berlin/zauberer/marco-5?lang=en", { "cf-ipcountry": "AT" }), "b1");
    expect(k?.url).toBe("https://showly.de/kuenstler/berlin/zauberer/marco-5?lang=en&__c=at&__b=b1");
    for (const p of ["/", "/torten", "/torten/100004", "/locations", "/locations/3", "/buchen", "/buchen/zauberer/berlin", "/ratgeber/kindergeburtstag", "/shop", "/rechtliches/agb"])
      expect(pageCacheKey(req(p), "b1"), p).not.toBeNull();
  });

  it("lässt Konto, Kasse, Verwaltung und Serveranfragen aus", () => {
    for (const p of ["/konto", "/dashboard", "/checkout", "/checkout/return", "/admin", "/portal", "/anmelden", "/top-act", "/api/katalog", "/locations/anbieten", "/torten/anbieten", "/_serverFn/abc"])
      expect(pageCacheKey(req(p), "b1"), p).toBeNull();
  });

  it("lässt Angemeldete, POST und Nicht-HTML aus", () => {
    expect(pageCacheKey(req("/", { cookie: "consent=1; sb-abc-auth-token=x" }), "b1")).toBeNull();
    expect(pageCacheKey(req("/", {}, "POST"), "b1")).toBeNull();
    expect(pageCacheKey(new Request("https://showly.de/", { headers: { accept: "application/json" } }), "b1")).toBeNull();
    expect(pageCacheKey(req("/", { cookie: "consent=1" }), "b1")).not.toBeNull();
  });
});
