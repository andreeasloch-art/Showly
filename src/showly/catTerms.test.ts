import { describe, expect, it } from "vitest";
import { catScore } from "./catTerms";

const hit = (cat: string, q: string, label: string) => catScore(cat, q, label) > 0;

describe("Suchbegriffe je Kategorie", () => {
  it("findet Zauberer auch über Magier und Zauberkünstler", () => {
    expect(hit("magician", "Magier", "Zauberer")).toBe(true);
    expect(hit("magician", "zauberk", "Zauberer")).toBe(true);
    expect(hit("magician", "magician", "Zauberer")).toBe(true);
  });

  it("findet Musiker auch über Sänger, mit und ohne Umlaut", () => {
    expect(hit("musician", "Sänger", "Musiker")).toBe(true);
    expect(hit("musician", "Saengerin", "Musiker")).toBe(true);
    expect(hit("musician", "Gesang", "Musiker")).toBe(true);
  });

  it("ordnet den Namen der Kategorie vor ähnlichen Wörtern", () => {
    expect(catScore("magician", "Zau", "Zauberer")).toBeGreaterThan(catScore("magician", "Mag", "Zauberer"));
  });

  it("findet Kategorien in längeren Eingaben", () => {
    expect(hit("magician", "Zauberer für Kindergeburtstag", "Zauberer")).toBe(true);
  });

  it("liefert nichts Falsches", () => {
    expect(hit("magician", "Sänger", "Zauberer")).toBe(false);
    expect(hit("dj", "Zauberer", "DJs")).toBe(false);
    expect(hit("clown", "", "Clowns")).toBe(false);
  });
});
