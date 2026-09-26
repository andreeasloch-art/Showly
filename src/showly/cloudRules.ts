/* Regeln für Buchungen, wie der Server sie durchsetzt.
 *
 * Die App zeigt Absage, Check-in und Strafe sofort an. Verbindlich ist aber,
 * was der Server nach diesen Regeln in die Datenbank schreibt. Sie stehen
 * hier ohne Datenbankzugriff, damit sie sich prüfen lassen
 * (cloudRules.test.ts) und genau den AGB folgen:
 *
 *   § 8  Kunde storniert: bis 24 Stunden vorher kostenlos
 *   § 9  Künstler sagt ab: bis 24 Stunden vorher folgenlos, danach 50 %
 *        der Gage als Vertragsstrafe (Notfall mit Nachweis ausgenommen);
 *        nicht erschienen: 100 %, erst nach 7 Tagen Anhörung;
 *        Kunde bekommt bei fälliger Strafe einen Gutschein über 50 €
 *   § 7  Check-in-Code als Nachweis, dass der Künstler da war
 *   § 21 Auszahlung 5 Werktage nach dem Termin, Einbehalt bei den ersten 5
 *
 * Uhrzeiten von Terminen gelten in deutscher Zeit. Der Server läuft in UTC;
 * ohne Umrechnung läge die 24-Stunden-Grenze dort ein bis zwei Stunden
 * daneben. */
import {
  FREE_CANCEL_HOURS,
  HEARING_DAYS,
  PENALTY_RATE,
  RESERVE_DAYS,
  RESERVE_FIRST_BOOKINGS,
  RESERVE_RATE,
  RESPOND_HOURS,
  payoutDate,
} from "./booking";

const HOUR = 3600000;
const DAY = 24 * HOUR;
/** Bis wann ein Kunde ein Nichterscheinen melden kann (AGB § 9 Abs. 5) */
export const NOSHOW_REPORT_DAYS = 14;

/** Versatz der deutschen Zeit gegenüber UTC an einem Tag, in Minuten */
function berlinOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utc.getTime()) / 60000);
}

/** Beginn eines Termins als Zeitpunkt, Datum und Uhrzeit in deutscher Zeit */
export function berlinStart(day: string, slot?: string | null): number {
  const [h, m] = (slot && /^\d{2}:\d{2}$/.test(slot) ? slot : "00:00").split(":").map(Number);
  const naive = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    h,
    m,
  );
  /* Versatz am ungefähren Zeitpunkt bestimmen; an Umstellungstagen reicht das */
  return naive - berlinOffsetMinutes(new Date(naive)) * 60000;
}

export type Role = "customer" | "artist";

export type CloudAction =
  | { kind: "respond"; accept: boolean }
  | { kind: "cancelArtist"; emergency: boolean }
  | { kind: "cancelCustomer" }
  | { kind: "reportNoShow" }
  | { kind: "confirmPresence" }
  | { kind: "checkin"; code: string }
  | { kind: "claim"; statement?: string };

/** Was der Server über eine Buchung weiß (Auszug aus der Tabelle) */
export interface BookingFacts {
  status: string;
  day: string;
  slot: string | null;
  paid: boolean;
  payout_cents: number;
  /** aus booking_codes, nur der Server kennt ihn beim Künstler-Check-in */
  checkin_code?: string | null;
  checked_in_at: string | null;
  requested_at?: string | null;
  /** Anbieter gewerblich? Bei Privatanbietern keine Vertragsstrafe
   *  (§ 309 Nr. 6 BGB), nur das Stufenmodell. Fehlt die Angabe: gewerblich. */
  business?: boolean;
}

export interface PenaltyFacts {
  status: string;
}

export interface Decision {
  /** Änderungen an der Buchung */
  booking?: Record<string, unknown>;
  /** neue Vertragsstrafe */
  newPenalty?: {
    reason: "late" | "noshow";
    status: "hearing" | "due" | "proof";
    amount_cents: number;
    hearing_until?: string;
    due_at?: string;
  };
  /** Änderungen an der bestehenden Strafe */
  penalty?: Record<string, unknown>;
  /** Gutschein für den Kunden ausstellen */
  voucher?: boolean;
  /** geplante Auszahlung anlegen bzw. streichen */
  payout?: "create" | "cancel";
  /** Ergebnis für die Anzeige */
  result: "ok" | "free" | "penalty" | "proof" | "late";
}

export type Refusal = { error: string };

const OPEN = new Set(["confirmed", "pending"]);

function penaltyCents(b: BookingFacts, reason: "late" | "noshow") {
  if (b.business === false) return 0;
  return Math.round(b.payout_cents * PENALTY_RATE[reason]);
}

/** Entscheidet eine Aktion an einer Buchung. Gibt nie etwas zurück, das
 *  gegen die AGB verstößt; ungültige Schritte werden abgelehnt. */
