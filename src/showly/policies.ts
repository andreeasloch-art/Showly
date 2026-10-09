/* Faire Regeln für Storno, Absage, Reklamation, Mietschäden, Bewertungen
 * und Auszahlung. Ohne Datenbankzugriff, damit sie sich prüfen lassen
 * (policies.test.ts). Server und App rechnen mit denselben Funktionen.
 *
 *  - Stornostufen: jeder Anbieter wählt Flexibel, Moderat oder Streng. Die
 *    gewählte Stufe wird mit der Buchung gespeichert; spätere Änderungen
 *    gelten nur für neue Buchungen (AGB § 8).
 *  - Torten: kostenlos bis Produktionsbeginn, danach nicht mehr.
 *  - Verleih: kostenlos bis kurz vor Versand bzw. Abholung, danach ein
 *    Teilbetrag plus schon angefallene Versandkosten.
 *  - Einmal kostenlos umbuchen auf einen Termin innerhalb von 6 Monaten.
 *  - Gebühren sind pauschalierter Schadensersatz; Kunden dürfen einen
 *    geringeren Schaden nachweisen (§ 309 Nr. 5 b BGB).
 *  - Künstler sagt ab: gestaffelte Vertragsstrafe, Verwarnungen, Sperre.
 *  - Auszahlung immer 7 Tage nach dem Event, schneller gegen Gebühr. */

const HOUR = 3600000;
const DAY = 24 * HOUR;

/* ---------------------------------------------------------------------------
 * Stornostufen
 * ------------------------------------------------------------------------ */
export type CancelTier = "flexibel" | "moderat" | "streng";
export const CANCEL_TIER_IDS: CancelTier[] = ["flexibel", "moderat", "streng"];
export const DEFAULT_TIER: CancelTier = "moderat";

/** Grenzen in Stunden vor Beginn: bis `free` kostenlos, bis `half` 50 %, danach 100 % */
export const CANCEL_TIERS: Record<CancelTier, { free: number; half: number }> = {
  flexibel: { free: 7 * 24, half: 48 },
  moderat: { free: 14 * 24, half: 7 * 24 },
  streng: { free: 30 * 24, half: 14 * 24 },
};

export function tierOf(v: unknown): CancelTier {
  return CANCEL_TIER_IDS.includes(v as CancelTier) ? (v as CancelTier) : DEFAULT_TIER;
}

/** Torten: Produktionsbeginn so viele Tage vor dem Liefertag, mindestens 2 */
export const CAKE_MIN_LEAD_DAYS = 2;
/** Verleih: kostenlos bis 3 Tage vor Mietbeginn (Versand/Abholung) */
export const RENT_FREE_HOURS = 72;
/** Verleih: danach bleibt dieser Anteil des Mietpreises plus Versand */
export const RENT_LATE_RATE = 0.25;
/** Einmal kostenlos umbuchen, neuer Termin höchstens so viele Monate nach dem alten */
export const REBOOK_MONTHS = 6;
/** Umbuchen geht bis so viele Stunden vor Beginn */
export const REBOOK_UNTIL_HOURS = 48;

export type PolicyKind = "artist" | "cake" | "rental";

/** Was mit der Buchung gespeichert wird. Spätere Änderungen am Profil
 *  ändern diese Werte nicht mehr. */
export interface PolicySnapshot {
  kind: PolicyKind;
  tier: CancelTier;
  /** Stunden vor Beginn: bis hier kostenlos */
  free: number;
  /** Stunden vor Beginn: bis hier 50 % (bei Torte gleich `free`) */
  half: number;
  /** Anteil, der nach `free` bleibt (Torte 1, Verleih 0,25, sonst 0,5) */
  midRate: number;
  rebook: boolean;
}

export function policySnapshot(kind: PolicyKind, tier: unknown, leadDays = 0): PolicySnapshot {
  const t = tierOf(tier);
  if (kind === "cake") {
    const h = Math.max(CAKE_MIN_LEAD_DAYS, Math.round(leadDays) || 0) * 24;
    return { kind, tier: t, free: h, half: h, midRate: 1, rebook: false };
  }
  if (kind === "rental") return { kind, tier: t, free: RENT_FREE_HOURS, half: 0, midRate: RENT_LATE_RATE, rebook: true };
  return { kind, tier: t, ...CANCEL_TIERS[t], midRate: 0.5, rebook: true };
}

