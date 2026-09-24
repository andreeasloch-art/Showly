/* Kontaktdaten-Filter.
 *
 * Kunden und Anbietende sollen sich nicht am Marktplatz vorbei verabreden
 * (AGB § 20 Abs. 3). Deshalb prüft die App jeden Freitext, den die andere
 * Seite oder die Öffentlichkeit liest: Wünsche bei Buchungen und Anfragen,
 * Profiltexte, Beiträge, Kommentare und Bewertungen. Gefunden werden:
 *
 *  - Telefonnummern, auch mit Leerzeichen, Punkten, Strichen oder anderen
 *    Zeichen dazwischen, als Wörter ausgeschrieben ("null eins fünf …"),
 *    gemischt ("0 eins 5 …") oder mit O statt 0,
 *  - E-Mail-Adressen, auch verschleiert ("name (at) gmx punkt de"),
 *  - Webseiten und Shop-Adressen ("www", "meinshop.de", "meinshop punkt de"),
 *  - Social Media und Messenger (Instagram, WhatsApp, @name …),
 *  - Aufforderungen, sich außerhalb von Showly zu melden oder zu zahlen.
 *
 * Kein Filter erkennt alles, und ein paar harmlose Sätze werden auffallen.
 * Die Prüfung läuft im Browser für den sofortigen Hinweis; sobald die
 * Datenbank angebunden ist, gehört dieselbe Prüfung zusätzlich auf den
 * Server, weil sich eine Browser-Prüfung umgehen lässt. */

export type ContactKind = "phone" | "email" | "web" | "social" | "offplatform";

/* Zahlwörter auf Deutsch, Englisch und Spanisch. "zwo" und "ein" für
   Nummern wie "null eins sieben ein". Längere Wörter zuerst, damit
   "sieben" nicht als "sie" + "ben" zerfällt. */
const NUM_WORDS: [string, string][] = [
  ["null", "0"], ["zero", "0"], ["cero", "0"],
  ["eins", "1"], ["ein", "1"], ["one", "1"], ["uno", "1"], ["una", "1"],
  ["zwei", "2"], ["zwo", "2"], ["two", "2"], ["dos", "2"],
  ["drei", "3"], ["three", "3"], ["tres", "3"],
  ["vier", "4"], ["four", "4"], ["cuatro", "4"],
  ["fuenf", "5"], ["funf", "5"], ["five", "5"], ["cinco", "5"],
  ["sechs", "6"], ["six", "6"], ["seis", "6"],
  ["sieben", "7"], ["seven", "7"], ["siete", "7"],
  ["acht", "8"], ["eight", "8"], ["ocho", "8"],
  ["neun", "9"], ["nine", "9"], ["nueve", "9"],
];
const NUM_ALT = NUM_WORDS.map(([w]) => w)
  .sort((a, b) => b.length - a.length)
  .join("|");

