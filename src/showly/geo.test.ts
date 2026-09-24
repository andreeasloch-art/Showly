import { describe, expect, it } from "vitest";
import {
  cityPool,
  createGeoCache,
  ES_CITIES,
  filterCities,
  isSpanishSpeaking,
  normalize,
  parseFeatures,
  photonUrl,
  rankMatches,
  rankScore,
  highlightSegments,
  scopeFromSearch,
  searchWithScope,
} from "./geo";

describe("normalize", () => {
  it("entfernt Diakritika und Groß-/Kleinschreibung", () => {
    expect(normalize("  Málaga ")).toBe("malaga");
    expect(normalize("Bogotá")).toBe("bogota");
    expect(normalize("Ciudad de México")).toBe("ciudad de mexico");
  });
});

describe("cityPool", () => {
  it("liefert im Scope 'es' nur spanischsprachige Städte", () => {
    const pool = cityPool("es", ["Berlin"]);
    expect(pool).toContain("Madrid");
    expect(pool).toContain("Buenos Aires");
    expect(pool).not.toContain("Berlin");
    expect(pool).not.toContain("London");
    expect(pool.length).toBe(new Set(ES_CITIES).size);
  });

  it("liefert weltweit deutsche, englische und spanische Städte", () => {
    const pool = cityPool("world", ["Berlin"]);
    expect(pool).toContain("Hamburg");
    expect(pool).toContain("London");
    expect(pool).toContain("Lima");
  });
});

describe("filterCities", () => {
  const pool = cityPool("es");

  it("findet Spanien-Treffer", () => {
    expect(filterCities(pool, "madr")).toContain("Madrid");
    expect(filterCities(pool, "barcel")).toContain("Barcelona");
  });

  it("findet Lateinamerika-Treffer", () => {
    expect(filterCities(pool, "bogo")).toContain("Bogotá");
    expect(filterCities(pool, "buenos")).toContain("Buenos Aires");
    expect(filterCities(pool, "monte")).toContain("Montevideo");
  });

  it("ignoriert Akzente in beide Richtungen", () => {
    expect(filterCities(pool, "malaga")).toContain("Málaga");
    expect(filterCities(pool, "Málaga")).toContain("Málaga");
    expect(filterCities(pool, "mexico")).toContain("Ciudad de México");
  });

  it("verarbeitet Sonderzeichen ohne Absturz", () => {
    expect(filterCities(pool, "ñ")).toEqual(expect.any(Array));
    expect(filterCities(pool, "(")).toEqual(expect.any(Array));
    expect(filterCities(pool, "san josé (")).toContain("San José (Costa Rica)");
    expect(() => filterCities(pool, "a+b*?[")).not.toThrow();
  });

  it("liefert leere Liste ohne Treffer", () => {
    expect(filterCities(pool, "zzzzqqq")).toEqual([]);
  });

  it("priorisiert Präfix-Treffer und begrenzt die Anzahl", () => {
    const res = filterCities(pool, "san", 6);
    expect(res.length).toBeLessThanOrEqual(6);
    expect(normalize(res[0]!).startsWith("san")).toBe(true);
  });

  it("zeigt bei leerer Eingabe Standardvorschläge", () => {
    expect(filterCities(pool, "", 8).length).toBe(8);
  });
});

describe("photonUrl", () => {
  it("setzt Sprache und Query", () => {
    const url = photonUrl("Málaga", "es", "world");
    expect(url).toContain("lang=es");
    expect(url).toContain("q=M%C3%A1laga");
    expect(url).not.toContain("lat=");
  });

  it("biast im Scope 'es' auf die Region", () => {
    expect(photonUrl("centro", "es", "es")).toContain("lat=19.43");
  });
});