export function cleanSnapshot(v: unknown): PolicySnapshot | null {
  const o = (v || {}) as Partial<PolicySnapshot>;
  if (o.kind !== "artist" && o.kind !== "cake" && o.kind !== "rental") return null;
  const n = (x: unknown) => Math.max(0, Math.min(24 * 400, Number(x) || 0));
  return {
    kind: o.kind,
    tier: tierOf(o.tier),
    free: n(o.free),
    half: n(o.half),
    midRate: Math.max(0, Math.min(1, Number(o.midRate) || 0)),
    rebook: o.rebook === true,
  };
}

export type CancelStage = "free" | "mid" | "full";

/** Kunde storniert: welcher Anteil bleibt beim Anbieter, was geht zurück.
 *  `shipCents` (Verleih) bleibt nach der kostenlosen Frist zusätzlich. */
export function customerCancel(
  p: PolicySnapshot,
  start: number,
  now: number,
  amountCents: number,
  shipCents = 0,
): { stage: CancelStage; keepCents: number; refundCents: number; rate: number } {
  const left = (start - now) / HOUR;
  let stage: CancelStage;
  let rate: number;
  if (left >= p.free) {
    stage = "free";
    rate = 0;
  } else if (p.kind === "rental") {
    stage = "mid";
    rate = p.midRate;
  } else if (left >= p.half && p.half < p.free) {
    stage = "mid";
    rate = p.midRate;
  } else {
    stage = "full";
    rate = 1;
  }
  const extra = stage === "free" ? 0 : Math.min(shipCents, amountCents);
  const keep = Math.min(amountCents, Math.round((amountCents - extra) * rate) + extra);
  return { stage, rate, keepCents: keep, refundCents: amountCents - keep };
}

/** Darf der Kunde (noch) kostenlos umbuchen? Einmal, bis 48 Stunden vorher */
export function canRebook(
  p: PolicySnapshot | null,
  b: { rebooked_at?: string | null; status: string },
  start: number,
  now: number,
): boolean {
  if (!p?.rebook || b.rebooked_at) return false;
  if (b.status !== "confirmed" && b.status !== "pending") return false;
  return start - now >= REBOOK_UNTIL_HOURS * HOUR;
}

/** Neuer Termin gültig? Nicht in der Vergangenheit, höchstens 6 Monate nach dem alten */
export function rebookTargetOk(oldDay: string, newDay: string, todayISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDay) || newDay <= todayISO || newDay === oldDay) return false;
  const d = new Date(oldDay + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + REBOOK_MONTHS);
  return newDay <= d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
 * Künstler sagt ab oder erscheint nicht (AGB § 9)
 * ------------------------------------------------------------------------ */
/** Unter 14 Tagen: 15 % der Gage, unter 48 Stunden: 25 %, nicht erschienen: 100 % */
export const ARTIST_LATE_DAYS = 14;
export const ARTIST_PENALTY = { late: 0.15, urgent: 0.25, noshow: 1 } as const;
export const URGENT_HOURS = 48;

export function artistCancelStage(start: number, now: number): "free" | "late" | "urgent" {
  const left = start - now;
  if (left >= ARTIST_LATE_DAYS * DAY) return "free";
  return left < URGENT_HOURS * HOUR ? "urgent" : "late";
}

/** Verwarnungen in 12 Monaten bis zur Sperre */
export const WARNINGS_TO_BAN = 3;

/** Stornoquote des Künstlers (Absagen durch ihn / alle angenommenen Buchungen) */
export function cancelRate(cancelled: number, total: number): number {
  return total > 0 ? Math.min(1, cancelled / total) : 0;
}

/** Abzug in der Sortierung: je 10 % Stornoquote eine halbe Stufe */
export function rankingPenalty(rate: number): number {
  return Math.round(rate * 50) / 10;
}

