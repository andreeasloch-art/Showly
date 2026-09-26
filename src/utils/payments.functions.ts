import { createServerFn } from "@tanstack/react-start";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

export interface CheckoutLineInput {
  name: string;
  amountInCents: number;
  quantity?: number;
  /** Katalog-Preis-ID (z. B. "shop_1_rent"); wenn gesetzt, wird der Katalogpreis genutzt. */
  priceId?: string;
}

/** Checkout für Buchungen (dynamisch, pro Stunde) und Shop-Artikel (Katalogpreise). */
export const createShowlyCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      lines: CheckoutLineInput[];
      description: string;
      customerEmail?: string;
      returnUrl: string;
      environment: StripeEnv;
      locale?: "de" | "en" | "es";
    }) => {
      if (!Array.isArray(data.lines) || data.lines.length === 0) {
        throw new Error("No line items");
      }
      for (const l of data.lines) {
        if (l.priceId && !/^[a-zA-Z0-9_-]+$/.test(l.priceId)) {
          throw new Error("Invalid priceId");
        }
      }
      const total = data.lines.reduce(
        (s, l) => s + l.amountInCents * (l.quantity || 1),
        0,
      );
      if (total < 50) throw new Error("Amount must be at least 50 cents");
      return data;
    },
  )
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      // Katalogpreise auflösen (lookup_key), sonst dynamischer Preis.
      const keys = Array.from(
        new Set(data.lines.map((l) => l.priceId).filter(Boolean) as string[]),
      );
      const resolved = new Map<string, string>();
      if (keys.length) {
        const prices = await stripe.prices.list({ lookup_keys: keys, limit: 100 });
        for (const p of prices.data) if (p.lookup_key) resolved.set(p.lookup_key, p.id);
      }

      const session = await stripe.checkout.sessions.create({
        line_items: data.lines.map((l) => {
          const catalog = l.priceId ? resolved.get(l.priceId) : undefined;
          if (catalog) return { price: catalog, quantity: l.quantity || 1 };
          return {
            price_data: {
              currency: "eur",
              product_data: { name: l.name },
              unit_amount: Math.round(l.amountInCents),
            },
            quantity: l.quantity || 1,
          };
        }),
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: data.description },
        locale: data.locale ?? "auto",
        ...(data.customerEmail && { customer_email: data.customerEmail }),
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Serverseitige Prüfung: Wurde die Checkout-Session wirklich bezahlt? */
export const verifyShowlySession = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    return data;
  })
  .handler(async ({ data }): Promise<{ paid: boolean; error?: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      return { paid: session.payment_status === "paid" };
    } catch (error) {
      return { paid: false, error: getStripeErrorMessage(error) };
    }
  });

/** Warenkorb bezahlen. Der Browser schickt nur Kennungen und Mengen, die
 *  Beträge rechnet der Server selbst aus dem Katalog nach. */
export const createCartCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      shop: { shopId: number; mode: "rent" | "buy"; qty: number }[];
      bookings: {
        artistId: number;
        hours: number;
        pkg?: string;
        dateISO: string;
        slot: string;
      }[];
      /** direkt gebuchte Süßwaren-Pakete; der Preis kommt aus dem Katalog */
      sweets?: { sweetId: number; qty: number; dateISO: string }[];
      customerEmail?: string;
      returnUrl: string;
      environment: StripeEnv;
      locale?: "de" | "en" | "es";
    }) => {
      if (!Array.isArray(data.shop) || !Array.isArray(data.bookings))
        throw new Error("Invalid cart");
      const sweets = data.sweets ?? [];
      if (!Array.isArray(sweets) || sweets.length > 20)
        throw new Error("Invalid sweets");
      for (const x of sweets) {
        if (
          !Number.isInteger(x.sweetId) ||
          !Number.isInteger(x.qty) ||
          x.qty < 1 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(x.dateISO)
        )
          throw new Error("Invalid sweet");
      }
      if (data.shop.length + data.bookings.length + sweets.length === 0)
        throw new Error("Empty cart");
      if (data.shop.length > 50 || data.bookings.length > 10)
        throw new Error("Cart too large");
      for (const l of data.shop) {
        if (!Number.isInteger(l.shopId) || (l.mode !== "rent" && l.mode !== "buy")) throw new Error("Invalid item");
      }
      for (const b of data.bookings) {
        if (!Number.isInteger(b.artistId) || !/^\d{4}-\d{2}-\d{2}$/.test(b.dateISO) || !/^\d{2}:\d{2}$/.test(b.slot))
          throw new Error("Invalid booking");
        if (b.pkg !== undefined && !/^[a-zA-Z0-9_-]{1,40}$/.test(b.pkg)) throw new Error("Invalid package");
      }
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return url");
      return data;
    },
  )
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    const { priceLines } = await import("@/showly/pricing");
    const lang = data.locale ?? "de";
    const name = (v: unknown) =>
      typeof v === "string"
        ? v
        : String((v as Record<string, string> | null)?.[lang] ?? (v as Record<string, string> | null)?.["de"] ?? "");
    const labels =
      lang === "en"
        ? { rent: "rental", buy: "purchase", fee: "Service fee" }
        : lang === "es"
          ? { rent: "alquiler", buy: "compra", fee: "Tarifa de servicio" }
          : { rent: "Miete", buy: "Kauf", fee: "Servicegebühr" };
    /* Echte Künstler und Anbieter-Angebote stehen in der Datenbank */
    let extra: import("@/showly/pricing").Extra | undefined;
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const { loadCatalog } = await import("@/lib/catalog.server");
      extra = (
        await loadCatalog(adminClient(), {
          artists: data.bookings.map((b) => b.artistId),
          sweets: (data.sweets ?? []).map((x) => x.sweetId),
          items: data.shop.map((l) => l.shopId),
        })
      ).extra;
    } catch {
      extra = undefined; // ohne Datenbank nur der mitgelieferte Katalog
    }
    const { lines, unknown } = priceLines(
      data.shop,
      data.bookings,
      name,
      labels,
      data.sweets ?? [],
      extra,
    );
    if (unknown.length) {
      return {
        error:
          "Einige Posten sind noch nicht in der Datenbank und können nicht online bezahlt werden: " +
          unknown.join(", "),
      };
    }
    const total = lines.reduce((s, l) => s + l.amountInCents * l.quantity, 0);
    if (total < 50) return { error: "Amount must be at least 50 cents" };
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        line_items: lines.map((l) => ({
          price_data: {
            currency: "eur",
            product_data: { name: l.name.slice(0, 250) },
            unit_amount: l.amountInCents,
          },
          quantity: l.quantity,
        })),
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: "Showly Bestellung" },
        locale: lang,
        ...(data.customerEmail && { customer_email: data.customerEmail }),
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
