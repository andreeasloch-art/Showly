/* Locations auf dem Server: Termin prüfen und belegen, Erstattung, Kaution.
 *
 * Belegt wird über venue_reservieren (Migration 0024): unter einer Sperre je
 * Location wird gezählt, wie viele Feiern sich (samt Reinigungspuffer) mit
 * der gewünschten Zeit überschneiden; mehr als `parallel` gehen nicht. */
import { adminClient } from "@/lib/supabase.server";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { sendMail } from "@/lib/mail.server";
import type { Venue } from "@/showly/locations";

type Db = ReturnType<typeof adminClient>;
const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";

/** Ist zur Zeit noch ein Platz frei? (nur lesen, vor der Zahlung) */
export async function venueHasRoom(db: Db, v: Venue, day: string, start: string, hours: number): Promise<boolean> {
  const { data } = await db
    .from("venue_bookings")
    .select("starts_at, ends_at")
    .eq("venue_id", v.id)
    .eq("day", day)
    .in("status", ["requested", "confirmed"]);
  const startMs = berlin(day, start);
  const endMs = startMs + hours * 3_600_000;
  const buf = v.bufferMin * 60_000;
  const busy = (data || []).filter((x) => Date.parse(x.starts_at) < endMs + buf && startMs < Date.parse(x.ends_at) + buf).length;
  return busy < Math.max(1, v.parallel);
}

/** Uhrzeit in Berlin → Zeitpunkt (ms) */
function berlin(day: string, hm: string): number {
  const guess = Date.parse(`${day}T${hm}:00Z`);
  const off = new Date(guess).toLocaleString("en-US", { timeZone: "Europe/Berlin", hour12: false, timeZoneName: "shortOffset" });
  const m = /GMT([+-]\d+)/.exec(off);
  return guess - (m ? Number(m[1]) : 1) * 3_600_000;
}

async function emailOf(db: Db, profile: string | null | undefined) {
  if (!profile) return null;
  const { data } = await db.from("profiles").select("email").eq("id", profile).maybeSingle();
  return data?.email ?? null;
}

/** Location-Buchung (ganz oder teilweise) erstatten; ohne Betrag alles inkl. Kaution */
export async function refundVenue(
  id: number,
  opts: { cents?: number; reason?: string; env?: "sandbox" | "live" } = {},
): Promise<{ ok: true; cents: number } | { error: string }> {
  const db = adminClient();
  const { data: b } = await db.from("venue_bookings").select("*").eq("id", id).maybeSingle();
  if (!b || !b.paid || !b.stripe_session_id) return { error: "Keine bezahlte Buchung" };
  const cents = Math.max(1, Math.round(opts.cents ?? b.amount_cents + (b.deposit_status === "held" ? b.deposit_cents : 0)));
  const { stripeEnv } = await import("@/lib/money.server");
  const env = opts.env ?? stripeEnv();
  try {
    const stripe = createStripeClient(env);
    const s = await stripe.checkout.sessions.retrieve(b.stripe_session_id.split(":")[0]!);
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
    if (!pi) return { error: "Keine Stripe-Zahlung zu dieser Buchung" };
    await stripe.refunds.create(
      { payment_intent: pi, amount: cents, metadata: { venue_booking_id: String(b.id) } },
      { idempotencyKey: `venue-refund-${b.id}-${cents}` },
    );
  } catch (e) {
    return { error: getStripeErrorMessage(e) };
  }
  const to = await emailOf(db, b.customer);
  if (to)
    await sendMail(to, "Erstattung deiner Location-Buchung", [
      `Wir haben ${euro(cents)} erstattet${opts.reason ? ` (${opts.reason})` : ""}.`,
      "Das Geld geht auf das Zahlungsmittel zurück, mit dem du bezahlt hast.",
    ]).catch(() => false);
  return { ok: true, cents };
}

/** Kaution nach dem Event zurückzahlen (ganz oder abzüglich Schaden) */
export async function releaseVenueDeposit(id: number, keepCents = 0): Promise<{ ok: true } | { error: string }> {
  const db = adminClient();
  const { data: b } = await db.from("venue_bookings").select("*").eq("id", id).maybeSingle();
  if (!b || b.deposit_status !== "held") return { error: "Keine gehaltene Kaution" };
  const back = Math.max(0, b.deposit_cents - Math.max(0, keepCents));
  if (back > 0) {
    const r = await refundVenue(id, { cents: back, reason: "Kaution" });
    if ("error" in r) return r;
  }
  await db.from("venue_bookings").update({ deposit_status: keepCents > 0 ? "kept" : "released" }).eq("id", id);
  return { ok: true };
}

/** Täglich: Kautionen 3 Tage nach dem Event zurückzahlen, wenn kein Schaden gemeldet ist */
export async function releaseDueDeposits(): Promise<number> {
  const db = adminClient();
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db
    .from("venue_bookings")
    .select("id")
    .eq("deposit_status", "held")
    .in("status", ["confirmed", "completed"])
    .lte("day", cutoff)
    .limit(200);
  let n = 0;
  for (const r of data || []) if ("ok" in (await releaseVenueDeposit(r.id))) n++;
  return n;
}

/** Täglich: Anfragen, die nach 48 Stunden (oder bis zum Tag vor dem Event) nicht
 *  beantwortet sind, verfallen; der Kunde bekommt alles zurück */
export async function expireVenueRequests(): Promise<number> {
  const db = adminClient();
  const before = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const { data } = await db
    .from("venue_bookings")
    .select("id, customer, sub_order_id, paid, requested_at, day")
    .eq("status", "requested")
    .or(`requested_at.lte.${before},day.lte.${tomorrow}`)
    .limit(200);
  let n = 0;
  for (const b of data || []) {
    const { data: upd } = await db.from("venue_bookings").update({ status: "declined" }).eq("id", b.id).eq("status", "requested").select("id");
    if (!upd?.length) continue;
    n++;
    if (b.sub_order_id) await db.from("sub_orders").update({ status: "declined" }).eq("id", b.sub_order_id);
    if (b.paid) await refundVenue(b.id, { reason: "die Location hat nicht rechtzeitig bestätigt" }).catch(() => null);
  }
  return n;
}
