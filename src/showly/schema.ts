/* Strukturierte Daten (schema.org, JSON-LD) an einer Stelle.
 *
 * Alle Seiten beschreiben Showly mit denselben Angaben, damit Suchmaschinen
 * und KI-Suchen die Marke eindeutig als eine Entität erkennen und nicht mit
 * gleichnamigen Produkten verwechseln (etwa der App "Showly" zum Verfolgen
 * von Serien und Filmen).
 *
 * Regel: nur Angaben, die auf der Website sichtbar und wahr sind. Firmensitz,
 * Gründer, Gründungsdatum und Mitarbeiterzahl fehlen bewusst, solange das
 * Impressum Platzhalter ("Muster") enthält. Keine Bewertungssterne aus
 * Beispielprofilen. */
import type { Artist, Lang } from "./data";
import { SITE, SOCIAL_PROFILES, langUrl } from "./seo";

/** Beschreibende Ergänzung zum Namen, überall gleich */
export const BRAND_TAGLINE: Record<Lang, string> = {
  de: "Showly – Künstler & Entertainment buchen",
  en: "Showly – Artist & Entertainment Booking Platform",
  es: "Showly – Reserva de artistas y entretenimiento",
};

/** Ein Satz, der Showly definiert (gleich auf /ueber-showly und im Schema) */
export const BRAND_DEFINITION: Record<Lang, string> = {
  de: "Showly ist eine Online-Plattform, auf der man Künstler und Entertainment-Acts für private und geschäftliche Veranstaltungen findet und direkt bucht – mit Live-Kalender, Festpreis und Zahlung über die Plattform. Dazu gibt es Kostüme und Deko zum Mieten oder Kaufen sowie Torten und Süßes von Konditoreien und Hobbybäckern.",
  en: "Showly is an online platform for finding and directly booking artists and entertainment acts for private and corporate events – with a live calendar, fixed prices and payment through the platform. It also offers costumes and decorations to rent or buy, and cakes and sweets from patisseries and home bakers.",
  es: "Showly es una plataforma online para encontrar y reservar directamente artistas y espectáculos para eventos privados y de empresa, con calendario en vivo, precio fijo y pago a través de la plataforma. Además ofrece disfraces y decoración para alquilar o comprar, y tartas y dulces de pastelerías y reposteros.",
};

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

type Json = Record<string, unknown>;

export function organization(lang: Lang = "de"): Json {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Showly",
    alternateName: [BRAND_TAGLINE.de, BRAND_TAGLINE.en, "SHOWLY"],
    url: `${SITE}/`,
    logo: { "@type": "ImageObject", url: `${SITE}/logo-showly-512.png`, width: 512, height: 512 },
    image: `${SITE}/og-showly.jpg`,
    description: BRAND_DEFINITION[lang],
    sameAs: SOCIAL_PROFILES,
    /* Kontakt über die Hilfe-Seite; Telefon und Anschrift erst, wenn das
       Impressum echte Angaben hat */
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE}/hilfe`,
      availableLanguage: ["German", "English", "Spanish"],
    },
  };
}

export function website(): Json {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Showly",
    alternateName: [BRAND_TAGLINE.de, BRAND_TAGLINE.en],
    url: `${SITE}/`,
    inLanguage: ["de", "en", "es"],
    publisher: { "@id": ORG_ID },
  };
}

/** Brotkrumen: [Name, Pfad] von der Startseite bis zur aktuellen Seite */
export function breadcrumbs(items: [string, string][], lang: Lang = "de"): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: langUrl(path, lang),
    })),
  };
}

export function graph(...nodes: Json[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}

/** Startseite und alle Seiten ohne eigene Daten */
export function siteGraph(lang: Lang = "de"): string {
  return graph(organization(lang), website());
}

/** Eine Seite über Showly selbst (/ueber-showly) */
export function aboutGraph(lang: Lang, path: string, title: string, crumb: string): string {
  /* Organization und WebSite stehen schon auf jeder Seite (__root.tsx);
     hier wird nur per @id darauf verwiesen */
  return graph(
    {
      "@type": "AboutPage",
      "@id": `${langUrl(path, lang)}#page`,
      url: langUrl(path, lang),
      name: title,
      inLanguage: lang,
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": ORG_ID },
      mainEntity: { "@id": ORG_ID },
    },
    breadcrumbs([["Showly", "/"], [crumb, path]], lang),
  );
}

