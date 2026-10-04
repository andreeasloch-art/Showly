/* Geld bewegen: Erstattungen an Kunden und Auszahlungen an Anbieter.
 *
 * Nur auf dem Server, nur mit dem Dienstschlüssel. Beides läuft über Stripe:
 *  - Erstattung: zurück auf das Zahlungsmittel der Buchung (AGB § 8 Abs. 3).
 *  - Auszahlung: Überweisung (Transfer) auf das Stripe-Connect-Konto der
 *    anbietenden Person, 5 Werktage nach dem Termin (AGB § 21). Der
 *    Sicherheitseinbehalt der ersten Buchungen folgt nach seiner Frist.
 *
 * Jede Funktion ist so gebaut, dass ein zweiter Aufruf nichts doppelt
 * auszahlt oder erstattet: Stripe bekommt einen Idempotenz-Schlüssel, und
 * die Datenbank merkt sich, was schon passiert ist. */
import { adminClient } from "./supabase.server";
import { createStripeClient, getStripeErrorMessage } from "./stripe.server";
import { sendMail } from "./mail.server";

/** Die Umgebung bestimmt der Server, wie bei der Ausweisprüfung */
export function stripeEnv(): "sandbox" | "live" {
  return process.env["STRIPE_LIVE_API_KEY"] && process.env["NODE_ENV"] === "production" ? "live" : "sandbox";
}

const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";

async function emailOf(profile: string | null | undefined): Promise<string | null> {
  if (!profile) return null;
  const { data } = await adminClient().from("profiles").select("email").eq("id", profile).maybeSingle();
  return data?.email ?? null;
}

/** Zahlung hinter einer Buchung: Payment Intent und Charge bei Stripe */
async function paymentOf(sessionField: string | null, env: "sandbox" | "live") {
  const session = String(sessionField || "").split(":")[0];
  if (!session) return null;
  const stripe = createStripeClient(env);
  const s = await stripe.checkout.sessions.retrieve(session, { expand: ["payment_intent"] });
  const pi = s.payment_intent;
  if (!pi || typeof pi === "string") return typeof pi === "string" ? { pi, charge: null } : null;
  const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
  return { pi: pi.id, charge };
}

/** Buchung (ganz oder teilweise) erstatten. Ohne Betrag: der ganze Rest. */
export async function refundBooking(
  bookingId: number,
  opts: { cents?: number; env?: "sandbox" | "live"; reason?: string } = {},
): Promise<{ ok: true; cents: number } | { error: string }> {
  const db = adminClient();
  const { data: b } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!b || !b.paid) return { error: "Keine bezahlte Buchung" };
  const left = b.amount_cents - b.refunded_cents;
  if (left <= 0) return { error: "Schon vollständig erstattet" };
  const cents = Math.min(left, Math.max(1, Math.round(opts.cents ?? left)));
  const env = opts.env ?? stripeEnv();
  try {
    const pay = await paymentOf(b.stripe_session_id, env);
    if (!pay) return { error: "Keine Stripe-Zahlung zu dieser Buchung" };
    await createStripeClient(env).refunds.create(
      { payment_intent: pay.pi, amount: cents, metadata: { booking_id: String(b.id) } },
      /* Gleicher Stand, gleicher Schlüssel: Stripe erstattet nie doppelt */
      { idempotencyKey: `refund-${b.id}-${b.refunded_cents}-${cents}` },
    );
  } catch (e) {
    return { error: getStripeErrorMessage(e) };
  }
  await db
    .from("bookings")
    .update({ refunded_cents: b.refunded_cents + cents, refunded_at: new Date().toISOString() })
    .eq("id", b.id);
  const to = await emailOf(b.customer);
  if (to)
    await sendMail(to, "Erstattung deiner Showly-Buchung", [
      `Wir haben ${euro(cents)} erstattet${opts.reason ? ` (${opts.reason})` : ""}.`,
      "Das Geld geht auf das Zahlungsmittel zurück, mit dem du bezahlt hast. Je nach Bank dauert die Gutschrift einige Tage.",
    ]);
  return { ok: true, cents };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Fällige Auszahlungen überweisen. Gibt zurück, was passiert ist. */
