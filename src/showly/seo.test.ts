/* Tests: ?lang-Parameter, Deep-Links, Prioritätslogik und SEO-Metadaten */
import { describe, expect, it } from "vitest";
import { LANGS, SEO, SITE, hreflangLinks, seoHead, seoText } from "./seo";
import { langFromUrl } from "./store";
import { buildSitemapXml } from "@/routes/sitemap[.]xml";
import type { Lang } from "./data";

const ROUTES: [string, string][] = [
  ["/", "/"],
  ["/shop", "/shop"],
  ["/mitmachen", "/mitmachen"],
  ["/dashboard", "/dashboard"],
  ["/portal", "/portal"],
  ["/kuenstler/$id", "/kuenstler/3"],
  ["/rechtliches/$doc", "/rechtliches/privacy"],
  ["/anmelden", "/anmelden"],
  ["/konto", "/konto"],
  ["/blog", "/blog"],
  ["/torten", "/torten"],
  ["/torten/$id", "/torten/1"],
  ["/torten/anbieten", "/torten/anbieten"],
];

/* Priorität: ?lang > gespeicherte Auswahl > Erkennung */
function resolveLang(search: string, stored: string | null, detected: Lang): Lang {
  const fromUrl = langFromUrl(search);
  if (fromUrl) return fromUrl;
  if (stored === "de" || stored === "en" || stored === "es") return stored;
  return detected;
}

describe("langFromUrl", () => {
  it("erkennt gültige Werte unabhängig von Groß-/Kleinschreibung", () => {
    expect(langFromUrl("?lang=de")).toBe("de");
    expect(langFromUrl("?lang=EN")).toBe("en");
    expect(langFromUrl("?lang=Es")).toBe("es");
  });

  it("ignoriert ungültige oder fehlende Werte", () => {
    for (const q of ["", "?lang=", "?lang=xx", "?lang=fr", "?foo=en", "?lang=de-DE"]) {
      expect(langFromUrl(q)).toBeNull();
    }
  });

  it("funktioniert mit weiteren Query-Parametern und Deep-Links", () => {
    expect(langFromUrl("?city=Berlin&lang=es&date=2026-01-01")).toBe("es");
  });
});

describe("Sprach-Priorität", () => {
  it("URL schlägt gespeicherte Auswahl und Erkennung", () => {
    expect(resolveLang("?lang=es", "de", "en")).toBe("es");
  });
  it("gespeicherte Auswahl schlägt Erkennung", () => {
    expect(resolveLang("", "en", "de")).toBe("en");
  });
  it("Erkennung greift ohne URL und ohne Speicher", () => {
    expect(resolveLang("", null, "es")).toBe("es");
  });
  it("ungültiges ?lang fällt auf Speicher, sonst Erkennung zurück", () => {
    expect(resolveLang("?lang=zz", "en", "de")).toBe("en");
    expect(resolveLang("?lang=zz", null, "es")).toBe("es");
    expect(resolveLang("?lang=zz", "kaputt", "de")).toBe("de");
  });
});

describe("Übersetzte Titel und Meta-Tags", () => {
  it("liefert für jede Route und Sprache eigene Texte", () => {
    for (const [key] of ROUTES) {
      const titles = new Set<string>();
      for (const l of LANGS) {
        const t = seoText(key, l)!;
        expect(t.title.length).toBeGreaterThan(10);
        expect(t.description.length).toBeGreaterThan(30);
        titles.add(t.title);
      }
      expect(titles.size).toBe(LANGS.length);
    }
  });

  it("setzt og/twitter-Tags passend zur Sprache", () => {
    for (const [key, path] of ROUTES) {
      for (const l of LANGS) {
        const head = seoHead(key, path, l);
        const meta = Object.fromEntries(
          head.meta
            .filter((m) => "name" in m || "property" in m)
            .map((m) => [
              (m as { name?: string; property?: string }).name ??
                (m as { property?: string }).property,
              (m as { content?: string }).content,
            ]),
        );
        const t = seoText(key, l)!;
        expect((head.meta[0] as { title?: string }).title).toBe(t.title);
        expect(meta["description"]).toBe(t.description);
        expect(meta["og:title"]).toBe(t.title);
        expect(meta["og:description"]).toBe(t.description);
        expect(meta["og:url"]).toBe(`${SITE}${path}`);
        expect(meta["twitter:card"]).toBe("summary_large_image");
        expect(meta["twitter:title"]).toBe(t.title);
        expect(meta["language"]).toBe(l);
        expect(meta["og:locale"]).toBe({ de: "de_DE", en: "en_GB", es: "es_ES" }[l]);
        const alts = head.meta.filter(
          (m) => (m as { property?: string }).property === "og:locale:alternate",
        );
        expect(alts).toHaveLength(LANGS.length - 1);
      }
    }
  });

  it("fällt bei unbekannter Route nicht um", () => {
    expect(seoText("/gibtsnicht", "de")).toBeNull();
  });
});

describe("hreflang und Canonical", () => {
  it("liefert selbstreferenzierendes Canonical plus alle Sprachen inkl. x-default", () => {
    for (const [, path] of ROUTES) {
      const links = hreflangLinks(path);
      const canonical = links.filter((l) => l.rel === "canonical");
      expect(canonical).toHaveLength(1);
      expect(canonical[0]!.href).toBe(`${SITE}${path}`);
      const alts = links.filter((l) => l.rel === "alternate");
      expect(alts.map((l) => l.hrefLang)).toEqual([...LANGS, "x-default"]);
      for (const l of LANGS) {
        expect(alts.find((a) => a.hrefLang === l)!.href).toBe(`${SITE}${path}?lang=${l}`);
      }
    }
  });

  it("hreflang ist auf jeder Route Teil des head()", () => {
    for (const [key, path] of ROUTES) {
      expect(seoHead(key, path).links).toEqual(hreflangLinks(path));
    }
  });
});

describe("sitemap.xml", () => {
  const xml = buildSitemapXml();

  it("enthält alle öffentlichen Routen", () => {
    for (const p of ["/", "/shop", "/mitmachen", "/kuenstler/1", "/rechtliches/imprint"]) {
      expect(xml).toContain(`<loc>${SITE}${p}</loc>`);
    }
  });

  it("verlinkt jede Sprachvariante per hreflang", () => {
    for (const l of LANGS) {
      expect(xml).toContain(`hreflang="${l}" href="${SITE}/shop?lang=${l}"`);
    }
    expect(xml).toContain(`hreflang="x-default" href="${SITE}/shop"`);
  });

  it("führt keine privaten Routen wie /dashboard oder /portal", () => {
    expect(xml).not.toContain("<loc>" + SITE + "/dashboard</loc>");
    expect(xml).not.toContain("<loc>" + SITE + "/portal</loc>");
  });
});

describe("SEO-Tabelle", () => {
  it("deckt genau die erwarteten Routen ab", () => {
    expect(Object.keys(SEO).sort()).toEqual(ROUTES.map(([k]) => k).sort());
  });
});
