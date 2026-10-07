import { describe, expect, it } from "vitest";
import { ARTISTS, type Artist } from "./data";
import { artistGraph, faqGraph, profileIndexable, siteGraph } from "./schema";

const real: Artist = {
  id: 100001,
  cat: "band",
  color: "#fff",
  price: 400,
  rating: 0,
  reviews: 0,
  name: { de: "Die Feierband", en: "Die Feierband" },
  loc: { de: "Stuttgart", en: "Stuttgart" },
  desc: { de: "x".repeat(200), en: "x".repeat(200) },
  photos: [{ id: "c:1", kind: "image", ratio: 1 }],
  fromDb: true,
};

describe("Strukturierte Daten", () => {
  it("Beispielprofile kommen nie in den Suchindex", () => {
    expect(ARTISTS.filter((a) => a.demo).some(profileIndexable)).toBe(false);
  });

  it("dünne echte Profile bleiben noindex, gepflegte werden indexiert", () => {
    expect(profileIndexable(real)).toBe(true);
    expect(profileIndexable({ ...real, desc: { de: "kurz", en: "short" } })).toBe(false);
    expect(profileIndexable({ ...real, photos: [] })).toBe(false);
  });

  it("Band wird PerformingGroup, ohne erfundene Bewertungen", () => {
    const g = JSON.parse(artistGraph(real, "de", "Bands"))["@graph"];
    const page = g.find((n: { "@type": string }) => n["@type"] === "ProfilePage");
    expect(page.mainEntity["@type"]).toBe("PerformingGroup");
    expect(page.mainEntity.aggregateRating).toBeUndefined();
    expect(g.find((n: { "@type": string }) => n["@type"] === "Service").offers.priceCurrency).toBe("EUR");
  });

  it("echte Bewertungen erscheinen als AggregateRating", () => {
    const g = JSON.parse(artistGraph({ ...real, cat: "magician", rating: 4.8, reviews: 12 }, "en", "Magicians"))["@graph"];
    const p = g.find((n: { "@type": string }) => n["@type"] === "ProfilePage").mainEntity;
    expect(p["@type"]).toBe("Person");
    expect(p.aggregateRating.reviewCount).toBe(12);
  });

  it("Organisation ohne erfundene Firmendaten", () => {
    const org = JSON.parse(siteGraph("de"))["@graph"][0];
    expect(org.name).toBe("Showly");
    expect(org.founder).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(org.sameAs.length).toBeGreaterThan(0);
  });

  it("FAQPage enthält genau die übergebenen Fragen", () => {
    const g = JSON.parse(faqGraph("de", "/hilfe", "Hilfe", [["Frage?", "Antwort."]]))["@graph"][0];
    expect(g.mainEntity).toHaveLength(1);
    expect(g.mainEntity[0].acceptedAnswer.text).toBe("Antwort.");
  });
});