/* ---------------------------------------------------------------------------
 * Ersatzgarantie
 * ------------------------------------------------------------------------ */
/** Aufpreis für Ersatz, den Showly höchstens übernimmt (Euro) */
export const UPGRADE_CAP_EUR = 100;
/** Entschuldigungs-Gutschein: 15 % des Buchungsbetrags, mindestens 10 € */
export const APOLOGY_RATE = 0.15;
export const APOLOGY_MIN_EUR = 10;
/** Bonus für Springer, die kurzfristig einspringen (aus dem Garantie-Topf) */
export const STANDBY_BONUS = 0.1;
/** Ohne Check-in so viele Minuten nach Beginn: Nachricht an beide */
export const CHECKIN_ALERT_MIN = 15;

export function apologyVoucherCents(amountCents: number): number {
  return Math.max(APOLOGY_MIN_EUR * 100, Math.round(amountCents * APOLOGY_RATE));
}

export interface Candidate {
  id: number;
  cat: string;
  city: string;
  rating: number;
  price_cents: number;
  standby: boolean;
  busy: boolean;
  blocked: boolean;
}

/** Drei Ersatz-Künstler: gleiche Kategorie, gleiche Stadt, an dem Termin frei.
 *  Springer zuerst, dann nach Bewertung und ähnlichem Preis. */
export function pickReplacements(orig: { id: number; cat: string; city: string; price_cents: number }, list: Candidate[], n = 3): Candidate[] {
  const city = orig.city.trim().toLowerCase();
  return list
    .filter((c) => c.id !== orig.id && c.cat === orig.cat && !c.busy && !c.blocked && c.city.trim().toLowerCase() === city)
    .sort(
      (a, b) =>
        Number(b.standby) - Number(a.standby) ||
        b.rating - a.rating ||
        Math.abs(a.price_cents - orig.price_cents) - Math.abs(b.price_cents - orig.price_cents),
    )
    .slice(0, n);
}

/** Aufpreis, den Showly für den Ersatz übernimmt (Cent) */
export function upgradeCents(origCents: number, replacementCents: number): number {
  return Math.max(0, Math.min(UPGRADE_CAP_EUR * 100, replacementCents - origCents));
}

/* ---------------------------------------------------------------------------
 * Reklamation (AGB § 14 a)
 * ------------------------------------------------------------------------ */
export const COMPLAINT_HOURS = 48;
export const STATEMENT_HOURS = 48;
export const DECIDE_DAYS = 5;

export const COMPLAINT_CATS = ["late", "short", "different", "rude", "cake", "item"] as const;
export type ComplaintCat = (typeof COMPLAINT_CATS)[number];

export const COMPLAINT_LABEL: Record<ComplaintCat, string> = {
  late: "Zu spät gekommen",
  short: "Show zu kurz",
  different: "Anders als beschrieben",
  rude: "Unfreundlich",
  cake: "Torte falsch oder beschädigt",
  item: "Artikel mangelhaft",
};

/** Fotos/Videos Pflicht bei Torte und Mietartikel */
export function evidenceRequired(cat: ComplaintCat): boolean {
  return cat === "cake" || cat === "item";
}

/** Reklamieren geht bis 48 Stunden nach Ende des Termins */
export function complaintOpen(end: number, now: number): boolean {
  return now >= end - 6 * HOUR && now <= end + COMPLAINT_HOURS * HOUR;
}

