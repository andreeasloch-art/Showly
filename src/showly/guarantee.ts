/* Showly-Ersatzgarantie: das Werbeversprechen und wie es finanziert wird.
 *
 * Versprechen: Kommt dein Künstler nicht, besorgen wir Ersatz oder du
 * bekommst alles zurück (AGB § 9 Abs. 7).
 *  - Das Geld geht sofort und vollständig zurück.
 *  - Das System schlägt sofort drei Ersatz-Künstler vor (gleicher Termin,
 *    gleiche Kategorie, gleiche Gegend, Springer zuerst). Kostet der Ersatz
 *    mehr, übernimmt Showly den Aufpreis bis 100 €.
 *  - Als Entschuldigung ein Gutschein über 15 % (policies.ts).
 *  - Unter 48 Stunden: der Kundensupport bearbeitet den Fall zuerst und
 *    meldet sich sofort per E-Mail (keine Telefon-Hotline).
 *
 * Finanziert aus den Vertragsstrafen der Künstler (AGB § 9 Abs. 2) und einem
 * kleinen Teil der Provision (GUARANTEE_FEE_SHARE). Die Verwaltung sieht den
 * Topf in den Berichten. Genau das unterscheidet Showly von
 * Kleinanzeigen-Portalen. */

/** Anteil der Provision, der in den Garantie-Topf fließt */
export const GUARANTEE_FEE_SHARE = 0.05;
export { UPGRADE_CAP_EUR as GUARANTEE_UPGRADE_EUR } from "./policies";

export function guaranteePool(p: { penaltiesCents: number; feeCents: number; usedCents?: number }): number {
  return Math.max(0, Math.round(p.penaltiesCents + p.feeCents * GUARANTEE_FEE_SHARE - (p.usedCents ?? 0)));
}

