/* Geld bewegen: Erstattungen an Kunden und Auszahlungen an Anbieter.
 *
 * Nur auf dem Server, nur mit dem Dienstschlüssel. Beides läuft über Stripe:
 *  - Erstattung: zurück auf das Zahlungsmittel der Buchung (AGB § 8 Abs. 3).
 *  - Auszahlung: Überweisung (Transfer) auf das Stripe-Connect-Konto der
 *    anbietenden Person, 7 Tage nach dem Termin, schneller gegen Gebühr
 *    (AGB § 21). Der Sicherheitseinbehalt der ersten Buchungen folgt nach
 *    seiner Frist. Fällige Vertragsstrafen werden mit der nächsten
 *    Auszahlung verrechnet, bei einer offenen Reklamation ist sie
 *    eingefroren.
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

/** Kaution einer Shop-Bestellung erstatten (ganz oder abzüglich Schäden,
 *  Reinigung oder Verspätung). Gleicher Stand, gleicher Schlüssel: Stripe
 *  erstattet nie doppelt. */
export async function refundDeposit(
  orderId: number,
  cents: number,
): Promise<{ ok: true; cents: number } | { error: string }> {
  const db = adminClient();
  const { data: o } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) return { error: "Bestellung nicht gefunden" };
  const left = (o.deposit_cents ?? 0) - (o.deposit_refunded_cents ?? 0);
  const amount = Math.min(left, Math.max(0, Math.round(cents)));
  if (amount <= 0) return { ok: true, cents: 0 };
  const env = stripeEnv();
  try {
    const pay = await paymentOf(o.stripe_session_id, env);
    if (!pay) return { error: "Keine Stripe-Zahlung zu dieser Bestellung" };
    await createStripeClient(env).refunds.create(
      { payment_intent: pay.pi, amount, metadata: { shop_order_id: String(o.id), kind: "deposit" } },
      { idempotencyKey: `deposit-${o.id}-${o.deposit_refunded_cents ?? 0}-${amount}` },
    );
  } catch (e) {
    return { error: getStripeErrorMessage(e) };
  }
  await db.from("shop_orders").update({ deposit_refunded_cents: (o.deposit_refunded_cents ?? 0) + amount }).eq("id", o.id);
  const to = await emailOf(o.customer);
  if (to)
    await sendMail(to, "Deine Kaution wurde erstattet", [
      `Wir haben ${euro(amount)} Kaution erstattet.`,
      "Das Geld geht auf das Zahlungsmittel zurück, mit dem du bezahlt hast. Je nach Bank dauert die Gutschrift einige Tage.",
    ]);
  return { ok: true, cents: amount };
}

const today = () => new Date().toISOString().slice(0, 10);

type Db = ReturnType<typeof adminClient>;
interface PayoutSource {
  payable: boolean;
  session: string | null;
  group: string;
  meta: Record<string, string>;
  artistId?: number | null;
}

async function bookingSource(db: Db, bookingId: number): Promise<PayoutSource | null> {
  const { data: b } = await db
    .from("bookings")
    .select("id, status, paid, amount_cents, refunded_cents, stripe_session_id, artist_id, cancelled_by")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;
  /* Keine Auszahlung bei Absage durch den Künstler, Nichterscheinen oder
     voller Erstattung. Bei später Stornierung durch den Kunden wird der
     einbehaltene Anteil ausgezahlt (net_cents ist dann schon gekürzt). */
  const payable =
    b.paid &&
    b.refunded_cents < b.amount_cents &&
    (["confirmed", "completed", "pending"].includes(b.status) || (b.status === "cancelled" && b.cancelled_by === "customer"));
  return { payable, session: b.stripe_session_id, group: `booking_${b.id}`, meta: { booking_id: String(b.id) }, artistId: b.artist_id };
}

/** Teilbestellung einer Konditorei oder eines Deko-/Kostümanbieters */
async function subOrderSource(db: Db, subId: number): Promise<PayoutSource | null> {
  const { data: so } = await db.from("sub_orders").select("id, order_id, status").eq("id", subId).maybeSingle();
  if (!so) return null;
  const { data: order } = await db.from("orders").select("status, stripe_session_id").eq("id", so.order_id).maybeSingle();
  const payable = order?.status === "paid" && !["cancelled", "declined", "refunded", "requested", "pending"].includes(so.status);
  return { payable, session: order?.stripe_session_id ?? null, group: `order_${so.order_id}`, meta: { sub_order_id: String(so.id) } };
}

/** Wunschtorte (lib/wishcake.server.ts): zugesagt und bezahlt. Mit
 *  Nachzahlung gibt es zwei Zahlungen; dann ohne feste Quelle überweisen. */