/** Richtwerte als Vorschlag für die Einigung (Anteil des Betrags) */
export function guideline(
  cat: ComplaintCat,
  d: { lateMin?: number; bookedMin?: number; playedMin?: number },
): { min: number; max: number; text: string } {
  if (cat === "late") {
    const m = Math.max(0, Math.round(d.lateMin || 0));
    const r = Math.min(1, m / 100);
    return { min: r, max: r, text: `${m} Minuten zu spät: Richtwert ${Math.round(r * 100)} % (20 Minuten = 20 %)` };
  }
  if (cat === "short") {
    const booked = Math.max(1, d.bookedMin || 0);
    const r = Math.min(1, Math.max(0, (booked - (d.playedMin || 0)) / booked));
    return { min: r, max: r, text: `Kürzer als gebucht: anteilig ${Math.round(r * 100)} %` };
  }
  if (cat === "cake") return { min: 0.5, max: 1, text: "Falsches Motiv oder beschädigt: 50 bis 100 %" };
  if (cat === "item") return { min: 0.2, max: 1, text: "Mangelhafter Artikel: je nach Mangel 20 bis 100 %" };
  if (cat === "different") return { min: 0.2, max: 0.5, text: "Anders als beschrieben: 20 bis 50 %" };
  return { min: 0, max: 0.2, text: "Unfreundlich: bis 20 %" };
}

/** Kunden mit vielen Reklamationen markieren (3 in 12 Monaten) */
export const COMPLAINT_FLAG = 3;
export function frequentComplainer(dates: string[], now: number): boolean {
  return dates.filter((d) => now - new Date(d).getTime() < 365 * DAY).length >= COMPLAINT_FLAG;
}

/* ---------------------------------------------------------------------------
 * Mietschäden (AGB § 20)
 * ------------------------------------------------------------------------ */
export const DAMAGE_REPORT_HOURS = 72;
/** Sorglos-Paket: deckt kleine Schäden (alles außer Verlust) */
export const CAREFREE_EUR = 5;
/** Kaution: 20 bis 50 % des Neupreises */
export const DEPOSIT_MIN = 0.2;
export const DEPOSIT_MAX = 0.5;

export interface DamageItem {
  key: string;
  label: string;
  /** null = Zeitwert, legt der Vermieter fest */
  eur: number | null;
  small: boolean;
}
export const DAMAGE_CATALOG: DamageItem[] = [
  { key: "fleck", label: "Fleck, der sich nicht auswaschen lässt", eur: 15, small: true },
  { key: "riss", label: "Kleiner Riss oder offene Naht", eur: 25, small: true },
  { key: "teil", label: "Fehlendes Teil (Knopf, Accessoire)", eur: 10, small: true },
  { key: "schmutz", label: "Starke Verschmutzung über normale Reinigung hinaus", eur: 20, small: true },
  { key: "verlust", label: "Verlust oder Totalschaden", eur: null, small: false },
];

/** Kaution im erlaubten Rahmen: 20–50 % des Kaufpreises */
export function depositRange(buyEur: number): { min: number; max: number } {
  return { min: Math.round(buyEur * DEPOSIT_MIN), max: Math.round(buyEur * DEPOSIT_MAX) };
}

/** Schaden in Cent nach Katalog; `value` = Zeitwert bei Verlust.
 *  Mit Sorglos-Paket zahlt der Kunde für kleine Schäden nichts. Nie mehr als die Kaution. */
export function damageCents(
  items: { key: string; qty?: number }[],
  opts: { carefree: boolean; valueCents?: number; depositCents: number },
): number {
  let sum = 0;
  for (const it of items) {
    const d = DAMAGE_CATALOG.find((x) => x.key === it.key);
    if (!d) continue;
    if (d.small && opts.carefree) continue;
    const qty = Math.max(1, Math.min(20, Math.round(it.qty || 1)));
    sum += d.eur === null ? Math.max(0, opts.valueCents || 0) : d.eur * 100 * qty;
  }
  return Math.min(sum, opts.depositCents);
}

/** Verspätete Rückgabe: je weiterem Tag der Tagesmietpreis (AGB § 14 Abs. 4), höchstens 14 Tage */
export function lateFeeCents(lateDays: number, dayRateCents: number): number {
  const d = Math.max(0, Math.min(14, Math.round(lateDays) || 0));
  return d * Math.max(0, Math.round(dayRateCents));
}

/** Meldefrist vorbei, ohne Schaden: Kaution automatisch freigeben */
export function depositAutoRelease(returnedAt: string | null, damageReported: boolean, now: number): boolean {
  if (!returnedAt || damageReported) return false;
  return now > new Date(returnedAt).getTime() + DAMAGE_REPORT_HOURS * HOUR;
}

