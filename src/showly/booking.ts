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

/* ---------------------------------------------------------------------------
 * Nichterscheinen: Anhörung, Check-in und Stufenmodell (AGB §§ 9, 23)
 * ------------------------------------------------------------------------ */

/** Tage, die ein Künstler nach einer Meldung "nicht erschienen" hat, um sich
 *  zu äußern oder einen Notfall zu belegen. Erst danach wird die Strafe fällig. */
export const HEARING_DAYS = 7;

const DAY = 86400000;

/** Vierstelliger Code, den der Kunde sieht und der Künstler vor Ort eingibt */
export function newCheckinCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

/** Code einer Buchung; ältere Buchungen ohne Code bekommen einen festen aus der Kennung */
export function checkinCodeOf(b: { id: number; checkinCode?: string }): string {
  return b.checkinCode || String(1000 + ((b.id * 7919) % 9000));
}

/** Einchecken geht von 2 Stunden vor bis 6 Stunden nach Beginn */
export function checkinOpen(b: { dateISO: string; slot?: string }, now = Date.now()): boolean {
  const s = startOf(b);
  return now >= s - 2 * 3600000 && now <= s + 6 * 3600000;
}

/** 30 Minuten nach Beginn ohne Check-in: Kunde wird gefragt, ob der Künstler da ist */
export function presenceQuestion(
  b: { dateISO: string; slot?: string; status: string; checkedInAt?: string },
  now = Date.now(),
): boolean {
  if (b.checkedInAt || (b.status !== "confirmed" && b.status !== "pending")) return false;
  const s = startOf(b);
  return now >= s + 30 * 60000 && now <= s + DAY;
}

export interface StrikePenalty {
  artistId: number;
  reason: "late" | "noshow";
  status: string;
  dateISO: string;
  dueAt?: string;
}

export interface Standing {
  /** Anzahl fälliger Strafen wegen Nichterscheinens in den letzten 12 Monaten */
  strikes: number;
  /** darf gebucht werden (nicht gesperrt, nicht entfernt) */
  bookable: boolean;
  /** Sofortbuchung erlaubt; nach einem Verstoß 30 Tage nur Anfragen */
  instantAllowed: boolean;
  /** in der Suche weiter unten */
  demoted: boolean;
  removed: boolean;
  /** Ende der aktuellen Einschränkung oder Sperre (ISO-Datum) */
  until?: string;
}

/** Stufenmodell (AGB § 23 Abs. 5), gezählt werden fällige Strafen wegen
 *  Nichterscheinens in den letzten 12 Monaten:
 *   1 → Verwarnung, 30 Tage nur Anfragen und weiter unten in der Suche
 *   2 → zusätzlich 60 Tage gesperrt
 *   3 → dauerhaft entfernt */
export function standingOf(artistId: number, penalties: StrikePenalty[], now = Date.now()): Standing {
  const strikes = penalties
    .filter((p) => p.artistId === artistId && p.reason === "noshow" && p.status === "due")
    .map((p) => new Date(p.dueAt || p.dateISO).getTime())
    .filter((t) => now - t < 365 * DAY)
    .sort((a, b) => a - b);
  const n = strikes.length;
  const last = strikes[n - 1];
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  if (n >= 3) return { strikes: n, bookable: false, instantAllowed: false, demoted: true, removed: true };
  if (n === 2 && last !== undefined && now < last + 60 * DAY)
    return { strikes: n, bookable: false, instantAllowed: false, demoted: true, removed: false, until: iso(last + 60 * DAY) };
  if (n >= 1 && last !== undefined && now < last + 30 * DAY)
    return { strikes: n, bookable: true, instantAllowed: false, demoted: true, removed: false, until: iso(last + 30 * DAY) };
  return { strikes: n, bookable: true, instantAllowed: true, demoted: false, removed: false };
}

/* Sicherheitseinbehalt (AGB § 21 Abs. 5): Von den ersten 5 Buchungen eines
   Künstlers werden 20 % der Gage 30 Tage nach dem Termin ausgezahlt statt
   sofort. Wirklich umgesetzt wird das mit Stripe Connect. */
export const RESERVE_FIRST_BOOKINGS = 5;
export const RESERVE_RATE = 0.2;
export const RESERVE_DAYS = 30;