export const GUARANTEE = {
  de: {
    name: "Showly-Ersatzgarantie",
    short: "Ersatzgarantie: Ersatz oder Geld zurück",
    claim: "Kommt dein Künstler nicht, besorgen wir Ersatz – oder du bekommst alles zurück.",
    points: [
      "Sagt der Künstler ab oder erscheint nicht, bekommst du sofort den vollen Betrag zurück.",
      "Du bekommst sofort drei passende Ersatz-Künstler für denselben Termin vorgeschlagen. Kostet der Ersatz mehr, übernehmen wir den Aufpreis bis 100 €.",
      "Als Entschuldigung bekommst du einen Gutschein über 15 % des Buchungsbetrags.",
      "Unter 48 Stunden vor dem Event bearbeitet unser Kundensupport deinen Fall zuerst und meldet sich sofort per E-Mail.",
    ],
    why: "Bei Kleinanzeigen stehst du allein da, wenn jemand nicht kommt. Bei Showly haften die Künstler mit Vertragsstrafen, und daraus zahlen wir deinen Ersatz.",
    more: "So funktioniert die Garantie",
    eyebrow: "Sicher buchen",
    title: "Kommt dein Künstler nicht, bekommst du Ersatz oder dein Geld zurück.",
    lead: "Das gilt nur, wenn du über Showly buchst und bezahlst.",
    tiles: [
      { icon: "money", t: "Geld sofort zurück", d: "Bei Absage oder Nichterscheinen der volle Betrag." },
      { icon: "user", t: "3 Ersatz-Künstler", d: "Für denselben Termin. Aufpreis bis 100 € zahlen wir." },
      { icon: "gift", t: "15 % Gutschein", d: "Als Entschuldigung obendrauf." },
      { icon: "mail", t: "Support zuerst", d: "Unter 48 Stunden vor dem Event bearbeiten wir deinen Fall sofort." },
    ],
    vsH: "Über Showly oder direkt gebucht?",
    vsUs: "Über Showly",
    vsThem: "Direkt gebucht",
    vs: [
      "Ersatz-Künstler, wenn jemand ausfällt",
      "Volles Geld zurück bei Absage",
      "Künstler bekommt sein Geld erst nach dem Event",
      "Vertragsstrafe, wenn der Künstler nicht kommt",
      "Support, der sich um deinen Fall kümmert",
    ],
    note: "Bei Absprachen oder Zahlungen außerhalb von Showly greift die Garantie nicht.",
  },
  en: {
    name: "Showly replacement guarantee",
    short: "Replacement guarantee: replacement or money back",
    claim: "If your artist doesn't show up, we find a replacement – or you get everything back.",
    points: [
      "If the artist cancels or doesn't show, you get the full amount back immediately.",
      "You immediately get three suitable replacement artists for the same date. If the replacement costs more, we cover the difference up to €100.",
      "As an apology you get a voucher worth 15% of the booking.",
      "Less than 48 hours before the event our customer support handles your case first and gets back to you by email right away.",
    ],
    why: "On classified ad sites you're on your own if someone doesn't show. At Showly, artists are liable through contractual penalties – and that's what pays for your replacement.",
    more: "How the guarantee works",
    eyebrow: "Book safely",
    title: "If your artist doesn't show, you get a replacement or your money back.",
    lead: "Only when you book and pay through Showly.",
    tiles: [
      { icon: "money", t: "Money back now", d: "The full amount if the artist cancels or doesn't show." },
      { icon: "user", t: "3 replacements", d: "For the same date. We cover up to €100 extra." },
      { icon: "gift", t: "15% voucher", d: "As an apology on top." },
      { icon: "mail", t: "Support first", d: "Less than 48 hours before the event we handle your case right away." },
    ],
    vsH: "Through Showly or booked directly?",
    vsUs: "Through Showly",
    vsThem: "Booked directly",
    vs: [
      "Replacement artist if someone drops out",
      "Full refund if the artist cancels",
      "Artist only gets paid after the event",
      "Contractual penalty if the artist doesn't show",
      "Support that takes care of your case",
    ],
    note: "The guarantee doesn't apply to arrangements or payments outside Showly.",
  },
  es: {
    name: "Garantía de sustitución Showly",
    short: "Garantía: sustituto o te devolvemos todo",
    claim: "Si tu artista no viene, buscamos un sustituto – o te devolvemos todo.",
    points: [
      "Si el artista cancela o no aparece, recibes el importe completo de inmediato.",
      "Recibes al instante tres artistas sustitutos para la misma fecha. Si el sustituto cuesta más, cubrimos la diferencia hasta 100 €.",
      "Como disculpa recibes un vale del 15 % de la reserva.",
      "A menos de 48 horas del evento nuestro servicio de atención trata tu caso con prioridad y te escribe enseguida por correo.",
    ],
    why: "En los portales de anuncios estás solo si alguien no aparece. En Showly los artistas responden con penalizaciones, y con eso pagamos tu sustituto.",
    more: "Cómo funciona la garantía",
    eyebrow: "Reserva segura",
    title: "Si tu artista no viene, recibes un sustituto o te devolvemos el dinero.",
    lead: "Solo si reservas y pagas a través de Showly.",
    tiles: [
      { icon: "money", t: "Dinero de vuelta ya", d: "El importe completo si el artista cancela o no aparece." },
      { icon: "user", t: "3 sustitutos", d: "Para la misma fecha. Cubrimos hasta 100 € de diferencia." },
      { icon: "gift", t: "Vale del 15 %", d: "Como disculpa, además." },
      { icon: "mail", t: "Soporte prioritario", d: "A menos de 48 horas del evento tratamos tu caso enseguida." },
    ],
    vsH: "¿Con Showly o reservado directamente?",
    vsUs: "Con Showly",
    vsThem: "Directo",
    vs: [
      "Artista sustituto si alguien falla",
      "Reembolso completo si el artista cancela",
      "El artista cobra solo después del evento",
      "Penalización si el artista no aparece",
      "Soporte que se ocupa de tu caso",
    ],
    note: "La garantía no cubre acuerdos ni pagos fuera de Showly.",
  },
};

export type GuaranteeCopy = {
  name: string;
  short: string;
  claim: string;
  points: string[];
  why: string;
  more: string;
  eyebrow: string;
  title: string;
  lead: string;
  tiles: { icon: string; t: string; d: string }[];
  vsH: string;
  vsUs: string;
  vsThem: string;
  vs: string[];
  note: string;
};
export function guaranteeCopy(lang: string): GuaranteeCopy {
  return (GUARANTEE as Record<string, GuaranteeCopy>)[lang] ?? GUARANTEE.de;
}
