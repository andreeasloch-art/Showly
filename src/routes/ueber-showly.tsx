/* Über Showly: die Seite, die Suchmaschinen und KI-Suchen erklärt, was
 * Showly ist (Entity Page).
 *
 * Nur belegte Angaben aus dem Code und den AGB: Provision (pricing.ts
 * FEE_RATE), Fristen (booking.ts), Sparten (data.js CATS). Kein Firmensitz,
 * keine Gründer, keine Zahlen zu Nutzern oder Künstlern, solange es dafür
 * keine echte Quelle gibt (Impressum hat noch Platzhalter). */
import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/showly/InfoPage";
import { CATS, type Lang } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { headLang, seoHead } from "@/showly/seo";
import { BRAND_DEFINITION, aboutGraph } from "@/showly/schema";
import { catName } from "@/showly/catName";
import { FEE_RATE } from "@/showly/pricing";
import { PAYOUT_DAYS, RESPOND_HOURS } from "@/showly/booking";

const PATH = "/ueber-showly";

export const Route = createFileRoute("/ueber-showly")({
  head: (ctx) => {
    const lang = headLang(ctx);
    const c = copy(lang);
    return {
      ...seoHead(PATH, PATH, lang),
      scripts: [{ type: "application/ld+json", children: aboutGraph(lang, PATH, c.h1, c.crumb) }],
    };
  },
  component: About,
});

const pct = Math.round(FEE_RATE * 100);
const keep = 100 - pct;

function cats(lang: Lang) {
  return CATS.filter((c) => c.id !== "all")
    .map((c) => catName(c.id, lang))
    .join(", ");
}

