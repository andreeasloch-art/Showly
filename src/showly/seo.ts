/* SEO-Metadaten je Route und Sprache + hreflang-Alternativen.
   Sprachvarianten werden über ?lang=de|en|es ausgeliefert. */
import type { Lang } from "./data";

export const SITE = "https://app-maker-magic-588.lovable.app";
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
        "Kostenlos registrieren, eigenen Kalender führen, 100 % der Gage behalten: So wirst du Showly-Künstler oder Eventplaner.",
    },
    en: {
      title: "Become an artist – start as an act or planner on Showly",
      description:
        "Sign up for free, manage your own calendar and keep 100% of your fee: become a Showly artist or event planner.",
    },
    es: {
      title: "Hazte artista – empieza como act o planificador en Showly",
      description:
        "Regístrate gratis, gestiona tu calendario y quédate el 100 % de tu caché: conviértete en artista u organizador de Showly.",
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
  "/anmelden": {
    de: {
      title: "Anmelden – mit Google, E-Mail oder Telefon | Showly",
      description:
        "Melde dich ohne Passwort an: mit Google, einem Code per E-Mail oder einem Code aufs Handy.",
    },
    en: {
      title: "Sign in – with Google, email or phone | Showly",
      description: "Sign in without a password: Google, an email code or a code to your phone.",
    },
    es: {
      title: "Entrar – con Google, correo o teléfono | Showly",
      description: "Entra sin contraseña: Google, un código por correo o un código al móvil.",
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

/** hreflang-Links + selbstreferenzierendes Canonical für eine konkrete URL. */
export function hreflangLinks(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return [
    { rel: "canonical", href: `${SITE}${clean}` },
    ...LANGS.map((l) => ({
      rel: "alternate",
      hrefLang: l,
      href: `${SITE}${clean}?lang=${l}`,
    })),
    { rel: "alternate", hrefLang: "x-default", href: `${SITE}${clean}` },
  ];
}

/** Vollständiger head()-Block (Standardsprache im SSR-HTML + hreflang). */
export function seoHead(key: string, path: string, lang: Lang = DEFAULT_LANG) {
  const t = seoText(key, lang) ?? seoText(key, DEFAULT_LANG)!;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const url = `${SITE}${clean}`;
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
      { property: "og:locale", content: OG_LOCALE[lang] },
      ...LANGS.filter((l) => l !== lang).map((l) => ({
        property: "og:locale:alternate",
        content: OG_LOCALE[l],
      })),
      /* Twitter / X */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: t.title },
      { name: "twitter:description", content: t.description },
    ],
    links: hreflangLinks(clean),
  };
}
