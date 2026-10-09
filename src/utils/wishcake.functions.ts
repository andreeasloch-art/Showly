/* Kunde und neuer Preis einer Wunschtorte (lib/wishcake.server.ts):
 * bestätigen und die Differenz nachzahlen, oder ablehnen und alles zurück. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import type { StripeEnv } from "@/lib/stripe.server";

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

async function openQuote(requestId: number, uid: string) {
  const { data: r } = await adminClient().from("sweet_requests").select("*").eq("id", requestId).maybeSingle();
  if (!r || r.customer !== uid) return null;
  if (r.status !== "quoted" || !r.quote_cents) return null;
  return r;
}

/** Zahlungsmaske für die Differenz zum neuen Preis */
export const quoteCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: number; returnUrl: string; environment: StripeEnv }) => {
    if (!Number.isInteger(d.requestId) || !/^https?:\/\//.test(String(d.returnUrl))) throw new Error("Ungültig");
    return { requestId: d.requestId, returnUrl: String(d.returnUrl), environment: d.environment === "live" ? ("live" as const) : ("sandbox" as const) };
  })
  .handler(async ({ data }): Promise<{ clientSecret: string } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const r = await openQuote(data.requestId, ctx.user.id);
    if (!r) return { error: "Kein offener neuer Preis" };
    const due = r.quote_cents! - ((r.paid_cents ?? 0) - (r.refunded_cents ?? 0));
    if (due < 50) return { error: "Betrag zu klein" };
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const s = await createStripeClient(data.environment).checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        submit_type: "pay",
        return_url: data.returnUrl,
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: `Nachzahlung Torte · ${r.day.split("-").reverse().join(".")}` },
              unit_amount: due,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { description: "Showly Nachzahlung Torte" },
        metadata: { kind: "torte-nachzahlung", sweet_request_id: String(r.id) },
        locale: "de",
      });
      return { clientSecret: s.client_secret ?? "" };
    } catch (e) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Nach der Zahlung (Rückkehr aus Stripe); der Webhook macht dasselbe */
export const quoteSettle = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_[A-Za-z0-9_]+$/.test(String(d.sessionId))) throw new Error("Ungültig");
    return { sessionId: String(d.sessionId), environment: d.environment === "live" ? ("live" as const) : ("sandbox" as const) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const { settleQuotePayment } = await import("@/lib/wishcake.server");
    return settleQuotePayment(data.sessionId, data.environment).catch(() => ({ error: "Zahlung konnte nicht geprüft werden" }));
  });

/** Neuen Preis ablehnen: Bestellung entfällt, alles zurück */
export const quoteDecline = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: number }) => {
    if (!Number.isInteger(d.requestId)) throw new Error("Ungültig");
    return { requestId: d.requestId };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const r = await openQuote(data.requestId, ctx.user.id);
    if (!r) return { error: "Kein offener neuer Preis" };
    const { refundSweet } = await import("@/lib/wishcake.server");
    const ref = await refundSweet(r.id, (r.paid_cents ?? 0) - (r.refunded_cents ?? 0), "Neuer Preis abgelehnt");
    if ("error" in ref) return ref;
    const db = adminClient();
    await db.from("sweet_requests").update({ status: "cancelled", quote_cents: null }).eq("id", r.id);
    const { notify } = await import("@/lib/notify.server");
    await notify(r.baker_owner, "Kunde hat den neuen Preis abgelehnt", [
      `Die Torte für den ${r.day.split("-").reverse().join(".")} entfällt. Der Kunde hat sein Geld zurückbekommen.`,
    ]).catch(() => false);
    return { ok: true };
  });
