/* Location-Buchungen: Liste für Anbieter und Kunden, Zusage/Absage durch den
 * Anbieter, Schaden melden (Kaution). Die genaue Adresse bekommt der Kunde
 * erst nach Zusage und Zahlung. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";

export interface VenueBookingView {
  id: number;
  venueId: number;
  venueName: string;
  day: string;
  start: string;
  hours: number;
  guests: number;
  pkg: string | null;
  occasion: string | null;
  notes: string | null;
  amount: number;
  payout: number;
  deposit: number;
  depositStatus: string;
  status: string;
  /** nur für den Kunden, nach Zusage und Zahlung */
  address: string | null;
  /** Kundenname: für den Anbieter erst nach Zusage */
  customer: string | null;
  role: "owner" | "customer";
}

async function ctxOrNull() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export const myVenueBookings = createServerFn({ method: "POST" }).handler(async (): Promise<VenueBookingView[]> => {
  const ctx = await ctxOrNull();
  if (!ctx) return [];
  const db = adminClient();
  const uid = ctx.user.id;
  const { data } = await db
    .from("venue_bookings")
    .select("*")
    .or(`owner.eq.${uid},customer.eq.${uid}`)
    .order("day", { ascending: true })
    .limit(300);
  const ids = [...new Set((data || []).map((b) => b.venue_id))];
  const { data: provs } = ids.length ? await db.from("providers").select("id, data").in("id", ids) : { data: [] };
  const info = new Map((provs || []).map((p) => [p.id, p.data as Record<string, unknown>]));
  return (data || []).map((b) => {
    const d = info.get(b.venue_id) ?? {};
    const role = b.owner === uid ? "owner" : "customer";
    const ok = b.status === "confirmed" || b.status === "completed";
    return {
      id: b.id,
      venueId: b.venue_id,
      venueName: String(d["name"] || "Location"),
      day: b.day,
      start: b.start,
      hours: b.hours,
      guests: b.guests,
      pkg: b.pkg,
      occasion: b.occasion,
      notes: b.notes,
      amount: b.amount_cents / 100,
      payout: b.payout_cents / 100,
      deposit: b.deposit_cents / 100,
      depositStatus: b.deposit_status,
      status: b.status,
      address: role === "customer" && ok && b.paid ? String(d["address"] || "") || null : null,
      customer: role === "owner" && ok ? b.customer_name : null,
      role,
    };
  });
});

/** Anbieter sagt eine Anfrage zu oder ab. Absage: alles zurück an den Kunden. */
export const respondVenue = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; accept: boolean }) => ({ id: Math.round(Number(d.id)), accept: d.accept === true }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await ctxOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: b } = await db.from("venue_bookings").select("*").eq("id", data.id).maybeSingle();
    if (!b || b.owner !== ctx.user.id) return { error: "Buchung nicht gefunden" };
    if (b.status !== "requested") return { error: "Diese Anfrage ist schon beantwortet" };
    const { notify } = await import("@/lib/notify.server");
    if (!data.accept) {
      await db.from("venue_bookings").update({ status: "declined" }).eq("id", b.id);
      if (b.sub_order_id) await db.from("sub_orders").update({ status: "declined" }).eq("id", b.sub_order_id);
      if (b.paid) {
        const { refundVenue } = await import("@/lib/venues.server");
        await refundVenue(b.id, { reason: "die Location hat abgesagt" }).catch(() => null);
      }
      if (b.customer)
        await notify(b.customer, "Deine Location-Anfrage wurde abgelehnt", [
          "Die Location kann an deinem Termin leider nicht. Du bekommst den vollen Betrag zurück.",
          "Auf Showly findest du freie Locations für denselben Tag.",
        ]).catch(() => false);
      return { ok: true };
    }
    await db.from("venue_bookings").update({ status: "confirmed" }).eq("id", b.id);
    if (b.sub_order_id) {
      await db.from("sub_orders").update({ status: "confirmed" }).eq("id", b.sub_order_id);
      /* Auszahlung 7 Tage nach dem Event, wie bei allen Anbietern */
      const { orderPayoutDay } = await import("@/showly/policies");
      const { reserveFor, provisionFelder } = await import("@/showly/cloudRules");
      const { count } = await db.from("payouts").select("id", { count: "exact", head: true }).eq("owner", ctx.user.id);
      const when = orderPayoutDay({ cakeDays: [b.day], orderDay: new Date().toISOString().slice(0, 10) });
      await db.from("payouts").upsert(
        {
          sub_order_id: b.sub_order_id,
          owner: ctx.user.id,
          kind: "location",
          booking_id: null,
          artist_id: null,
          gross_cents: b.amount_cents,
          fee_cents: b.fee_cents,
          ...provisionFelder(b.amount_cents, b.fee_cents),
          event_day: when.event_day,
          payout_on: when.payout_on,
          ...reserveFor(when.event_day, b.payout_cents, count || 0),
        },
        { onConflict: "sub_order_id" },
      );
    }
    if (b.customer)
      await notify(b.customer, "Deine Location ist bestätigt", [
        `Die Location hat deine Buchung am ${b.day.split("-").reverse().join(".")} ab ${b.start} Uhr bestätigt.`,
        "Die genaue Adresse und alle Angaben findest du jetzt in der App unter deinen Buchungen.",
      ]).catch(() => false);
    return { ok: true };
  });

/** Anbieter meldet nach dem Event einen Schaden: die Kaution bleibt gehalten, Showly prüft */
export const reportVenueDamage = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; text: string }) => ({ id: Math.round(Number(d.id)), text: String(d.text || "").slice(0, 1500) }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await ctxOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: b } = await db.from("venue_bookings").select("id, owner, day, deposit_status").eq("id", data.id).maybeSingle();
    if (!b || b.owner !== ctx.user.id) return { error: "Buchung nicht gefunden" };
    if (b.deposit_status !== "held") return { error: "Für diese Buchung gibt es keine Kaution mehr" };
    if (data.text.trim().length < 10) return { error: "Bitte beschreibe den Schaden kurz" };
    /* Gemeldete Schäden laufen nicht automatisch aus (releaseDueDeposits): Showly entscheidet */
    await db.from("venue_bookings").update({ deposit_status: "kept" }).eq("id", b.id);
    await db.from("support_tickets").insert({
      profile: ctx.user.id,
      email: "support@showly.eu",
      name: "Location",
      topic: "booking",
      body: `Schaden gemeldet zu Location-Buchung ${b.id} (${b.day}): ${data.text.trim()}`,
    });
    return { ok: true };
  });
