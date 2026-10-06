import { describe, expect, it } from "vitest";
import { countryFromHeaders, isBot, localeFor, pickLang } from "./geoLang";

const h = (o: Record<string, string>) => (k: string) => o[k] ?? null;

describe("Land aus der Anfrage", () => {
  it("liest CF-IPCountry", () => {
    expect(countryFromHeaders(h({ "cf-ipcountry": "CO" }))).toBe("co");
    expect(countryFromHeaders(h({ "x-vercel-ip-country": "AT" }))).toBe("at");
  });
  it("ignoriert unbekannte Länder", () => {
    expect(countryFromHeaders(h({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(h({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(countryFromHeaders(h({}))).toBeNull();
  });
});

describe("Sprache nach Land", () => {
  const de = ["de-DE", "de"];
  it("Spanien und Kolumbien: Spanisch, auch mit deutschem Browser", () => {
    expect(pickLang({ ipCountry: "es", browser: de })).toBe("es");
    expect(pickLang({ ipCountry: "co", browser: ["en-US"] })).toBe("es");
  });
  it("Österreich und Schweiz: Deutsch", () => {
    expect(pickLang({ ipCountry: "at", browser: ["en-GB"] })).toBe("de");
    expect(pickLang({ ipCountry: "ch" })).toBe("de");
  });
  it("Großbritannien und USA: Englisch", () => {
    expect(pickLang({ ipCountry: "gb", browser: de })).toBe("en");
    expect(pickLang({ ipCountry: "us" })).toBe("en");
  });
  it("Eigene Wahl und ?lang gehen vor", () => {
    expect(pickLang({ url: "de", ipCountry: "es" })).toBe("de");
    expect(pickLang({ saved: "en", ipCountry: "es" })).toBe("en");
  });
  it("Ohne Land: Zeitzone, dann Browser, dann Deutsch", () => {
    expect(pickLang({ tzCountry: "mx", browser: de })).toBe("es");
    expect(pickLang({ ipCountry: "fr", browser: ["fr-FR", "en"] })).toBe("en");
    expect(pickLang({ ipCountry: "fr", browser: ["fr-FR"] })).toBe("de");
  });
  it("Suchmaschinen bleiben bei Deutsch", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(pickLang({ ipCountry: "us", bot: true })).toBe("de");
  });
  it("Datumsformat: USA im US-Format", () => {
    expect(localeFor("en", "us")).toBe("en-US");
    expect(localeFor("en", "gb")).toBe("en-GB");
    expect(localeFor("de", "at")).toBe("de-AT");
    expect(localeFor("es", "co")).toBe("es-CO");
  });
});
