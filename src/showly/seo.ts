/* SEO-Metadaten je Route und Sprache + hreflang-Alternativen.
   Sprachvarianten werden über ?lang=de|en|es ausgeliefert. */
import type { Lang } from "./data";

/* Öffentliche Adresse. Mit eigener Domain (etwa https://showly.de) in Lovable
   unter Secrets VITE_SITE_URL setzen; dann zeigen Canonical, Sitemap und
   Vorschaubilder auf die Domain, unter der Google die Seite finden soll. */
export const SITE = (
  (import.meta.env?.["VITE_SITE_URL"] as string | undefined) || "https://app-maker-magic-588.lovable.app"
).replace(/\/+$/, "");

/** Vorschaubild beim Teilen (WhatsApp, Facebook, X) und für Google, 1200 × 630 */
export const OG_IMAGE = `${SITE}/og-showly.jpg`;

/* Social-Media-Profile von Showly; Google verknüpft sie über "sameAs" mit
   der Website (Footer.tsx nutzt dieselben Adressen). */
export const SOCIAL_PROFILES = [
  "https://www.instagram.com/__showly__/",
  "https://www.facebook.com/profile.php?id=61595200046446",
  "https://www.tiktok.com/@showly938",
  "https://x.com/__showly__",
];

/** Strukturierte Daten (schema.org) für die Startseite: Google zeigt damit
 *  Name, Logo und Social-Media-Profile von Showly im Suchergebnis an. */
export function siteJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "Showly",
        url: `${SITE}/`,
        logo: `${SITE}/logo-showly-512.png`,
        sameAs: SOCIAL_PROFILES,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        name: "Showly",
        alternateName: "Showly – Künstler & Event-Acts buchen",
        url: `${SITE}/`,
        inLanguage: ["de", "en", "es"],
        publisher: { "@id": `${SITE}/#organization` },
      },
    ],
  }).replace(/</g, "\\u003c");
}
export const LANGS: Lang[] = ["de", "en", "es"];
export const DEFAULT_LANG: Lang = "de";

export interface SeoText {
  title: string;
  description: string;
}