/* ---------------------------------------------------------------------------
 * Bewertungen
 * ------------------------------------------------------------------------ */
export const REVIEW_DAYS = 14;
export const REVIEW_REMINDER_DAYS = 1;
export const SUB_RATINGS = ["punctual", "quality", "kids", "value"] as const;
export type SubRating = (typeof SUB_RATINGS)[number];
export const SUB_LABEL: Record<SubRating, string> = {
  punctual: "Pünktlichkeit",
  quality: "Qualität",
  kids: "Kinderfreundlichkeit",
  value: "Preis-Leistung",
};

/** Bewerten möglich: ab dem Tag nach dem Event, 14 Tage lang */
export function reviewWindow(eventDay: string, now: number): "early" | "open" | "closed" {
  const start = new Date(eventDay + "T00:00:00Z").getTime() + DAY;
  if (now < start) return "early";
  return now <= start + REVIEW_DAYS * DAY ? "open" : "closed";
}

/** Doppelt verdeckt: sichtbar, wenn beide Seiten bewertet haben oder die Frist um ist */
export function reviewVisible(bothDone: boolean, eventDay: string, now: number): boolean {
  return bothDone || reviewWindow(eventDay, now) === "closed";
}

export function cleanSubRatings(v: unknown): Partial<Record<SubRating, number>> {
  const o = (v || {}) as Record<string, unknown>;
  const out: Partial<Record<SubRating, number>> = {};
  for (const k of SUB_RATINGS) {
    const n = Math.round(Number(o[k]));
    if (n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Auszahlung (AGB § 21): immer 7 Tage nach dem Event, schneller gegen Gebühr
 * ------------------------------------------------------------------------ */
export const PAYOUT_DAYS = 7;
export type PayoutSpeed = "standard" | "fast" | "express";
export const PAYOUT_SPEED: Record<PayoutSpeed, { days: number; fee: number }> = {
  standard: { days: PAYOUT_DAYS, fee: 0 },
  /** schneller: 3 Tage nach dem Event, 10 % Gebühr */
  fast: { days: 3, fee: 0.1 },
  /** innerhalb von 48 Stunden nach dem Event, 20 % Gebühr */
  express: { days: 2, fee: 0.2 },
};

export function speedOf(v: unknown): PayoutSpeed {
  return v === "fast" || v === "express" ? v : "standard";
}

export function addDays(dayISO: string, n: number): string {
  const d = new Date(dayISO.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Auszahlungstag und Gebühr für eine Geschwindigkeit; `baseNetCents` ohne Gebühr */
export function payoutFor(eventDay: string, baseNetCents: number, speed: PayoutSpeed) {
  const s = PAYOUT_SPEED[speed];
  const fee = Math.round(baseNetCents * s.fee);
  return { payout_on: addDays(eventDay, s.days), express_fee_cents: fee, net_cents: baseNetCents - fee, speed };
}

/** Auszahlungstag für Konditoreien und Deko-/Kostümanbieter: 7 Tage nach
 *  dem Liefertag bzw. Mietende; bei Käufen erst nach der Widerrufsfrist
 *  (14 Tage ab Bestellung, plus Versand). Gibt Ereignistag und Auszahlungstag. */
export const BUY_PAYOUT_DAYS = 21;
export function orderPayoutDay(p: { cakeDays?: string[]; rentTo?: string[]; buy?: boolean; orderDay: string }): { event_day: string; payout_on: string } {
  const dates = [...(p.cakeDays || []), ...(p.rentTo || [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const last = dates[dates.length - 1];
  const viaEvent = last ? addDays(last, PAYOUT_DAYS) : null;
  const viaBuy = p.buy ? addDays(p.orderDay, BUY_PAYOUT_DAYS) : null;
  const payout_on = [viaEvent, viaBuy].filter((x): x is string => !!x).sort().pop() ?? addDays(p.orderDay, PAYOUT_DAYS);
  return { event_day: last ?? p.orderDay, payout_on };
}