function copy(lang: Lang) {
  if (lang === "en")
    return {
      crumb: "About Showly",
      h1: "What is Showly?",
      lead: BRAND_DEFINITION.en,
      sections: [
        {
          h: "What Showly offers",
          p: [
            "On Showly, organisers find artists and entertainment acts, see their free dates in a live calendar and book them directly at a fixed price. Payment runs through the platform.",
            `Categories on Showly: ${cats("en")}.`,
            "In addition, Showly offers costumes and decorations to rent or buy, and cakes, cupcakes and candy bars from patisseries and home bakers – so the entertainment, the look and the sweets for an event can come from one place.",
          ],
        },
        {
          h: "Who Showly is for",
          list: [
            "Private hosts planning a children's birthday, a wedding, a birthday party or a Christmas party.",
            "Companies and event planners looking for entertainment for corporate parties, trade fairs or galas.",
            "Artists, acts and event planners who want to be booked directly with their own calendar.",
            "Patisseries and home bakers who offer cakes and sweets for events.",
          ],
        },
        {
          h: "How booking works",
          list: [
            "Open a profile, choose date, time and duration in the live calendar and pay at checkout.",
            `Artists with instant booking are confirmed immediately. Request-based artists answer within ${RESPOND_HOURS} hours; payment is taken right away and fully refunded if they decline.`,
            "Showly keeps one hour of travel time free before and after every show, so artists arrive on time.",
            "At the event the customer gives the artist a check-in code; this confirms that the show took place.",
            "Each provider chooses a cancellation tier (flexible, moderate, strict) that is saved with the booking. If an artist cancels or does not show up, the customer gets everything back immediately, replacement suggestions and a 15 % voucher.",
          ],
        },
        {
          h: "How Showly differs from a classic agency",
          p: [
            "With Showly, prices, packages and free dates are visible on the profile before you book, and the booking is made directly in the calendar instead of through back-and-forth requests. Contact and payment run through the platform, so cancellation protection and refunds apply to both sides.",
          ],
        },
        {
          h: "Showly for artists",
          list: [
            "Registration is free. Before a profile goes live, the person behind it verifies their identity; one person can have one profile.",
            "Artists manage prices, packages and their availability calendar themselves.",
            `Artists receive ${keep} % of the fee; Showly keeps a ${pct} % commission. The payout follows ${PAYOUT_DAYS} days after the event.`,
            "Both businesses and private individuals can offer their services; the profile shows which applies.",
          ],
        },
        {
          h: "Languages",
          p: ["The Showly website is available in German, English and Spanish. Where an artist performs is shown on their profile (travel radius)."],
        },
        {
          h: "Not to be confused with",
          p: [
            "Showly (showly.eu) is a platform for booking artists and entertainment. It is not related to the app of the same name for tracking TV shows and movies.",
            "Who operates Showly is stated in the legal notice.",
          ],
        },
      ],
      links: {
        h: "Further pages",
        items: [
          { to: "/wie-funktioniert-showly", label: "How Showly works" },
          { to: "/", label: "Find artists" },
          { to: "/mitmachen", label: "Join as an artist" },
          { to: "/shop", label: "Costumes & decorations" },
          { to: "/torten", label: "Cakes & sweets" },
          { to: "/hilfe", label: "Help & FAQ" },
          { to: "/rechtliches/imprint", label: "Legal notice" },
        ],
      },
      cta: { label: "Find artists", to: "/", second: { to: "/mitmachen", label: "Register as an artist" } },
    };
  if (lang === "es")
    return {
      crumb: "Sobre Showly",
      h1: "¿Qué es Showly?",
      lead: BRAND_DEFINITION.es,
      sections: [
        {
          h: "Qué ofrece Showly",
          p: [
            "En Showly, quien organiza un evento encuentra artistas y espectáculos, ve sus fechas libres en un calendario en vivo y los reserva directamente a precio fijo. El pago se hace a través de la plataforma.",
            `Categorías en Showly: ${cats("es")}.`,
            "Además, Showly ofrece disfraces y decoración para alquilar o comprar, y tartas, cupcakes y candy bars de pastelerías y reposteros: el entretenimiento, la decoración y los dulces de un evento en un solo lugar.",
          ],
        },
        {
          h: "Para quién es Showly",
          list: [
            "Particulares que preparan un cumpleaños infantil, una boda, una fiesta o una cena de Navidad.",
            "Empresas y organizadores que buscan entretenimiento para fiestas de empresa, ferias o galas.",
            "Artistas, espectáculos y organizadores que quieren ser reservados directamente con su propio calendario.",
            "Pastelerías y reposteros que ofrecen tartas y dulces para eventos.",
          ],
        },
        {
          h: "Cómo funciona una reserva",
          list: [
            "Abre un perfil, elige fecha, hora y duración en el calendario y paga en la caja.",
            `Los artistas con reserva inmediata quedan confirmados al momento. Los demás responden en ${RESPOND_HOURS} horas; se paga al momento y, si rechazan, se devuelve todo.`,
            "Showly deja libre una hora de desplazamiento antes y después de cada show para que el artista llegue a tiempo.",
            "En el evento, el cliente da al artista un código de check-in que confirma que la actuación tuvo lugar.",
            "Cada proveedor elige un nivel de cancelación (flexible, moderado, estricto) que se guarda con la reserva. Si el artista cancela o no aparece, el cliente recupera todo al instante, recibe propuestas de sustitución y un vale del 15 %.",
          ],
        },
        {
          h: "En qué se diferencia de una agencia clásica",
          p: [
            "En Showly los precios, paquetes y fechas libres están visibles en el perfil antes de reservar, y la reserva se hace directamente en el calendario en lugar de con idas y venidas. Contacto y pago van por la plataforma, así que la protección de cancelación y los reembolsos valen para ambas partes.",
          ],
        },
        {
          h: "Showly para artistas",
          list: [
            "El registro es gratuito. Antes de publicar el perfil, la persona verifica su identidad; cada persona puede tener un perfil.",
            "Los artistas gestionan sus precios, paquetes y su calendario de disponibilidad.",
            `Los artistas reciben el ${keep} % del caché; Showly se queda una comisión del ${pct} %. El pago llega ${PAYOUT_DAYS} días después del evento.`,
            "Pueden ofrecer sus servicios tanto empresas como particulares; el perfil indica cuál es el caso.",
          ],
        },
        {
          h: "Idiomas",
          p: ["La web de Showly está disponible en alemán, inglés y español. Dónde actúa cada artista se indica en su perfil (radio de desplazamiento)."],
        },
        {
          h: "No confundir con",
          p: [
            "Showly (showly.eu) es una plataforma para reservar artistas y entretenimiento. No tiene relación con la app del mismo nombre para seguir series y películas.",
            "Quién gestiona Showly figura en el aviso legal.",
          ],
        },
      ],
      links: {
        h: "Más páginas",
        items: [
          { to: "/wie-funktioniert-showly", label: "Cómo funciona Showly" },
          { to: "/", label: "Buscar artistas" },
          { to: "/mitmachen", label: "Únete como artista" },
          { to: "/shop", label: "Disfraces y decoración" },
          { to: "/torten", label: "Tartas y dulces" },
          { to: "/hilfe", label: "Ayuda y preguntas frecuentes" },
          { to: "/rechtliches/imprint", label: "Aviso legal" },
        ],
      },
      cta: { label: "Buscar artistas", to: "/", second: { to: "/mitmachen", label: "Registrarse como artista" } },
    };
  return {
    crumb: "Über Showly",
    h1: "Was ist Showly?",
    lead: BRAND_DEFINITION.de,
    sections: [
      {
        h: "Was Showly bietet",
        p: [
          "Auf Showly finden Veranstalter Künstler und Entertainment-Acts, sehen deren freie Termine im Live-Kalender und buchen direkt zum Festpreis. Bezahlt wird über die Plattform.",
          `Sparten auf Showly: ${cats("de")}.`,
          "Dazu bietet Showly Kostüme und Deko zum Mieten oder Kaufen sowie Torten, Cupcakes und Candy Bars von Konditoreien und Hobbybäckern – Unterhaltung, Ausstattung und Süßes für ein Event an einem Ort.",
        ],
      },
      {
        h: "Für wen Showly gedacht ist",
        list: [
          "Privatpersonen, die einen Kindergeburtstag, eine Hochzeit, einen Geburtstag oder eine Weihnachtsfeier planen.",
          "Unternehmen und Eventplaner, die Entertainment für Firmenfeiern, Messen oder Galas suchen.",
          "Künstler, Acts und Eventplaner, die mit eigenem Kalender direkt gebucht werden möchten.",
          "Konditoreien und Hobbybäcker, die Torten und Süßes für Feiern anbieten.",
        ],
      },
      {
        h: "So läuft eine Buchung",
        list: [
          "Profil öffnen, Datum, Uhrzeit und Dauer im Live-Kalender wählen und an der Kasse bezahlen.",
          `Künstler mit Sofortbuchung sind sofort bestätigt. Künstler, die auf Anfrage arbeiten, antworten innerhalb von ${RESPOND_HOURS} Stunden; bezahlt wird sofort, bei Absage gibt es alles zurück.`,
          "Showly hält vor und nach jeder Show eine Stunde Fahrtzeit frei, damit der Künstler pünktlich ankommt.",
          "Beim Event nennt der Kunde dem Künstler einen Check-in-Code; damit ist bestätigt, dass der Auftritt stattgefunden hat.",
          "Jeder Anbieter wählt eine Stornostufe (Flexibel, Moderat, Streng), die mit der Buchung gespeichert wird. Sagt ein Künstler ab oder erscheint nicht, bekommt der Kunde sofort alles zurück, Ersatz-Vorschläge und einen Gutschein über 15 %.",
        ],
      },
      {
        h: "Was Showly von einer klassischen Künstlervermittlung unterscheidet",
        p: [
          "Bei Showly stehen Preise, Pakete und freie Termine schon vor der Buchung im Profil, und gebucht wird direkt im Kalender statt über mehrere Anfragen hin und her. Kontakt und Zahlung laufen über die Plattform; so gelten Stornoschutz und Erstattung für beide Seiten.",
        ],
      },
      {
        h: "Showly für Künstler",
        list: [
          "Die Registrierung ist kostenlos. Bevor ein Profil sichtbar wird, bestätigt die Person dahinter ihre Identität; eine Person hat ein Profil.",
          "Künstler pflegen Preise, Pakete und ihren Verfügbarkeitskalender selbst.",
          `Künstler erhalten ${keep} % der Gage, Showly behält ${pct} % Provision. Ausgezahlt wird ${PAYOUT_DAYS} Tage nach dem Event.`,
          "Anbieten können gewerbliche und private Anbieter; im Profil steht, was zutrifft.",
        ],
      },
      {
        h: "Sprachen",
        p: ["Die Website von Showly gibt es auf Deutsch, Englisch und Spanisch. Wo ein Künstler auftritt, steht in seinem Profil (Einsatzradius)."],
      },
      {
        h: "Nicht zu verwechseln",
        p: [
          "Showly (showly.eu) ist eine Plattform zum Buchen von Künstlern und Entertainment. Mit der gleichnamigen App zum Verfolgen von Serien und Filmen hat Showly nichts zu tun.",
          "Wer Showly betreibt, steht im Impressum.",
        ],
      },
    ],
    links: {
      h: "Weitere Seiten",
      items: [
        { to: "/wie-funktioniert-showly", label: "So funktioniert Showly" },
        { to: "/", label: "Künstler finden" },
        { to: "/mitmachen", label: "Als Künstler mitmachen" },
        { to: "/shop", label: "Kostüme & Deko" },
        { to: "/torten", label: "Torten & Süßes" },
        { to: "/hilfe", label: "Hilfe & häufige Fragen" },
        { to: "/rechtliches/imprint", label: "Impressum" },
      ],
    },
    cta: { label: "Künstler finden", to: "/", second: { to: "/mitmachen", label: "Als Künstler registrieren" } },
  };
}

function About() {
  const { lang } = useShowly();
  const c = copy(lang as Lang);
  return <InfoPage crumb={c.crumb} h1={c.h1} lead={c.lead} sections={c.sections} links={c.links} cta={c.cta} />;
}
