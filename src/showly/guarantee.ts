/* Showly-Ersatzgarantie: das Werbeversprechen und wie es finanziert wird.
 *
 * Versprechen: Kommt dein Künstler nicht, besorgen wir Ersatz oder du
 * bekommst alles zurück (AGB § 9 Abs. 7).
 *  - Das Geld geht sofort und vollständig zurück.
 *  - Das Showly-Team schlägt passende Ersatz-Künstler für denselben Termin vor.
 *    Kostet der Ersatz mehr, übernimmt Showly den Aufpreis bis 20 % per
 *    Gutschein.
 *  - Bei später Absage ohne Notfall oder Nichterscheinen gibt es zusätzlich
 *    den Gutschein über 50 € (AGB § 9 Abs. 4).
 *
 * Finanziert aus den Vertragsstrafen der Künstler (AGB § 9 Abs. 2) und einem
 * kleinen Teil der Provision (GUARANTEE_FEE_SHARE). Die Verwaltung sieht den
 * Topf in den Berichten. Genau das unterscheidet Showly von
 * Kleinanzeigen-Portalen. */

/** Anteil der Provision, der in den Garantie-Topf fließt */
export const GUARANTEE_FEE_SHARE = 0.05;
/** Aufpreis für Ersatz, den Showly höchstens übernimmt */
export const GUARANTEE_UPGRADE = 0.2;

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
      "Unser Team schlägt dir innerhalb von 24 Stunden passende Ersatz-Künstler für deinen Termin vor. Kostet der Ersatz mehr, übernehmen wir den Aufpreis bis 20 %.",
      "Bei später Absage oder Nichterscheinen gibt es zusätzlich 50 € Gutschein.",
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
      "Our team suggests suitable replacement artists for your date within 24 hours. If the replacement costs more, we cover the difference up to 20%.",
      "For late cancellations or no-shows you also get a €50 voucher.",
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
      "Nuestro equipo te propone artistas sustitutos para tu fecha en 24 horas. Si el sustituto cuesta más, cubrimos la diferencia hasta un 20 %.",
      "En cancelaciones tardías o ausencias recibes además un vale de 50 €.",
    ],
    why: "En los portales de anuncios estás solo si alguien no aparece. En Showly los artistas responden con penalizaciones, y con eso pagamos tu sustituto.",
    more: "Cómo funciona la garantía",
  },
};

export type GuaranteeCopy = { name: string; short: string; claim: string; points: string[]; why: string; more: string };
export function guaranteeCopy(lang: string): GuaranteeCopy {
  return (GUARANTEE as Record<string, GuaranteeCopy>)[lang] ?? GUARANTEE.de;
}
