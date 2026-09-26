/* Privat oder gewerblich, und der Steuerhinweis.
 *
 * Auf Showly dürfen auch Privatpersonen anbieten. Das hat drei Folgen:
 *
 *  1. Vertragsstrafen in AGB sind gegenüber Privatpersonen unwirksam
 *     (§ 309 Nr. 6 BGB). Bei privaten Anbietern gibt es deshalb keine
 *     Geldstrafe für späte Absage oder Nichterscheinen; das Stufenmodell
 *     (Einschränkung, Sperre, Entfernen) gilt für alle (AGB §§ 9, 23).
 *  2. Kunden müssen sehen, dass sie bei einer Privatperson buchen und die
 *     Verbraucherrechte aus dem Fernabsatz dann nicht gelten
 *     (Art. 246d § 1 EGBGB, Art. 30 Digital Services Act).
 *  3. Einnahmen können steuerpflichtig sein. Das klärt und erledigt jede
 *     Person selbst; Showly meldet Einnahmen, soweit gesetzlich
 *     vorgeschrieben, an die Steuerbehörden (PStTG). */
import type { Artist } from "./data";

/** Beispielprofile im Katalog gelten als gewerblich */
export function isBusiness(a: Artist | null | undefined): boolean {
  return !a || (a as { business?: unknown }).business !== false;
}

export const STATUS = {
  de: {
    q: "Wie bietest du an?",
    private: "Privat",
    privateP: "Gelegentlich, als Privatperson",
    business: "Gewerblich oder selbstständig",
    businessP: "Mit Gewerbe, freiberuflich oder als Firma",
    badgePrivate: "Privatanbieter",
    badgeBusiness: "Gewerblicher Anbieter",
    consumer:
      "Du buchst bei einer Privatperson. Die besonderen Verbraucherrechte für Käufe bei Unternehmen, etwa das Widerrufsrecht, gelten dann nicht. Stornierung, Erstattung und Gutschein nach unseren AGB gelten trotzdem.",
  },
  en: {
    q: "How do you offer your services?",
    private: "Private",
    privateP: "Occasionally, as a private person",
    business: "Commercial or self-employed",
    businessP: "Registered business, freelancer or company",
    badgePrivate: "Private provider",
    badgeBusiness: "Business provider",
    consumer:
      "You are booking a private person. Special consumer rights for purchases from businesses, such as the right of withdrawal, do not apply. Cancellation, refund and voucher under our terms still apply.",
  },
  es: {
    q: "¿Cómo ofreces tus servicios?",
    private: "Particular",
    privateP: "De forma ocasional, como particular",
    business: "Empresa o autónomo",
    businessP: "Con actividad registrada, autónomo o empresa",
    badgePrivate: "Proveedor particular",
    badgeBusiness: "Proveedor profesional",
    consumer:
      "Reservas con un particular. Los derechos especiales del consumidor en compras a empresas, como el desistimiento, no se aplican. La cancelación, el reembolso y el vale según nuestras condiciones siguen valiendo.",
  },
};

export const TAX = {
  de: {
    h: "Steuern",
    text:
      "Einnahmen über Showly können steuerpflichtig sein, auch wenn du privat anbietest. Ab welchem Betrag Steuern anfallen (etwa Einkommensteuer oder Umsatzsteuer) und ob du ein Gewerbe anmelden musst, hängt vom Land ab, in dem du lebst, und von der Höhe deiner Einnahmen. Du bist selbst dafür verantwortlich, deine Einnahmen anzugeben und Steuern abzuführen. Showly berät dazu nicht und ist dafür nicht verantwortlich. Soweit gesetzlich vorgeschrieben, meldet Showly Einnahmen an die Steuerbehörden (in Deutschland nach dem Plattformen-Steuertransparenzgesetz).",
    ack: "Mir ist bekannt, dass meine Einnahmen je nach Land und Höhe steuerpflichtig sein können und ich sie selbst versteuern muss. Showly ist dafür nicht verantwortlich.",
    more: "Mehr dazu",
  },
  en: {
    h: "Taxes",
    text:
      "Income earned through Showly may be taxable, even if you offer your services privately. The amount from which taxes apply (such as income tax or VAT) and whether you must register a business depend on the country you live in and on how much you earn. You are responsible for declaring your income and paying taxes yourself. Showly does not give tax advice and is not responsible for this. Where required by law, Showly reports income to the tax authorities (in Germany under the Platform Tax Transparency Act).",
    ack: "I understand that my income may be taxable depending on my country and the amount, and that I must pay the taxes myself. Showly is not responsible for this.",
    more: "Learn more",
  },
  es: {
    h: "Impuestos",
    text:
      "Los ingresos obtenidos a través de Showly pueden estar sujetos a impuestos, aunque ofrezcas tus servicios como particular. El importe a partir del cual se pagan impuestos (como el IRPF o el IVA) y si debes darte de alta dependen del país en el que vives y de cuánto ganas. Eres responsable de declarar tus ingresos y pagar los impuestos. Showly no asesora sobre impuestos ni se responsabiliza de ello. Cuando la ley lo exige, Showly comunica los ingresos a las autoridades fiscales (en Alemania según la ley de transparencia fiscal de plataformas).",
    ack: "Sé que mis ingresos pueden tributar según mi país y su importe, y que debo pagar yo los impuestos. Showly no es responsable de ello.",
    more: "Más información",
  },
};

export type L3 = "de" | "en" | "es";
export const pick = <T,>(o: Record<L3, T>, lang: string): T => o[(lang as L3) in o ? (lang as L3) : "de"];
