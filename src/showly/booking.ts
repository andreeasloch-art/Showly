/* Buchungsmodus der Künstler.
 *
 * Künstler legen im Profil fest, ob Kunden freie Termine sofort verbindlich
 * buchen können ("Sofortbuchung", Standard) oder ob jede Buchung zuerst als
 * Anfrage kommt, die sie annehmen oder ablehnen. Eine Anfrage hält den Termin
 * vorläufig frei. Wird sie nicht innerhalb von RESPOND_HOURS beantwortet,
 * verfällt sie, der Termin wird wieder frei und eine reservierte Zahlung
 * wird nicht abgebucht. */
import type { Artist } from "./data";

export const RESPOND_HOURS = 48;

export function isInstant(a: Artist | null | undefined): boolean {
  return !a || (a as Record<string, unknown>)["instantBook"] !== false;
}

/** Bis wann eine Anfrage beantwortet sein muss (ISO-Zeit) */
export function respondBy(requestedAt: string | undefined): string | null {
  if (!requestedAt) return null;
  const t = new Date(requestedAt).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + RESPOND_HOURS * 3600 * 1000).toISOString();
}

/** Anfrage verfallen: Frist abgelaufen oder der Termin ist schon vorbei */
export function requestExpired(
  b: { status: string; requestedAt?: string; dateISO: string },
  now = new Date(),
): boolean {
  if (b.status !== "requested") return false;
  const until = respondBy(b.requestedAt);
  if (until && new Date(until) < now) return true;
  const today = now.toISOString().slice(0, 10);
  return b.dateISO < today;
}