export function decide(
  action: CloudAction,
  role: Role,
  b: BookingFacts,
  now = Date.now(),
  penalty?: PenaltyFacts | null,
): Decision | Refusal {
  const iso = new Date(now).toISOString();
  const start = berlinStart(b.day, b.slot);
  const late = start - now < FREE_CANCEL_HOURS * HOUR;

  switch (action.kind) {
    case "respond": {
      if (role !== "artist") return { error: "Nur der Künstler kann antworten" };
      if (b.status !== "requested") return { error: "Anfrage ist nicht mehr offen" };
      if (!action.accept) return { booking: { status: "declined" }, result: "ok" };
      return {
        booking: { status: b.paid ? "confirmed" : "pending" },
        ...(b.paid ? { payout: "create" as const } : {}),
        result: "ok",
      };
    }

    case "cancelArtist": {
      if (role !== "artist") return { error: "Nur der Künstler kann so absagen" };
      if (!OPEN.has(b.status) && b.status !== "requested") return { error: "Buchung ist nicht mehr offen" };
      if (now >= start) return { error: "Termin hat schon begonnen" };
      const booking = { status: "declined", cancelled_by: "artist", cancelled_at: iso };
      if (b.status === "requested" || !late) return { booking, payout: "cancel", result: "free" };
      const status = action.emergency ? "proof" : "due";
      return {
        booking,
        payout: "cancel",
        newPenalty: {
          reason: "late",
          status,
          amount_cents: penaltyCents(b, "late"),
          ...(status === "due" ? { due_at: iso } : {}),
        },
        voucher: status === "due",
        result: action.emergency ? "proof" : "penalty",
      };
    }

    case "cancelCustomer": {
      if (role !== "customer") return { error: "Nur der Kunde kann so stornieren" };
      if (!OPEN.has(b.status) && b.status !== "requested") return { error: "Buchung ist nicht mehr offen" };
      if (now >= start) return { error: "Termin hat schon begonnen" };
      const lateCancel = b.status !== "requested" && late;
      return {
        booking: { status: "cancelled", cancelled_by: "customer", cancelled_at: iso },
        /* Bei später Stornierung bleibt die Gage geschuldet (§ 8 Abs. 2) */
        ...(lateCancel ? {} : { payout: "cancel" as const }),
        result: lateCancel ? "late" : "free",
      };
    }

    case "reportNoShow": {
      if (role !== "customer") return { error: "Nur der Kunde kann das melden" };
      if (!OPEN.has(b.status)) return { error: "Buchung ist nicht offen" };
      if (b.checked_in_at) return { error: "Der Künstler hat eingecheckt" };
      if (now < start) return { error: "Termin hat noch nicht begonnen" };
      if (now > start + NOSHOW_REPORT_DAYS * DAY) return { error: "Meldefrist abgelaufen" };
      return {
        booking: { status: "noshow" },
        payout: "cancel",
        newPenalty: {
          reason: "noshow",
          status: "hearing",
          amount_cents: penaltyCents(b, "noshow"),
          hearing_until: new Date(now + HEARING_DAYS * DAY).toISOString(),
        },
        result: "ok",
      };
    }

    case "confirmPresence": {
      if (role !== "customer") return { error: "Nur der Kunde kann das bestätigen" };
      if (b.checked_in_at) return { result: "ok" };
      if (!OPEN.has(b.status)) return { error: "Buchung ist nicht offen" };
      return { booking: { checked_in_at: iso, checked_in_by: "customer" }, result: "ok" };
    }

    case "checkin": {
      if (role !== "artist") return { error: "Nur der Künstler checkt ein" };
      if (!OPEN.has(b.status)) return { error: "Buchung ist nicht offen" };
      if (b.checked_in_at) return { result: "ok" };
      if (now < start - 2 * HOUR || now > start + 6 * HOUR) return { error: "Einchecken ist gerade nicht möglich" };
      const code = String(action.code || "").replace(/\D/g, "");
      if (!b.checkin_code || code !== b.checkin_code) return { error: "Code stimmt nicht" };
      return { booking: { checked_in_at: iso, checked_in_by: "artist" }, result: "ok" };
    }

    case "claim": {
      if (role !== "artist") return { error: "Nur der Künstler kann das" };
      if (!penalty || (penalty.status !== "due" && penalty.status !== "hearing"))
        return { error: "Keine offene Vertragsstrafe" };
      return {
        penalty: {
          status: "proof",
          updated_at: iso,
          ...(action.statement ? { statement: action.statement.slice(0, 2000) } : {}),
        },
        result: "proof",
      };
    }
  }
}

/** Anfrage unbeantwortet: nach 48 Stunden oder wenn der Tag vorbei ist */
export function requestLapsed(b: BookingFacts, now = Date.now()): boolean {
  if (b.status !== "requested") return false;
  if (b.requested_at && new Date(b.requested_at).getTime() + RESPOND_HOURS * HOUR < now) return true;
  return berlinStart(b.day, "23:59") < now;
}

/** Anhörung abgelaufen, ohne dass der Künstler sich geäußert hat */
export function hearingOver(p: { status: string; hearing_until: string | null }, now = Date.now()): boolean {
  return p.status === "hearing" && !!p.hearing_until && new Date(p.hearing_until).getTime() < now;
}

/** Geplante Auszahlung zu einer Buchung (AGB § 21) */
export function plannedPayout(
  b: { day: string; amount_cents: number; payout_cents: number },
  earlierPayouts: number,
) {
  const reserve = earlierPayouts < RESERVE_FIRST_BOOKINGS ? Math.round(b.payout_cents * RESERVE_RATE) : 0;
  const reserveUntil = new Date(berlinStart(b.day, "12:00") + RESERVE_DAYS * DAY).toISOString().slice(0, 10);
  return {
    gross_cents: b.amount_cents,
    fee_cents: b.amount_cents - b.payout_cents,
    net_cents: b.payout_cents,
    reserve_cents: reserve,
    reserve_until: reserve ? reserveUntil : null,
    payout_on: payoutDate(b.day),
  };
}