describe("parseFeatures", () => {
  const json = {
    features: [
      { properties: { name: "Gran Vía", street: "Gran Vía", housenumber: "1", postcode: "28013", city: "Madrid", state: "Madrid", country: "Spain", countrycode: "ES" } },
      { properties: { name: "Palermo", city: "Buenos Aires", country: "Argentina", countrycode: "AR" } },
      { properties: { name: "Mitte", city: "Berlin", country: "Germany", countrycode: "DE" } },
    ],
  };

  it("filtert im Scope 'es' auf spanischsprachige Länder", () => {
    const res = parseFeatures(json, "es");
    expect(res.some((r) => r.includes("Madrid"))).toBe(true);
    expect(res.some((r) => r.includes("Buenos Aires"))).toBe(true);
    expect(res.some((r) => r.includes("Berlin"))).toBe(false);
  });

  it("behält im Scope 'world' alle Treffer", () => {
    expect(parseFeatures(json, "world")).toHaveLength(3);
  });

  it("kommt mit leeren oder kaputten Antworten klar", () => {
    expect(parseFeatures(null, "es")).toEqual([]);
    expect(parseFeatures({}, "world")).toEqual([]);
    expect(parseFeatures({ features: [{}] }, "world")).toEqual([]);
  });

  it("dedupliziert identische Labels", () => {
    const dup = { features: [json.features[1]!, json.features[1]!] };
    expect(parseFeatures(dup, "es")).toHaveLength(1);
  });
});

describe("isSpanishSpeaking", () => {
  it("erkennt Ländercodes und Ländernamen", () => {
    expect(isSpanishSpeaking({ countrycode: "MX" })).toBe(true);
    expect(isSpanishSpeaking({ countrycode: "GQ" })).toBe(true);
    expect(isSpanishSpeaking({ countrycode: "FR" })).toBe(false);
    expect(isSpanishSpeaking({ country: "España" })).toBe(true);
    expect(isSpanishSpeaking({ country: "Deutschland" })).toBe(false);
    expect(isSpanishSpeaking({})).toBe(false);
  });
});

describe("createGeoCache", () => {
  it("cached und verdrängt nach LRU", () => {
    const c = createGeoCache(2);
    c.set("a", ["A"]);
    c.set("b", ["B"]);
    expect(c.get("a")).toEqual(["A"]);
    c.set("c", ["C"]);
    expect(c.size).toBe(2);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toEqual(["A"]);
  });
});

describe("highlightSegments", () => {
  it("markiert exakte Treffer", () => {
    expect(highlightSegments("Madrid", "mad")).toEqual([
      { text: "Mad", match: true },
      { text: "rid", match: false },
    ]);
  });

  it("markiert akzentunabhängig an der richtigen Stelle", () => {
    expect(highlightSegments("Málaga", "mala")).toEqual([
      { text: "Mála", match: true },
      { text: "ga", match: false },
    ]);
    expect(highlightSegments("Bogotá", "tá")).toEqual([
      { text: "Bogo", match: false },
      { text: "tá", match: true },
    ]);
  });

  it("markiert mehrere Vorkommen", () => {
    const segs = highlightSegments("San José (Costa Rica)", "a");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(["a", "a", "a"]);
    expect(segs.map((s) => s.text).join("")).toBe("San José (Costa Rica)");
  });

  it("behandelt Sonderzeichen und leere Query", () => {
    expect(highlightSegments("San Juan (Puerto Rico)", "(pue")).toEqual([
      { text: "San Juan ", match: false },
      { text: "(Pue", match: true },
      { text: "rto Rico)", match: false },
    ]);
    expect(highlightSegments("Madrid", "  ")).toEqual([{ text: "Madrid", match: false }]);
    expect(highlightSegments("Madrid", "zz")).toEqual([{ text: "Madrid", match: false }]);
  });
});

describe("scope in URL", () => {
  it("liest den geo-Parameter", () => {
    expect(scopeFromSearch("?geo=es")).toBe("es");
    expect(scopeFromSearch("geo=ES&lang=de")).toBe("es");
    expect(scopeFromSearch("?geo=xx")).toBe("world");
    expect(scopeFromSearch("")).toBe("world");
  });

  it("setzt und entfernt den Parameter ohne andere zu verlieren", () => {
    expect(searchWithScope("?lang=es", "es")).toBe("?lang=es&geo=es");
    expect(searchWithScope("?lang=es&geo=es", "world")).toBe("?lang=es");
    expect(searchWithScope("?geo=es", "world")).toBe("");
    expect(searchWithScope("", "es")).toBe("?geo=es");
  });
});