/* Schlüssel = Routenpfad-Muster */
export const SEO: Record<string, Record<Lang, SeoText>> = {
  "/": {
    de: {
      title: "Showly – Künstler & Event-Acts online buchen",
      description:
        "Zauberer, Märchenfiguren, DJs und Eventplaner mit Live-Kalender buchen: Festpreis vorab, sichere Zahlung, geprüfte Profile.",
    },
    en: {
      title: "Showly – Book artists & event acts online",
      description:
        "Book magicians, character performers, DJs and event planners with a live calendar: fixed price up front, secure payment, verified profiles.",
    },
    es: {
      title: "Showly – Reserva artistas y espectáculos online",
      description:
        "Reserva magos, personajes, DJs y organizadores de eventos con calendario en vivo: precio fijo, pago seguro y perfiles verificados.",
    },
  },
  "/shop": {
    de: {
      title: "Kostüme & Deko – mieten oder kaufen | Showly",
      description:
        "Profi-Kostüme und Party-Deko wie Ballons, Lichterketten und Tischdeko – tageweise mieten oder direkt kaufen.",
    },
    en: {
      title: "Costumes & decor – rent or buy | Showly",
      description:
        "Professional costumes and party decor like balloons, fairy lights and table decor – rent by the day or buy.",
    },
    es: {
      title: "Disfraces y decoración – alquila o compra | Showly",
      description:
        "Disfraces profesionales y decoración de fiesta como globos, luces y mesa: alquiler por días o compra.",
    },
  },
  "/mitmachen": {
    de: {
      title: "Künstler werden – als Act oder Planer auf Showly starten",
      description:
        "Kostenlos registrieren, eigenen Kalender führen, 80 % der Gage bekommen: So wirst du Showly-Künstler oder Eventplaner.",
    },
    en: {
      title: "Become an artist – start as an act or planner on Showly",
      description:
        "Sign up for free, manage your own calendar and keep 80% of your fee: become a Showly artist or event planner.",
    },
    es: {
      title: "Hazte artista – empieza como act o planificador en Showly",
      description:
        "Regístrate gratis, gestiona tu calendario y recibe el 80 % de tu caché: conviértete en artista u organizador de Showly.",
    },
  },
  "/dashboard": {
    de: {
      title: "Dashboard – Buchungen, Bestellungen & Kalender | Showly",
      description:
        "Behalte Buchungen, Shop-Bestellungen, Favoriten und deinen Verfügbarkeitskalender an einem Ort im Blick.",
    },
    en: {
      title: "Dashboard – bookings, orders & calendar | Showly",
      description:
        "Keep bookings, shop orders, favourites and your availability calendar in one place.",
    },
    es: {
      title: "Panel – reservas, pedidos y calendario | Showly",
      description:
        "Gestiona reservas, pedidos de la tienda, favoritos y tu calendario de disponibilidad en un solo lugar.",
    },
  },
  "/kuenstler/$id": {
    de: {
      title: "Künstlerprofil – Termine, Preise & Buchung | Showly",
      description:
        "Profil ansehen, freie Termine im Kalender prüfen, Figur oder Paket wählen und direkt zum Festpreis buchen.",
    },
    en: {
      title: "Artist profile – dates, prices & booking | Showly",
      description:
        "View the profile, check free dates in the calendar, pick a character or package and book at a fixed price.",
    },
    es: {
      title: "Perfil de artista – fechas, precios y reserva | Showly",
      description:
        "Consulta el perfil, revisa las fechas libres, elige personaje o paquete y reserva a precio fijo.",
    },
  },
  "/rechtliches/$doc": {
    de: {
      title: "Rechtliches & Datenschutz | Showly",
      description:
        "Impressum, Datenschutz, Sicherheit, Cookies und AGB von Showly – transparent und übersichtlich.",
    },
    en: {
      title: "Legal & privacy | Showly",
      description:
        "Imprint, privacy policy, security, cookies and terms of Showly – transparent and easy to read.",
    },
    es: {
      title: "Aviso legal y privacidad | Showly",
      description:
        "Aviso legal, privacidad, seguridad, cookies y condiciones de Showly, de forma transparente.",
    },
  },
  "/widerruf": {
    de: {
      title: "Vertrag widerrufen | Showly",
      description: "Einen Kauf über Showly online widerrufen: Erklärung abgeben, bestätigen, Eingangsbestätigung per E-Mail.",
    },
    en: {
      title: "Withdraw from contract | Showly",
      description: "Withdraw from a purchase made through Showly online: submit, confirm, receive an email acknowledgement.",
    },
    es: {
      title: "Desistir del contrato | Showly",
      description: "Desiste en línea de una compra hecha en Showly: envía, confirma y recibe un acuse por correo.",
    },
  },
  "/anmelden": {
    de: {
      title: "Anmelden – mit Google, E-Mail oder Telefon | Showly",
      description:
        "Melde dich an: mit Google oder Apple, einem Code per E-Mail oder aufs Handy oder mit deinem Passwort.",
    },
    en: {
      title: "Sign in – with Google, email or phone | Showly",
      description: "Sign in with Google or Apple, a code by email or text, or your password.",
    },
    es: {
      title: "Entrar – con Google, correo o teléfono | Showly",
      description: "Entra con Google o Apple, un código por correo o SMS, o tu contraseña.",
    },
  },
  "/konto": {
    de: {
      title: "Konto – anmelden oder registrieren | Showly",
      description:
        "Melde dich an oder lege in einer Minute ein Konto an: Buchungen, Favoriten und Bewertungen an einem Ort.",
    },
    en: {
      title: "Account – sign in or register | Showly",
      description:
        "Sign in or create an account in a minute: bookings, favourites and reviews in one place.",
    },
    es: {
      title: "Cuenta – entrar o registrarse | Showly",
      description:
        "Entra o crea una cuenta en un minuto: reservas, favoritos y reseñas en un mismo sitio.",
    },
  },
  "/blog": {
    de: {
      title: "Event-Blog – Fotos und Videos eurer Feiern | Showly",
      description:
        "Gäste zeigen ihre Feiern: Fotos, Videos und Berichte von Auftritten mit Showly-Künstlern.",
    },
    en: {
      title: "Event blog – photos and videos from your parties | Showly",
      description:
        "Guests share their celebrations: photos, videos and stories from shows with Showly artists.",
    },
    es: {
      title: "Blog de eventos – fotos y vídeos de vuestras fiestas | Showly",
      description:
        "Los invitados muestran sus fiestas: fotos, vídeos e historias de actuaciones con artistas de Showly.",
    },
  },
  "/portal": {
    de: {
      title: "Künstler-Portal | Showly",
      description:
        "Buchungen ansehen, bearbeiten oder absagen, Profil und freie Termine pflegen – dein Showly-Portal.",
    },
    en: {
      title: "Artist portal | Showly",
      description:
        "View, edit or cancel bookings and manage your profile and open dates – your Showly portal.",
    },
    es: {
      title: "Portal de artistas | Showly",
      description:
        "Consulta, edita o cancela reservas y gestiona tu perfil y tus fechas libres en Showly.",
    },
  },
  "/torten": {
    de: {
      title: "Torten, Kuchen & Candy Bars für dein Event | Showly",
      description:
        "Hochzeitstorten, Motivtorten, Cupcakes und Candy Bars von Konditoreien und privaten Bäckerinnen und Bäckern in deiner Nähe anfragen.",
    },
    en: {
      title: "Cakes, sweets & candy bars for your event | Showly",
      description:
        "Request wedding cakes, themed cakes, cupcakes and candy bars from patisseries and home bakers near you.",
    },
    es: {
      title: "Tartas, dulces y candy bars para tu evento | Showly",
      description:
        "Solicita tartas de boda, tartas temáticas, cupcakes y candy bars a pastelerías y reposteros particulares cerca de ti.",
    },
  },
  "/torten/$id": {
    de: {
      title: "Anbieterprofil – Torten & Süßes | Showly",
      description: "Profil, Fotos, Angebote und Preise – direkt eine Torte oder Candy Bar anfragen.",
    },
    en: {
      title: "Baker profile – cakes & sweets | Showly",
      description: "Profile, photos, offers and prices – request a cake or candy bar directly.",
    },
    es: {
      title: "Perfil de repostería – tartas y dulces | Showly",
      description: "Perfil, fotos, ofertas y precios: solicita una tarta o candy bar directamente.",
    },
  },
  "/torten/anbieten": {
    de: {
      title: "Torten anbieten – auch als Privatperson | Showly",
      description:
        "Eigenes Profil anlegen, Fotos hochladen, Torten, Kuchen und Candy Bars anbieten. Für Konditoreien und Hobbybäcker.",
    },
    en: {
      title: "Sell cakes – also as a home baker | Showly",
      description:
        "Create your profile, upload photos and offer cakes, bakes and candy bars. For patisseries and home bakers.",
    },
    es: {
      title: "Vende tartas, también como particular | Showly",
      description:
        "Crea tu perfil, sube fotos y ofrece tartas, bizcochos y candy bars. Para pastelerías y reposteros caseros.",
    },
  },
};

