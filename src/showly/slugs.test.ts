import { describe, expect, it } from "vitest";
import { artistParams, artistPath, idFromSlug } from "./slugs";

describe("Sprechende Profiladressen", () => {
  it("Stadt, Kategorie, Name mit Kennung", () => {
    const a = { id: 100023, cat: "magician", name: { de: "Max Mustermann" }, loc: { de: "Berlin" } };
    expect(artistPath(a)).toBe("/kuenstler/berlin/zauberer/max-mustermann-100023");
  });
  it("Umlaute und Sonderzeichen", () => {
    const p = artistParams({ id: 7, cat: "superhero", name: { de: "Jörg „Hulk“ Weiß" }, loc: { de: "München" } });
    expect(p).toEqual({ stadt: "muenchen", kategorie: "superheld", name: "joerg-hulk-weiss-7" });
  });
  it("ohne Ort", () => {
    expect(artistParams({ id: 5, cat: "dj", name: "DJ Toni", loc: "" }).stadt).toBe("deutschland");
  });
  it("Kennung aus der Adresse", () => {
    expect(idFromSlug("max-mustermann-100023")).toBe(100023);
    expect(idFromSlug("100023")).toBe(100023);
    expect(idFromSlug("max")).toBe(0);
  });
});
