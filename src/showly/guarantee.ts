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
  },
};

export type GuaranteeCopy = { name: string; short: string; claim: string; points: string[]; why: string; more: string };
export function guaranteeCopy(lang: string): GuaranteeCopy {
  return (GUARANTEE as Record<string, GuaranteeCopy>)[lang] ?? GUARANTEE.de;
}