/** Häufige Fragen als FAQPage (nur echte, auf der Seite sichtbare Fragen) */
export function faqGraph(lang: Lang, path: string, crumb: string, qa: readonly (readonly [string, string])[]): string {
  return graph(
    {
      "@type": "FAQPage",
      "@id": `${langUrl(path, lang)}#faq`,
      url: langUrl(path, lang),
      inLanguage: lang,
      isPartOf: { "@id": WEBSITE_ID },
      mainEntity: qa.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    breadcrumbs([["Showly", "/"], [crumb, path]], lang),
  );
}

/* Sparten, die Gruppen sind (Band) statt einzelner Personen */
const GROUP_CATS = new Set(["band"]);

const txt = (v: unknown, lang: Lang): string => {
  if (typeof v === "string") return v;
  const o = (v || {}) as Record<string, string>;
  return o[lang] || o["de"] || "";
};

/** Ist ein echtes Profil reich genug für den Suchindex? Dünne Profile
 *  (kurze Beschreibung, keine Fotos) bleiben noindex, bis sie gepflegt sind. */
export function profileIndexable(a: Artist): boolean {
  if (a.demo) return false;
  if (!a["fromDb"]) return false;
  const desc = txt(a.desc, "de");
  const photos = Array.isArray(a["photos"]) ? (a["photos"] as unknown[]).length : 0;
  return desc.trim().length >= 160 && photos >= 1;
}

/** Profilseite eines echten Künstlers: ProfilePage mit Person bzw.
 *  PerformingGroup, Angebot über Showly und Brotkrumen. Bewertungen nur,
 *  wenn es echte gibt. */
export function artistGraph(a: Artist, lang: Lang, catLabel: string): string {
  const path = `/kuenstler/${a.id}`;
  const url = langUrl(path, lang);
  const name = txt(a.name, lang);
  const performer: Json = {
    "@type": GROUP_CATS.has(a.cat) ? "PerformingGroup" : "Person",
    "@id": `${url}#performer`,
    name,
    description: txt(a.desc, lang).slice(0, 500),
    url,
    ...(txt(a.loc, lang) ? { homeLocation: { "@type": "Place", name: txt(a.loc, lang) } } : {}),
    ...(GROUP_CATS.has(a.cat) ? {} : { jobTitle: catLabel }),
    knowsLanguage: Array.isArray((a.langs as { de?: string[] })?.de) ? (a.langs as { de: string[] }).de : undefined,
    ...(a.reviews > 0 && a.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(a.rating).toFixed(1),
            reviewCount: a.reviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
  const offer: Json = {
    "@type": "Offer",
    url,
    price: Number(a.price).toFixed(2),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    seller: { "@id": `${url}#performer` },
    offeredBy: { "@id": ORG_ID },
  };
  return graph(
    {
      "@type": "ProfilePage",
      "@id": `${url}#page`,
      url,
      name: `${name} – ${catLabel}`,
      inLanguage: lang,
      isPartOf: { "@id": WEBSITE_ID },
      mainEntity: performer,
      ...(a["updatedAt"] ? { dateModified: a["updatedAt"] } : {}),
    },
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: `${catLabel}: ${name}`,
      serviceType: catLabel,
      provider: { "@id": `${url}#performer` },
      broker: { "@id": ORG_ID },
      offers: offer,
    },
    breadcrumbs([["Showly", "/"], [name, path]], lang),
  );
}

/** Gewöhnliche Informationsseite mit Brotkrumen */
export function pageGraph(lang: Lang, path: string, title: string, crumb: string): string {
  return graph(
    {
      "@type": "WebPage",
      "@id": `${langUrl(path, lang)}#page`,
      url: langUrl(path, lang),
      name: title,
      inLanguage: lang,
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": ORG_ID },
    },
    breadcrumbs([["Showly", "/"], [crumb, path]], lang),
  );
}