export const OG_LOCALE: Record<Lang, string> = { de: "de_DE", en: "en_GB", es: "es_ES" };

export function seoText(key: string, lang: Lang): SeoText | null {
  const entry = SEO[key];
  return entry ? entry[lang] : null;
}

/** Adresse einer Sprachfassung: Deutsch ohne Zusatz, sonst ?lang=en|es */
export function langUrl(path: string, lang: Lang): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === DEFAULT_LANG ? `${SITE}${clean}` : `${SITE}${clean}?lang=${lang}`;
}

/** hreflang-Links + selbstreferenzierendes Canonical für eine konkrete URL.
 *  Jede Sprachfassung hat ihre eigene Adresse; Google zeigt Suchenden aus den
 *  USA die englische, aus Spanien die spanische und aus Deutschland die
 *  deutsche Fassung. */
export function hreflangLinks(path: string, lang: Lang = DEFAULT_LANG) {
  return [
    { rel: "canonical", href: langUrl(path, lang) },
    ...LANGS.map((l) => ({ rel: "alternate", hrefLang: l, href: langUrl(path, l) })),
    { rel: "alternate", hrefLang: "x-default", href: langUrl(path, DEFAULT_LANG) },
  ];
}

/** Sprache der aufgerufenen Adresse im head()-Kontext einer Route
 *  (aus ?lang der Wurzel-Route, die alle Parameter sieht) */
export function headLang(ctx: { matches?: ReadonlyArray<{ search?: unknown }> } | undefined): Lang {
  const s = ctx?.matches?.[0]?.search as { lang?: unknown } | undefined;
  const v = String(s?.lang ?? "").toLowerCase();
  return v === "en" || v === "es" ? v : DEFAULT_LANG;
}

/** Vollständiger head()-Block (Standardsprache im SSR-HTML + hreflang). */
export function seoHead(key: string, path: string, lang: Lang = DEFAULT_LANG) {
  const t = seoText(key, lang) ?? seoText(key, DEFAULT_LANG)!;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const url = langUrl(clean, lang);
  return {
    meta: [
      { title: t.title },
      { name: "description", content: t.description },
      { name: "language", content: lang },
      /* OpenGraph */
      { property: "og:site_name", content: "Showly" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: t.title },
      { property: "og:description", content: t.description },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Showly – Künstler, Torten, Kostüme und Deko für dein Event" },
      { property: "og:locale", content: OG_LOCALE[lang] },
      ...LANGS.filter((l) => l !== lang).map((l) => ({
        property: "og:locale:alternate",
        content: OG_LOCALE[l],
      })),
      /* Twitter / X */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: t.title },
      { name: "twitter:description", content: t.description },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:site", content: "@__showly__" },
    ],
    links: hreflangLinks(clean, lang),
  };
}