/** Kleinbuchstaben, Umlaute ausgeschrieben, Sonderformen von Ziffern und @ vereinheitlicht */
function base(text: string): string {
  return text
    // Ziffern als Emoji (0️⃣ 1️⃣ …) auf die Ziffer zurückführen
    .replace(/[\uFE0F\u20E3]/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/* Zeichen, die jemand zwischen Ziffern setzt, um eine Nummer zu tarnen */
const SEP = "[\\s.,;:·•*_~|/\\\\()\\[\\]{}'\"+\\-–—=#]*";

/** Zahlwörter in Ziffern umwandeln, aber nur, wo sie wie eine Nummer
 *  aussehen: mindestens drei Zahlwörter oder Ziffern hintereinander.
 *  So bleibt "Ich habe acht Gäste" unberührt. */
function wordsToDigits(s: string): string {
  const unit = `(?:${NUM_ALT}|\\d)`;
  const run = new RegExp(`${unit}(?:${SEP}${unit}){2,}`, "g");
  return s.replace(run, (m) => {
    const words = m.match(new RegExp(`${NUM_ALT}|\\d`, "g")) || [];
    const hasWord = words.some((w) => !/^\d$/.test(w));
    if (!hasWord) return m;
    return " " + words.map((w) => (/^\d$/.test(w) ? w : NUM_WORDS.find(([x]) => x === w)![1])).join("") + " ";
  });
}

/* Harmloses mit vielen Ziffern ausblenden, damit es nicht als Nummer gilt:
   Datum, Uhrzeit, Zeitraum, Geldbeträge, Jahreszahlen. */
function stripHarmless(s: string): string {
  return s
    .replace(/\b\d{1,2}\s?[./-]\s?\d{1,2}\s?[./-]\s?(?:\d{4}|\d{2})\b/g, " DATUM ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " DATUM ")
    .replace(/\b\d{1,2}[.:]\d{2}\s*(?:uhr|h\b)?(?:\s*(?:-|–|bis)\s*\d{1,2}[.:]\d{2}\s*(?:uhr|h\b)?)?/g, " ZEIT ")
    .replace(/\b\d{1,2}\s*(?:-|–|bis)\s*\d{1,2}\s*uhr\b/g, " ZEIT ")
    .replace(/\b\d{1,2}\s*uhr\b/g, " ZEIT ")
    // Adresse: Postleitzahl vor dem Ort, Hausnummer nach der Straße
    .replace(/\b\d{5}\s+(?=[a-z])/g, " PLZ ")
    .replace(/(?:str(?:asse|\.)?|weg|platz|allee|gasse|ring|damm|ufer|markt)\s*\d{1,4}\s?[a-z]?\b/g, " HNR ")
    .replace(/(?:€|eur|euro)\s*\d[\d.,\s]*|\d[\d.,]*\s*(?:€|eur\b|euro\b|,-)/g, " BETRAG ")
    .replace(/\b\d{1,3}(?:\s*(?:-|–|bis)\s*\d{1,3})?\s*(?:gaeste|personen|kinder|leute|jahre|std|stunden|min|minuten|km|m\b|cm|kg|%)/g, " MENGE ");
}

function hasPhone(t: string): boolean {
  let s = base(t);
  // O statt 0 und l/I statt 1, nur zwischen oder neben Ziffern
  s = s.replace(/(?<=\d[\s.\-/]?)[o](?=[\s.\-/]?\d)/g, "0").replace(/(?<=\d)[il](?=\d)/g, "1");
  s = s.replace(/\bo(?=\s*[1-9]\d)/g, "0");
  s = wordsToDigits(s);
  s = stripHarmless(s);
  const run = new RegExp(`(?:\\+|00)?\\d(?:${SEP}\\d){6,}`, "g");
  for (const m of s.match(run) || []) {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 16) return true;
  }
  return false;
}

const AT = "(?:@|\\(at\\)|\\[at\\]|\\{at\\}|\\sat\\s|\\sae?t\\s|\\(ae?t\\)|&#64;|\\s?@\\s?)";
const DOT = "(?:\\.|\\(dot\\)|\\[dot\\]|\\sdot\\s|\\spunkt\\s|\\(punkt\\)|\\[punkt\\]|\\spkt\\.?\\s)";
const TLD = "(?:de|com|net|org|eu|at|ch|info|biz|shop|store|online|io|me|co|es|fr|it|nl|uk|app|site|website|tv)";

function hasEmail(t: string): boolean {
  const s = base(t);
  if (new RegExp(`[a-z0-9._%+-]{2,}\\s*${AT}\\s*[a-z0-9-]{2,}\\s*${DOT}\\s*${TLD}\\b`).test(s)) return true;
  // Anbieter beim Namen genannt, etwa "bei gmx" oder "gmail"
  return /\b(?:gmail|googlemail|gmx|web\s?\.?\s?de|hotmail|outlook|yahoo|t-?online|icloud|protonmail|proton\s?mail|freenet|aol|mail\s?\.?\s?de)\b/.test(s);
}

function hasWeb(t: string): boolean {
  const s = base(t);
  if (/\b(?:https?:\/\/|www\s*(?:\.|punkt|dot))/.test(s)) return true;
  if (new RegExp(`\\b[a-z0-9][a-z0-9-]{1,}\\s*${DOT}\\s*${TLD}\\b`).test(s)) return true;
  // "meinshop.de" ohne Leerzeichen
  return new RegExp(`\\b[a-z0-9-]{2,}\\.${TLD}\\b`).test(s);
}

function hasSocial(t: string): boolean {
  const s = base(t);
  if (
    /\b(?:instagram|insta|ig|tiktok|tik\s?tok|facebook|fb|whats\s?app|whatsapp|watsapp|wa\s?\.?\s?me|telegram|signal|snapchat|snap|threads|twitter|linkedin|youtube|discord|skype|messenger|imessage|facetime|onlyfans)\b/.test(
      s,
    )
  )
    return true;
  // @name, wenn es nicht Teil einer E-Mail ist
  return /(?:^|[\s(,;:])@[a-z0-9_.]{3,}/.test(s);
}

/* Aufforderungen, sich direkt zu melden oder an Showly vorbei zu zahlen */
const OFFPLATFORM = [
  "ruf mich an", "ruf an", "rufen sie mich an", "anrufen", "ruf durch", "meine nummer", "meine handynummer",
  "handynummer", "telefonnummer", "festnetz", "mobilnummer", "tel.", "tel:", "telefon:", "mobil:", "handy:",
  "schreib mir privat", "schreib mir direkt", "schreiben sie mir direkt",
  "e-mail:", "email:", "mail:", "meine mail", "meine e-mail", "meine email", "kontaktier mich", "kontaktieren sie mich",
  "melde dich direkt", "melden sie sich direkt", "direkt bei mir", "direkt ueber mich", "privat buchen", "direkt buchen",
  "ohne showly", "an showly vorbei", "ausserhalb von showly", "ausserhalb der plattform", "provision sparen",
  "gebuehr sparen", "gebuehren sparen", "servicegebuehr sparen", "bar zahlen", "barzahlung", "in bar",
  "paypal", "ueberweisung direkt", "direkt ueberweisen", "google mich", "googel mich", "such mich", "suche mich",
  "findest du unter", "finden sie mich unter", "mein shop heisst", "mein laden heisst", "meine firma heisst",
  "meine website", "meine webseite", "meine homepage", "meine seite", "unter dem namen",
  "call me", "text me", "my number", "dm me", "contact me directly", "email me", "book me directly",
  "llamame", "mi numero", "escribeme",
];

function hasOffplatform(t: string): boolean {
  const s = " " + base(t).replace(/\s+/g, " ") + " ";
  // "ruf(t) mich/uns vorher kurz an", "rufen Sie einfach an"
  if (/\bruf(?:t|en|e)?\b(?:\s+\S+){0,4}\s+an\b/.test(s)) return true;
  return OFFPLATFORM.some((p) => s.includes(p.startsWith("tel") || p.endsWith(":") ? p : ` ${p}`));
}

/** Welche Arten von Kontaktdaten stecken im Text? Leer, wenn keine. */
export function findContact(text: string): ContactKind[] {
  if (!text || !text.trim()) return [];
  const out: ContactKind[] = [];
  if (hasPhone(text)) out.push("phone");
  if (hasEmail(text)) out.push("email");
  if (hasWeb(text)) out.push("web");
  if (hasSocial(text)) out.push("social");
  if (hasOffplatform(text)) out.push("offplatform");
  return out;
}

const LABEL: Record<string, Record<ContactKind, string>> = {
  de: { phone: "Telefonnummer", email: "E-Mail-Adresse", web: "Webseite oder Shop-Adresse", social: "Social Media oder Messenger", offplatform: "Aufforderung zum direkten Kontakt" },
  en: { phone: "phone number", email: "email address", web: "website or shop address", social: "social media or messenger", offplatform: "request for direct contact" },
  es: { phone: "número de teléfono", email: "correo electrónico", web: "web o tienda", social: "redes sociales o mensajería", offplatform: "petición de contacto directo" },
};

const TEXT: Record<string, (found: string) => string> = {
  de: (f) =>
    `Bitte keine Kontaktdaten (gefunden: ${f}). Kontakt und Zahlung laufen über Showly, damit beide Seiten abgesichert sind. Bitte entferne sie, dann kannst du weitermachen.`,
  en: (f) =>
    `Please don't share contact details (found: ${f}). Contact and payment go through Showly so both sides are protected. Please remove them to continue.`,
  es: (f) =>
    `Por favor, sin datos de contacto (encontrado: ${f}). El contacto y el pago van por Showly para que ambas partes estén protegidas. Elimínalos para continuar.`,
};

/** Hinweistext für die Oberfläche, oder null, wenn alles in Ordnung ist */
export function contactMessage(text: string, lang: string): string | null {
  const kinds = findContact(text);
  if (!kinds.length) return null;
  const L = LABEL[lang] || LABEL["de"]!;
  return (TEXT[lang] || TEXT["de"]!)(kinds.map((k) => L[k]).join(", "));
}