async function sweetSource(db: Db, id: number): Promise<PayoutSource | null> {
  const { data: r } = await db
    .from("sweet_requests")
    .select("id, status, paid_cents, extra_cents, refunded_cents, stripe_session_id")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const payable = ["confirmed", "booked"].includes(r.status) && (r.paid_cents ?? 0) > (r.refunded_cents ?? 0);
  return {
    payable,
    session: (r.extra_cents ?? 0) > 0 ? null : r.stripe_session_id,
    group: `torte_${r.id}`,
    meta: { sweet_request_id: String(r.id) },
  };
}

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
    if (p.frozen) {
      await db.from("payouts").update({ last_error: "Eingefroren: offene Reklamation" }).eq("id", p.id);
      out.skipped++;
      continue;
    }
    let cents = first ? p.net_cents - p.reserve_cents : p.reserve_cents;

    /* Woher das Geld kommt: Künstler-Buchung, Teilbestellung (Torten, Deko, Verleih) oder Wunschtorte */
    const src = p.booking_id
      ? await bookingSource(db, p.booking_id)
      : p.sub_order_id
        ? await subOrderSource(db, p.sub_order_id)
        : p.sweet_request_id
          ? await sweetSource(db, p.sweet_request_id)
          : null;
    if (!src || !src.payable) {
      await db.from("payouts").update({ status: "cancelled", last_error: "Nicht (mehr) auszahlbar" }).eq("id", p.id);
      out.skipped++;
      continue;
    }
    /* Offene Meldung oder Strafe: erst klären */
    if (p.booking_id) {
      const { data: pen } = await db.from("penalties").select("status").eq("booking_id", p.booking_id).maybeSingle();
      if (pen && pen.status !== "waived") {
        await db.from("payouts").update({ last_error: "Wartet auf Klärung einer Meldung" }).eq("id", p.id);
        out.skipped++;
        continue;
      }
    }

    let ownerId = p.owner ?? null;
    if (!ownerId) {
      const { data: artist } = await db.from("artists").select("owner").eq("id", p.artist_id ?? src.artistId ?? 0).maybeSingle();
      ownerId = artist?.owner ?? null;
    }
    const artist = ownerId ? { owner: ownerId } : null;
    const { data: acc } = artist?.owner
      ? await db.from("payout_accounts").select("stripe_account_id, payouts_enabled").eq("profile_id", artist.owner).maybeSingle()
      : { data: null };
    if (!acc?.stripe_account_id || !acc.payouts_enabled) {
      await db.from("payouts").update({ last_error: "Kein freigeschaltetes Auszahlungskonto" }).eq("id", p.id);
      out.skipped++;
      continue;
    }

    /* Fällige Vertragsstrafen des Künstlers mit dieser Auszahlung verrechnen */
    let offset = first ? (p.offset_cents ?? 0) : 0;
    /* Schon verrechnet (Wiederholung nach Fehler): nicht noch einmal */
    if (offset) cents -= offset;
    else if (first && cents > 0 && p.artist_id) {
      const { data: open } = await db
        .from("penalties")
        .select("id, amount_cents, offset_cents")
        .eq("artist_id", p.artist_id)
        .eq("status", "due")
        .order("created_at")
        .limit(20);
      for (const q of open || []) {
        const left = q.amount_cents - (q.offset_cents ?? 0);
        const take = Math.min(left, cents - offset);
        if (take <= 0) continue;
        offset += take;
        await db.from("penalties").update({ offset_cents: (q.offset_cents ?? 0) + take }).eq("id", q.id);
      }
      if (offset) {
        cents -= offset;
        await db.from("payouts").update({ offset_cents: offset }).eq("id", p.id);
      }
    }

    try {
      if (cents > 0) {
        const pay = await paymentOf(src.session, env).catch(() => null);
        const t = await createStripeClient(env).transfers.create(
          {
            amount: cents,
            currency: "eur",
            destination: acc.stripe_account_id,
            transfer_group: src.group,
            /* Mit der Zahlung als Quelle geht die Überweisung auch, bevor
               das Geld auf dem Showly-Konto verfügbar ist */
            ...(pay?.charge ? { source_transaction: pay.charge } : {}),
            metadata: { ...src.meta, payout_id: String(p.id), part: first ? "gage" : "einbehalt" },
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
          await sendMail(to, p.booking_id ? "Showly hat deine Gage überwiesen" : "Showly hat deine Einnahmen überwiesen", [
            `${p.booking_id ? "Für deinen Auftritt" : "Für deine Bestellung"} haben wir ${euro(cents)} an dein Auszahlungskonto überwiesen.${offset ? ` Verrechnet mit einer Vertragsstrafe: ${euro(offset)}.` : ""}${p.express_fee_cents ? ` Gebühr für schnellere Auszahlung: ${euro(p.express_fee_cents)}.` : ""}`,
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