export async function runDuePayouts(): Promise<{ paid: number; held: number; skipped: number; failed: number }> {
  const db = adminClient();
  const env = stripeEnv();
  const out = { paid: 0, held: 0, skipped: 0, failed: 0 };
  const { data: due } = await db
    .from("payouts")
    .select("*")
    .in("status", ["scheduled", "held"])
    .lte("payout_on", today())
    .order("payout_on")
    .limit(100);

  for (const p of due || []) {
    /* Was jetzt fällig ist: zuerst die Gage ohne Einbehalt, später der
       Einbehalt, sobald seine Frist vorbei ist */
    const first = p.status === "scheduled";
    if (!first && (!p.reserve_until || p.reserve_until > today())) {
      out.skipped++;
      continue;
    }
    const cents = first ? p.net_cents - p.reserve_cents : p.reserve_cents;

    const { data: b } = await db
      .from("bookings")
      .select("id, status, paid, refunded_cents, stripe_session_id, artist_id")
      .eq("id", p.booking_id)
      .maybeSingle();
    /* Keine Auszahlung bei Storno, Nichterscheinen oder Erstattung */
    if (!b || !b.paid || b.refunded_cents > 0 || !["confirmed", "completed", "pending"].includes(b.status)) {
      await db.from("payouts").update({ status: "cancelled", last_error: "Buchung nicht (mehr) auszahlbar" }).eq("id", p.id);
      out.skipped++;
      continue;
    }
    /* Offene Meldung oder Strafe: erst klären */
    const { data: pen } = await db.from("penalties").select("status").eq("booking_id", p.booking_id).maybeSingle();
    if (pen && pen.status !== "waived") {
      await db.from("payouts").update({ last_error: "Wartet auf Klärung einer Meldung" }).eq("id", p.id);
      out.skipped++;
      continue;
    }

    const { data: artist } = await db.from("artists").select("owner").eq("id", p.artist_id ?? b.artist_id ?? 0).maybeSingle();
    const { data: acc } = artist?.owner
      ? await db.from("payout_accounts").select("stripe_account_id, payouts_enabled").eq("profile_id", artist.owner).maybeSingle()
      : { data: null };
    if (!acc?.stripe_account_id || !acc.payouts_enabled) {
      await db.from("payouts").update({ last_error: "Kein freigeschaltetes Auszahlungskonto" }).eq("id", p.id);
      out.skipped++;
      continue;
    }

    try {
      if (cents > 0) {
        const pay = await paymentOf(b.stripe_session_id, env).catch(() => null);
        const t = await createStripeClient(env).transfers.create(
          {
            amount: cents,
            currency: "eur",
            destination: acc.stripe_account_id,
            transfer_group: `booking_${b.id}`,
            /* Mit der Zahlung als Quelle geht die Überweisung auch, bevor
               das Geld auf dem Showly-Konto verfügbar ist */
            ...(pay?.charge ? { source_transaction: pay.charge } : {}),
            metadata: { booking_id: String(b.id), payout_id: String(p.id), part: first ? "gage" : "einbehalt" },
          },
          { idempotencyKey: `payout-${p.id}-${first ? "gage" : "einbehalt"}` },
        );
        await db
          .from("payouts")
          .update({ stripe_transfer_id: t.id, last_error: null })
          .eq("id", p.id);
      }
      const next = first && p.reserve_cents > 0 ? "held" : "paid";
      await db.from("payouts").update({ status: next }).eq("id", p.id);
      if (next === "held") out.held++;
      else out.paid++;
      if (first && artist?.owner) {
        const to = await emailOf(artist.owner);
        if (to)
          await sendMail(to, "Showly hat deine Gage überwiesen", [
            `Für deinen Auftritt haben wir ${euro(cents)} an dein Auszahlungskonto überwiesen.`,
            p.reserve_cents > 0
              ? `Der Sicherheitseinbehalt von ${euro(p.reserve_cents)} folgt am ${p.reserve_until?.split("-").reverse().join(".")}.`
              : "Je nach Bank ist das Geld in 1 bis 3 Werktagen auf deinem Konto.",
          ]);
      }
    } catch (e) {
      await db.from("payouts").update({ last_error: getStripeErrorMessage(e).slice(0, 300) }).eq("id", p.id);
      out.failed++;
    }
  }
  return out;
}
