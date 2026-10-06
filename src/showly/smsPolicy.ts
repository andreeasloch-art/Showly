/* Wer bekommt einen SMS-Code? Regeln gegen Kosten-Missbrauch.
 *
 * Jede SMS kostet Geld. Betrüger fordern massenhaft Codes an teure
 * Auslands- und Sondernummern an und verdienen an den Gebühren mit
 * ("SMS-Pumping"). Deshalb gilt, bevor überhaupt eine SMS rausgeht:
 *
 *  1. Nur echte Handynummern. Festnetz-, Sonder-, Premium- und
 *     Satellitennummern bekommen keine SMS.
 *  2. Nur Länder auf der Liste. Sie umfasst alle Länder, in denen Showly
 *     arbeitet (deutsch-, spanisch- und englischsprachige Kernmärkte).
 *     Weitere Länder schaltet die Verwaltung über SMS_EXTRA_COUNTRIES frei.
 *     Wer aus einem anderen Land kommt, meldet sich kostenlos per E-Mail,
 *     Google oder Apple an.
 *  3. Mengenbremsen je Nummer, je Internetadresse, je Land und insgesamt
 *     pro Tag (lib/sms.server.ts). Ist das Tageslimit erreicht, gibt es bis
 *     zum nächsten Tag keine SMS mehr, sondern den Hinweis auf E-Mail.
 *
 * Diese Datei enthält nur die Prüfung der Nummer (rein, testbar). */
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Kernländer, in die SMS ohne weitere Freischaltung gehen */
export const CORE_SMS_COUNTRIES = [
  /* deutschsprachig */
  "DE", "AT", "CH", "LI", "LU",
  /* spanischsprachig */
  "ES", "AD", "MX", "GT", "HN", "SV", "NI", "CR", "PA", "CU", "DO", "PR", "CO", "VE", "EC", "PE", "BO",
  "PY", "CL", "AR", "UY",
  /* englischsprachige Kernmärkte */
  "GB", "IE", "US", "CA", "AU", "NZ",
] as const;

export type SmsRefusal = "invalid" | "landline" | "country";

export interface SmsTarget {
  e164: string;
  country: string;
}

/** Nummer prüfen. `extra`: zusätzlich freigeschaltete Länder (ISO, groß) */
export function checkSmsNumber(raw: string, extra: readonly string[] = []): SmsTarget | { refused: SmsRefusal } {
  const p = parsePhoneNumberFromString(String(raw || "").trim());
  if (!p || !p.isValid() || !p.country) return { refused: "invalid" };
  const type = p.getType();
  /* USA und Kanada unterscheiden Handy und Festnetz nicht: dort zählt
     FIXED_LINE_OR_MOBILE als Handy */
  if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return { refused: "landline" };
  const allowed = new Set<string>([...CORE_SMS_COUNTRIES, ...extra.map((c) => c.toUpperCase())]);
  if (!allowed.has(p.country)) return { refused: "country" };
  return { e164: p.number, country: p.country };
}

/** Kernland? Für Kernländer gilt ein höheres Tageslimit als für zusätzlich
 *  freigeschaltete Länder */
export function isCoreCountry(country: string): boolean {
  return (CORE_SMS_COUNTRIES as readonly string[]).includes(country);
}

/** Zusätzlich freigeschaltete Länder aus einer Liste wie "FR, IT,NL" */
export function parseCountryList(v: string | undefined): string[] {
  return String(v || "")
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}
