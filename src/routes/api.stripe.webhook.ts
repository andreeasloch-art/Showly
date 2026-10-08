/* Stripe-Webhook (/api/stripe/webhook).
 *
 *  - checkout.session.completed / async_payment_succeeded: bezahlten
 *    Warenkorb verbuchen, auch wenn der Browser nach dem Bezahlen zugeht.
 *    Der Warenkorb liegt als Entwurf in checkout_drafts (createCartCheckout).
 *  - charge.dispute.created: Rückbuchung (Chargeback). Auszahlungen an die
 *    Anbieter dieser Zahlung werden angehalten, die Verwaltung bekommt einen
 *    Fall im Support.
 *  - charge.dispute.closed: gewonnen → Auszahlungen laufen weiter; verloren →
 *    bleiben angehalten, die Verwaltung entscheidet.
 *
 * Jede Nachricht wird über die Signatur geprüft. Stripe wiederholt
 * Nachrichten; stripe_events merkt sich, was schon verarbeitet ist, und
 * recordCartCore trägt dieselbe Zahlung ohnehin nur einmal ein. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import Stripe from "stripe";
import type { StripeEnv } from "@/lib/stripe.server";

function secrets(): { env: StripeEnv; secret: string }[] {
  const out: { env: StripeEnv; secret: string }[] = [];
  if (process.env["STRIPE_LIVE_WEBHOOK_SECRET"]) out.push({ env: "live", secret: process.env["STRIPE_LIVE_WEBHOOK_SECRET"] });
  if (process.env["STRIPE_SANDBOX_WEBHOOK_SECRET"])
    out.push({ env: "sandbox", secret: process.env["STRIPE_SANDBOX_WEBHOOK_SECRET"] });
  return out;
}

async function verify(body: string, sig: string): Promise<{ event: Stripe.Event; env: StripeEnv } | null> {
  for (const { env, secret } of secrets()) {
    try {
      const event = await Stripe.webhooks.constructEventAsync(body, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
      return { event, env };
    } catch {
      /* nächstes Geheimnis probieren */
    }
  }
  return null;
}

async function onPaid(session: Stripe.Checkout.Session, env: StripeEnv) {
  if (session.payment_status !== "paid") return;
  const { adminClient } = await import("@/lib/supabase.server");
  const db = adminClient();
  const { data: draft } = await db.from("checkout_drafts").select("*").eq("session_id", session.id).maybeSingle();
  if (!draft) return; // kein Warenkorb (z. B. Spotlight) oder schon verbucht
  const { recordCartCore } = await import("@/lib/cart.server");
  const { cleanSnapshot } = await import("@/showly/cartSnapshot");
  const r = await recordCartCore(draft.customer, {
    snapshot: cleanSnapshot(draft.snapshot as import("@/showly/cartSnapshot").Snapshot),
    sessionId: session.id,
    environment: env,
    ...(draft.hold_key ? { holdKey: draft.hold_key } : {}),
  });
  if ("error" in r) throw new Error(r.error); // Stripe versucht es später noch einmal
  await db.from("checkout_drafts").delete().eq("session_id", session.id);
}

/** Zahlung → Bestellung und Buchungen dieser Zahlung */
async function sessionOf(stripe: Stripe, pi: string | Stripe.PaymentIntent | null): Promise<string | null> {
  const id = typeof pi === "string" ? pi : pi?.id;
  if (!id) return null;
  const list = await stripe.checkout.sessions.list({ payment_intent: id, limit: 1 });
  return list.data[0]?.id ?? null;
}

async function onDispute(dispute: Stripe.Dispute, env: StripeEnv, closed: boolean) {
  const { adminClient } = await import("@/lib/supabase.server");
  const { createStripeClient } = await import("@/lib/stripe.server");
  const db = adminClient();
  const sid = await sessionOf(createStripeClient(env), dispute.payment_intent);
  if (!sid) return;
  const { data: bks } = await db.from("bookings").select("id").like("stripe_session_id", `${sid}:%`);
  const ids = (bks || []).map((b) => b.id);
  const won = closed && dispute.status === "won";
  const state = !closed ? "open" : won ? "won" : "lost";
  await db.from("orders").update({ dispute_status: state }).eq("stripe_session_id", sid);
  if (ids.length) {
    if (!closed) await db.from("payouts").update({ status: "held" }).in("booking_id", ids).eq("status", "scheduled");
    if (won) await db.from("payouts").update({ status: "scheduled" }).in("booking_id", ids).eq("status", "held");
  }
  const euro = (dispute.amount / 100).toFixed(2).replace(".", ",");
  await db.from("support_tickets").insert({
    email: "support@showly.eu",
    name: "Stripe",
    topic: "payment",
    body: closed
      ? `Rückbuchung ${dispute.id} abgeschlossen: ${won ? "gewonnen, Auszahlungen laufen weiter" : "verloren, Auszahlungen bleiben angehalten"}. Zahlung ${sid}, ${euro} €.`
      : `Rückbuchung (Chargeback) ${dispute.id} über ${euro} €, Grund: ${dispute.reason}. Zahlung ${sid}, Buchungen ${ids.join(", ") || "–"}. Auszahlungen sind angehalten. Nachweise im Stripe-Dashboard bis ${
          dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString("de-DE") : "zur Frist"
        } einreichen.`,
  });
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secrets().length) return new Response("Webhook nicht eingerichtet", { status: 503 });
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const body = await request.text();
        const ok = await verify(body, sig);
        if (!ok) return new Response("Invalid signature", { status: 400 });
        const { event, env } = ok;
        try {
          const { adminClient } = await import("@/lib/supabase.server");
          const db = adminClient();
          const { data: seen } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
          if (seen) return Response.json({ received: true, duplicate: true });
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await onPaid(event.data.object, env);
              break;
            case "charge.dispute.created":
              await onDispute(event.data.object, env, false);
              break;
            case "charge.dispute.closed":
              await onDispute(event.data.object, env, true);
              break;
            default:
              break;
          }
          await db.from("stripe_events").insert({ id: event.id, type: event.type });
          return Response.json({ received: true });
        } catch (e) {
          console.error("stripe webhook", event.type, e);
          return new Response("Retry later", { status: 500 });
        }
      },
    },
  },
});
