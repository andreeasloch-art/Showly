/* So funktioniert Showly: der Ablauf einer Buchung in klaren Schritten, für
 * Kunden und für Künstler. Fristen und Anteile kommen aus dem Code
 * (booking.ts, pricing.ts), damit Seite und App nie auseinanderlaufen. */
import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/showly/InfoPage";
import type { Lang } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { headLang, seoHead } from "@/showly/seo";
import { pageGraph } from "@/showly/schema";
import { FEE_RATE } from "@/showly/pricing";
import { FREE_CANCEL_HOURS, PAYOUT_WORKDAYS, RESPOND_HOURS, VOUCHER_EUR } from "@/showly/booking";

const PATH = "/wie-funktioniert-showly";

export const Route = createFileRoute("/wie-funktioniert-showly")({
  head: (ctx) => {
    const lang = headLang(ctx);
    const c = copy(lang);
    return {
      ...seoHead(PATH, PATH, lang),
      scripts: [{ type: "application/ld+json", children: pageGraph(lang, PATH, c.h1, c.crumb) }],
    };
  },
  component: HowItWorks,
});

const keep = 100 - Math.round(FEE_RATE * 100);

function copy(lang: Lang) {
  if (lang === "en")
    return {
      crumb: "How it works",
      h1: "How does Showly work?",
      lead: "On Showly you pick an artist, choose a free date in their live calendar, pay securely at checkout and confirm the show on the day with a check-in code. Artists set their own prices and calendar and receive their fee after the event.",
      sections: [
        {
          h: "Booking an artist in 4 steps",
          list: [
            "1. Find: browse categories such as magicians, DJs, bands, character performers or clowns, or search by city and date.",
            "2. Choose a date: the live calendar shows which start times are still free for the length of show you want.",
            "3. Pay: the booking goes into the cart together with costumes, decorations or cakes if you like, and is paid at checkout.",
            "4. Celebrate: on the day, give the artist your check-in code from your dashboard. This confirms the show took place.",
          ],
        },
        {
          h: "Instant booking or request",
          p: [
            `Some artists can be booked instantly; the date is fixed straight away. Others confirm each request themselves within ${RESPOND_HOURS} hours, and your payment is only charged once they accept.`,
          ],
        },
        {
          h: "Travel time between shows",
          p: [
            "Showly keeps one hour free before and after every booked show. If an artist is booked from 2 to 4 pm, the next show can start at 5 pm at the earliest.",
          ],
        },
        {
          h: "Cancellation and protection",
          list: [
            `Free cancellation up to ${FREE_CANCEL_HOURS} hours before the start.`,
            `If the artist cancels late without an emergency or does not show up, you get your money back plus a ${VOUCHER_EUR} € voucher.`,
            "Messages and payment run through Showly, so these protections apply.",
          ],
        },
        {
          h: "For artists",
          list: [
            "Register for free and verify your identity – then your profile goes live.",
            "Set prices, packages and free dates in your own calendar.",
            `Receive ${keep} % of the fee, paid out ${PAYOUT_WORKDAYS} working days after the event.`,
          ],
        },
      ],
      links: {
        h: "Further pages",
        items: [
          { to: "/ueber-showly", label: "What is Showly?" },
          { to: "/", label: "Find artists" },
          { to: "/mitmachen", label: "Join as an artist" },
          { to: "/hilfe", label: "Help & FAQ" },
          { to: "/rechtliches/terms", label: "Terms and conditions" },
        ],
      },
      cta: { label: "Find artists", to: "/", second: { to: "/mitmachen", label: "Register as an artist" } },
    };
  if (lang === "es")
    return {
      crumb: "Cómo funciona",
      h1: "¿Cómo funciona Showly?",
      lead: "En Showly eliges un artista, escoges una fecha libre en su calendario en vivo, pagas de forma segura y el día del evento confirmas la actuación con un código de check-in. Los artistas fijan sus precios y su calendario y cobran después del evento.",
      sections: [
        {
          h: "Reservar un artista en 4 pasos",
          list: [
            "1. Buscar: explora categorías como magos, DJs, bandas, personajes o payasos, o busca por ciudad y fecha.",
            "2. Elegir fecha: el calendario muestra qué horas de inicio siguen libres para la duración que quieres.",
            "3. Pagar: la reserva va al carrito, si quieres junto con disfraces, decoración o tartas, y se paga en la caja.",
            "4. Celebrar: el día del evento das al artista tu código de check-in del panel. Así queda confirmado que actuó.",
          ],
        },
        {
          h: "Reserva inmediata o solicitud",
          p: [
            `Algunos artistas se reservan al instante y la fecha queda fijada. Otros confirman cada solicitud en ${RESPOND_HOURS} horas; el pago solo se cobra cuando aceptan.`,
          ],
        },
        {
          h: "Tiempo de desplazamiento entre shows",
          p: [
            "Showly deja libre una hora antes y después de cada show reservado. Si un artista está reservado de 14 a 16 h, el siguiente show puede empezar como pronto a las 17 h.",
          ],
        },
        {
          h: "Cancelación y protección",
          list: [
            `Cancelación gratuita hasta ${FREE_CANCEL_HOURS} horas antes del inicio.`,
            `Si el artista cancela tarde sin emergencia o no aparece, recuperas tu dinero y recibes un vale de ${VOUCHER_EUR} €.`,
            "Mensajes y pago van por Showly, por eso se aplican estas protecciones.",
          ],
        },
        {
          h: "Para artistas",
          list: [
            "Regístrate gratis y verifica tu identidad: entonces se publica tu perfil.",
            "Fija precios, paquetes y fechas libres en tu propio calendario.",
            `Recibe el ${keep} % del caché, pagado ${PAYOUT_WORKDAYS} días hábiles después del evento.`,
          ],
        },
      ],
      links: {
        h: "Más páginas",
        items: [
          { to: "/ueber-showly", label: "¿Qué es Showly?" },
          { to: "/", label: "Buscar artistas" },
          { to: "/mitmachen", label: "Únete como artista" },
          { to: "/hilfe", label: "Ayuda y preguntas frecuentes" },
          { to: "/rechtliches/terms", label: "Condiciones" },
        ],
      },
      cta: { label: "Buscar artistas", to: "/", second: { to: "/mitmachen", label: "Registrarse como artista" } },
    };
  return {
    crumb: "So funktioniert's",
    h1: "Wie funktioniert Showly?",
    lead: "Auf Showly suchst du einen Künstler aus, wählst einen freien Termin in seinem Live-Kalender, bezahlst sicher an der Kasse und bestätigst den Auftritt am Tag des Events mit einem Check-in-Code. Künstler legen Preise und Kalender selbst fest und bekommen ihre Gage nach dem Event.",
    sections: [
      {
        h: "Einen Künstler buchen in 4 Schritten",
        list: [
          "1. Finden: Sparten wie Zauberer, DJs, Bands, Märchenfiguren oder Clowns ansehen oder nach Ort und Datum suchen.",
          "2. Termin wählen: Der Live-Kalender zeigt, welche Startzeiten für die gewünschte Showdauer noch frei sind.",
          "3. Bezahlen: Die Buchung kommt in den Warenkorb, auf Wunsch zusammen mit Kostümen, Deko oder Torten, und wird an der Kasse bezahlt.",
          "4. Feiern: Am Tag des Events nennst du dem Künstler deinen Check-in-Code aus dem Dashboard. Damit ist bestätigt, dass der Auftritt stattgefunden hat.",
        ],
      },
      {
        h: "Sofortbuchung oder Anfrage",
        p: [
          `Manche Künstler sind sofort buchbar; der Termin steht dann direkt fest. Andere bestätigen jede Anfrage selbst innerhalb von ${RESPOND_HOURS} Stunden, und abgebucht wird erst bei ihrer Zusage.`,
        ],
      },
      {
        h: "Fahrtzeit zwischen zwei Shows",
        p: [
          "Showly hält vor und nach jeder gebuchten Show eine Stunde frei. Ist ein Künstler von 14 bis 16 Uhr gebucht, kann die nächste Show frühestens um 17 Uhr beginnen.",
        ],
      },
      {
        h: "Stornierung und Schutz",
        list: [
          `Kostenlos stornieren bis ${FREE_CANCEL_HOURS} Stunden vor Beginn.`,
          `Sagt der Künstler kurzfristig ohne Notfall ab oder erscheint nicht, bekommst du dein Geld zurück und zusätzlich einen Gutschein über ${VOUCHER_EUR} €.`,
          "Nachrichten und Zahlung laufen über Showly, deshalb gilt dieser Schutz.",
        ],
      },
      {
        h: "Für Künstler",
        list: [
          "Kostenlos registrieren und Identität bestätigen – dann geht das Profil online.",
          "Preise, Pakete und freie Termine im eigenen Kalender festlegen.",
          `${keep} % der Gage erhalten, ausgezahlt ${PAYOUT_WORKDAYS} Werktage nach dem Event.`,
        ],
      },
    ],
    links: {
      h: "Weitere Seiten",
      items: [
        { to: "/ueber-showly", label: "Was ist Showly?" },
        { to: "/", label: "Künstler finden" },
        { to: "/mitmachen", label: "Als Künstler mitmachen" },
        { to: "/hilfe", label: "Hilfe & häufige Fragen" },
        { to: "/rechtliches/terms", label: "AGB" },
      ],
    },
    cta: { label: "Künstler finden", to: "/", second: { to: "/mitmachen", label: "Als Künstler registrieren" } },
  };
}

function HowItWorks() {
  const { lang } = useShowly();
  const c = copy(lang as Lang);
  return <InfoPage crumb={c.crumb} h1={c.h1} lead={c.lead} sections={c.sections} links={c.links} cta={c.cta} />;
}
