/* Termine belegen, auf dem Server.
 *
 * Die eigentliche Sicherheit liegt in der Datenbank (Migration 0012,
 * claim_slots): Zeilensperre je Künstler, Ausschlussregel gegen
 * Überschneidungen (inkl. einer Stunde Fahrtzeit), alles oder nichts.
 * Diese Datei ruft sie auf und übersetzt die Antwort.
 *
 * Ablauf an der Kasse:
 *   1. createCartCheckout reserviert alle Künstler-Termine für HOLD_MINUTES
 *      (kind "hold", Schlüssel holdKey). Ist einer belegt, gibt es keine
 *      Zahlung, sondern die Bitte, eine andere Zeit zu wählen.
 *   2. Nach der Zahlung wandelt recordCart die Reservierung in eine Buchung
 *      um (kind "booking"). Ist sie abgelaufen, wird neu geprüft.
 *   3. Bricht jemand ab, gibt releaseCartHold die Reservierung sofort frei;
 *      sonst läuft sie von selbst ab. */
import { adminClient } from "./supabase.server";

/** So lange bleibt ein Termin während des Bezahlens reserviert */
export const HOLD_MINUTES = 15;

export type ClaimReason = "busy" | "blocked" | "external" | "unknown";
export type ClaimResult = { ok: true } | { ok: false; index: number; reason: ClaimReason };

export interface ClaimItem {
  artist_id: number;
  day: string;
  slot: string;
  hours: number;
  booking_id?: number;
}

export function newHoldKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const isHoldKey = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{32}$/.test(v);

export async function claimSlots(
  items: ClaimItem[],
  kind: "hold" | "booking",
  holdKey: string | null = null,
  minutes = HOLD_MINUTES,
): Promise<ClaimResult> {
  if (!items.length) return { ok: true };
  const { data, error } = await adminClient().rpc("claim_slots", {
    p_items: items,
    p_kind: kind,
    p_hold_key: holdKey,
    p_minutes: minutes,
  });
  if (error || !data) return { ok: false, index: 0, reason: "busy" };
  const r = data as { ok: boolean; index?: number; reason?: ClaimReason };
  return r.ok ? { ok: true } : { ok: false, index: r.index ?? 0, reason: r.reason ?? "busy" };
}

export async function releaseHold(holdKey: string): Promise<void> {
  if (!isHoldKey(holdKey)) return;
  await adminClient().rpc("release_hold", { p_hold_key: holdKey });
}

/** Verständliche Meldung, wenn ein Termin nicht (mehr) frei ist */
export function claimMessage(reason: ClaimReason, lang: string, when: { day: string; slot: string }): string {
  const d = when.day.split("-").reverse().join(".");
  if (lang === "en")
    return reason === "external"
      ? `The artist already has another commitment around ${when.slot} on ${d} (incl. one hour of travel time). Please choose another time.`
      : `The slot on ${d} at ${when.slot} has just been taken or reserved by someone else (one hour of travel time is kept free between shows). Please choose another time.`;
  if (lang === "es")
    return reason === "external"
      ? `El artista ya tiene otro compromiso cerca de las ${when.slot} el ${d} (con una hora de desplazamiento). Elige otra hora.`
      : `La cita del ${d} a las ${when.slot} acaba de ser reservada por otra persona (entre dos shows queda una hora de desplazamiento). Elige otra hora.`;
  return reason === "external"
    ? `Der Künstler hat am ${d} um ${when.slot} schon einen anderen Termin (inkl. einer Stunde Fahrtzeit). Bitte wähle eine andere Uhrzeit.`
    : `Der Termin am ${d} um ${when.slot} ist gerade von jemand anderem gebucht oder reserviert worden (zwischen zwei Shows bleibt eine Stunde Fahrtzeit). Bitte wähle eine andere Uhrzeit.`;
}
