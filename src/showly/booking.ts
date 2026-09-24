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

/* Stornierung ohne Grund bis 24 Stunden vor Beginn (AGB §§ 8, 9). Danach:
 * Kunden schulden die Gage. Künstler zahlen eine Vertragsstrafe von 50 %
 * ihrer Gage (nicht erschienen: 100 %), es sei denn, sie belegen einen Notfall (etwa Unfall auf dem
 * Weg, akute Krankheit mit Attest); der Kunde bekommt dann alles zurück und
 * zusätzlich einen Gutschein. Dasselbe gilt, wenn ein Künstler nicht
 * erscheint. */
export const FREE_CANCEL_HOURS = 24;
export const VOUCHER_EUR = 50;
/** Vertragsstrafe in Prozent der Gage: späte Absage 50 %, nicht erschienen 100 % */
export const PENALTY_RATE = { late: 0.5, noshow: 1 } as const;

export function startOf(b: { dateISO: string; slot?: string }): number {
  return new Date(`${b.dateISO}T${b.slot || "00:00"}:00`).getTime();
}

export function isLateCancel(b: { dateISO: string; slot?: string }, now = Date.now()): boolean {
  return startOf(b) - now < FREE_CANCEL_HOURS * 3600 * 1000;
}

/** Gutscheincode, gut lesbar, ohne leicht verwechselbare Zeichen */
export function voucherCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `SHOWLY-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Gutscheine gelten drei Jahre, bis zum Jahresende (§§ 195, 199 BGB) */
export function voucherValidUntil(from = new Date()): string {
  return `${from.getFullYear() + 3}-12-31`;
}
