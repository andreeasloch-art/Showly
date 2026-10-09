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
    /* Angebot ohne Vorauszahlung: das geht über den Warenkorb */
    if ((r.paid_cents ?? 0) <= 0) return { error: "Leg das Angebot in den Warenkorb und bezahle es an der Kasse." };
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
    if ((r.paid_cents ?? 0) > 0) {
      const { refundSweet } = await import("@/lib/wishcake.server");
      const ref = await refundSweet(r.id, (r.paid_cents ?? 0) - (r.refunded_cents ?? 0), "Neuer Preis abgelehnt");
      if ("error" in ref) return ref;
    }
    const db = adminClient();
    await db.from("sweet_requests").update({ status: "cancelled", quote_cents: null }).eq("id", r.id);
    const { notify } = await import("@/lib/notify.server");
    const unpaid = (r.paid_cents ?? 0) <= 0;
    await notify(r.baker_owner, unpaid ? "Kunde hat dein Angebot abgelehnt" : "Kunde hat den neuen Preis abgelehnt", [
      unpaid
        ? `Dein Angebot für den ${r.day.split("-").reverse().join(".")} wurde abgelehnt. Es wurde nichts bezahlt.`
        : `Die Torte für den ${r.day.split("-").reverse().join(".")} entfällt. Der Kunde hat sein Geld zurückbekommen.`,
    ]).catch(() => false);
    return { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Erst anfragen, dann bezahlen: Der Kunde beschreibt seine Wunschtorte, die
 * Konditorei antwortet mit einem Angebot. Das Angebot kommt in den
 * Warenkorb und wird an der Kasse bezahlt (lib/cart.server.ts).
 * ------------------------------------------------------------------------ */

/** Anfrage ohne Zahlung an eine echte Konditorei schicken */
export const sendSweetRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { sweetId: number; dateISO: string; qty: number; city: string; wishes: string }) => {
    if (!Number.isInteger(d.sweetId) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateISO))) throw new Error("Ungültig");
    return {
      sweetId: d.sweetId,
      dateISO: String(d.dateISO),
      qty: Math.max(1, Math.min(2000, Math.round(Number(d.qty)) || 1)),
      city: String(d.city || "").trim().slice(0, 80),
      wishes: String(d.wishes || "").trim().slice(0, 1500),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true; id: number } | { error: string; contact?: string[] }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an, um eine Anfrage zu schicken." };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    if (!data.wishes) return { error: "Beschreib kurz, was du dir wünschst." };
    const db = adminClient();
    const { data: offer } = await db.from("provider_offers").select("id, provider_id").eq("id", data.sweetId).maybeSingle();
    if (!offer) return { error: "Beispielangebote können nicht angefragt werden." };
    const { data: prov } = await db.from("providers").select("id, owner, published, blocked").eq("id", offer.provider_id).maybeSingle();
    if (!prov || !prov.published || prov.blocked) return { error: "Diese Konditorei nimmt gerade keine Anfragen an." };
    if (prov.owner === ctx.user.id) return { error: "Das ist dein eigenes Angebot." };
    /* Kontaktdaten, Adressen und Namen gehören nicht in die Anfrage */
    const { findContact } = await import("@/showly/contactGuard");
    const { namesInSweetThread } = await import("@/lib/wishcake.server");
    const names = await namesInSweetThread(db, { baker_ref: prov.id, baker_owner: prov.owner, customer: ctx.user.id });
    const found = findContact(`${data.wishes}\n${data.city}`, { names });
    if (found.length) return { error: "Bitte keine Kontaktdaten, Adressen oder Namen", contact: found };
    const { checkCakeOrders } = await import("@/lib/cakes.server");
    const err = await checkCakeOrders(db, [{ sweetId: data.sweetId, dateISO: data.dateISO }]);
    if (err) return { error: err };
    const { loadCatalog } = await import("@/lib/catalog.server");
    const { cakePrice } = await import("@/showly/pricing");
    const cat = await loadCatalog(db, { artists: [], sweets: [data.sweetId], items: [] });
    const est = cakePrice(data.sweetId, data.qty, cat.extra) ?? 0;
    const { data: ins, error } = await db
      .from("sweet_requests")
      .insert({
        customer: ctx.user.id,
        baker_ref: prov.id,
        baker_owner: prov.owner,
        sweet_ref: data.sweetId,
        day: data.dateISO,
        qty: data.qty,
        city: data.city || null,
        wishes: data.wishes,
        /* Name erst nach der Zahlung (Übergabe), vorher bleibt der Kunde anonym */
        customer_name: null,
        price_cents: Math.round(est * 100),
        direct: false,
        status: "sent",
        paid_cents: 0,
      })
      .select("id")
      .single();
    if (error || !ins) return { error: "Anfrage konnte nicht gespeichert werden" };
    const { notifyNewSweet } = await import("@/lib/notify.server");
    await notifyNewSweet(prov.owner, data.dateISO, false).catch(() => false);
    return { ok: true, id: ins.id };
  });

/** Angebot für den Warenkorb laden (Link aus der Mail: /checkout?angebot=ID) */
export const offerForCart = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: number }) => {
    if (!Number.isInteger(d.requestId) || d.requestId < 1) throw new Error("Ungültig");
    return { requestId: d.requestId };
  })
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; line: { offerId: number; sweetId: number; bakerId: number; dateISO: string; qty: number; city: string; wishes: string; estimate: number } }
      | { error: string }
    > => {
      const ctx = await me();
      if (!ctx) return { error: "Bitte melde dich an, um das Angebot zu sehen." };
      const { offerPrices } = await import("@/lib/wishcake.server");
      const { data: r } = await adminClient().from("sweet_requests").select("*").eq("id", data.requestId).maybeSingle();
      if (!r) return { error: "Angebot nicht gefunden" };
      const ok = await offerPrices(adminClient(), ctx.user.id, [{ offerId: r.id, sweetId: r.sweet_ref, dateISO: r.day }]);
      if ("error" in ok) return ok;
      return {
        ok: true,
        line: {
          offerId: r.id,
          sweetId: r.sweet_ref,
          bakerId: r.baker_ref,
          dateISO: r.day,
          qty: r.qty,
          city: r.city ?? "",
          wishes: r.wishes ?? "",
          estimate: (r.quote_cents ?? 0) / 100,
        },
      };
    },
  );