describe("rankMatches", () => {
  it("stellt exakte Treffer vor Präfix-, Wortanfangs- und Enthalten-Treffer", () => {
    const pool = ["Leonberg", "León", "Nuevo León", "Leonding", "Villa de Leones"];
    expect(rankMatches(pool, "leon")).toEqual([
      "León",
      "Leonberg",
      "Leonding",
      "Nuevo León",
      "Villa de Leones",
    ]);
  });

  it("ist akzentunabhängig und behandelt Sonderzeichen", () => {
    expect(rankScore("Málaga", "malaga")).toBe(0);
    expect(rankScore("Bogotá", "bogo")).toBe(1);
    expect(rankScore("San Juan (Puerto Rico)", "puerto")).toBe(2);
    expect(rankScore("Ciudad de México", "de")).toBe(2);
    expect(rankScore("Madrid", "adri")).toBe(3);
    expect(rankScore("Madrid", "zz")).toBe(-1);
  });

  it("dedupliziert, respektiert das Limit und liefert bei leerer Query alles", () => {
    expect(rankMatches(["Madrid", "Madrid", "Marbella"], "ma")).toEqual(["Madrid", "Marbella"]);
    expect(rankMatches(["Madrid", "Marbella", "Malaga"], "ma", 2)).toHaveLength(2);
    expect(rankMatches(["Madrid", "Lima"], "")).toHaveLength(2);
  });

  it("bevorzugt bei gleichem Score den kürzeren Ortsnamen", () => {
    expect(rankMatches(["Santa Cruz de la Sierra", "Santa Marta"], "santa")[0]).toBe("Santa Marta");
  });
});

/** Minimales History-Modell (Node-Umgebung ohne jsdom). */
function createHistory(initial: string) {
  const stack = [initial];
  let idx = 0;
  return {
    get url() {
      return stack[idx]!;
    },
    get search() {
      const i = stack[idx]!.indexOf("?");
      return i === -1 ? "" : stack[idx]!.slice(i);
    },
    push(url: string) {
      stack.splice(idx + 1);
      stack.push(url);
      idx = stack.length - 1;
    },
    replace(url: string) {
      stack[idx] = url;
    },
    back() {
      idx = Math.max(0, idx - 1);
    },
    forward() {
      idx = Math.min(stack.length - 1, idx + 1);
    },
  };
}

describe("?geo=es – Deep-Link und History", () => {
  it("stellt den Scope bei direktem Deep-Link her", () => {
    expect(scopeFromSearch(createHistory("/?geo=es").search)).toBe("es");
    expect(scopeFromSearch(createHistory("/?lang=es&geo=ES&q=madrid").search)).toBe("es");
    expect(scopeFromSearch(createHistory("/kuenstler/a1").search)).toBe("world");
  });

  it("stellt den Scope bei Back/Forward zuverlässig wieder her", () => {
    const h = createHistory("/?lang=de");
    expect(scopeFromSearch(h.search)).toBe("world");

    h.push("/" + searchWithScope(h.search, "es"));
    expect(h.url).toBe("/?lang=de&geo=es");
    expect(scopeFromSearch(h.search)).toBe("es");

    h.push("/shop");
    expect(scopeFromSearch(h.search)).toBe("world");

    h.back();
    expect(scopeFromSearch(h.search)).toBe("es");
    h.back();
    expect(scopeFromSearch(h.search)).toBe("world");
    h.forward();
    expect(scopeFromSearch(h.search)).toBe("es");
  });

  it("überschreibt den Eintrag bei replace und lässt sich zurücksetzen", () => {
    const h = createHistory("/?geo=es");
    h.replace("/" + searchWithScope(h.search, "world"));
    expect(h.url).toBe("/");
    expect(scopeFromSearch(h.search)).toBe("world");
    h.back();
    expect(scopeFromSearch(h.search)).toBe("world");
  });

  it("behält den Scope beim Wechsel anderer Parameter bei", () => {
    const h = createHistory("/?geo=es&lang=de");
    const next = new URLSearchParams(h.search.slice(1));
    next.set("lang", "es");
    h.push(`/?${next.toString()}`);
    expect(scopeFromSearch(h.search)).toBe("es");
    h.back();
    expect(scopeFromSearch(h.search)).toBe("es");
  });
});
