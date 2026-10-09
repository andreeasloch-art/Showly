import { createServerFn } from "@tanstack/react-start";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string; holdKey?: string; holdUntil?: string } | { error: string };

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
/** Warenkorb zur offenen Zahlung merken (nur angemeldet, nur mit Datenbank) */
async function saveDraft(sessionId: string, environment: StripeEnv, snapshot: unknown, holdKey: string | null) {
  try {
    const { adminClient, requireUser } = await import("@/lib/supabase.server");
    const { cleanSnapshot } = await import("@/showly/cartSnapshot");
    const { user } = await requireUser();
    await adminClient()
      .from("checkout_drafts")
      .upsert({
        session_id: sessionId,
        customer: user.id,
        environment,
        snapshot: cleanSnapshot(snapshot as import("@/showly/cartSnapshot").Snapshot),
        hold_key: holdKey,
      });
  } catch {
    /* ohne Anmeldung oder Datenbank: Rückkehrseite verbucht wie bisher */
  }
}

export const createCartCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      shop: import("@/showly/pricing").CartShopLine[];
      bookings: {
        artistId: number;
        hours: number;
        pkg?: string;
        dateISO: string;
        slot: string;
      }[];
      /** direkt gebuchte Süßwaren-Pakete; der Preis kommt aus dem Katalog */
      sweets?: { sweetId: number; qty: number; dateISO: string; offerId?: number }[];
      customerEmail?: string;
      returnUrl: string;
      environment: StripeEnv;
      locale?: "de" | "en" | "es";
      /** kompletter Warenkorb; der Stripe-Webhook verbucht damit die Zahlung,
          auch wenn der Browser nach dem Bezahlen zugeht */
      snapshot?: import("@/showly/cartSnapshot").Snapshot;
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
          !/^\d{4}-\d{2}-\d{2}$/.test(x.dateISO) ||
          (x.offerId !== undefined && !(Number.isInteger(x.offerId) && x.offerId > 0))
        )
          throw new Error("Invalid sweet");
      }
      if (data.shop.length + data.bookings.length + sweets.length === 0)
        throw new Error("Empty cart");
      if (data.shop.length > 50 || data.bookings.length > 10)
        throw new Error("Cart too large");
      for (const l of data.shop) {
        if (!Number.isInteger(l.shopId) || (l.mode !== "rent" && l.mode !== "buy")) throw new Error("Invalid item");
        if ((l.from && !/^\d{4}-\d{2}-\d{2}$/.test(l.from)) || (l.to && !/^\d{4}-\d{2}-\d{2}$/.test(l.to))) throw new Error("Invalid rental dates");
        if (l.size !== undefined && (typeof l.size !== "string" || l.size.length > 20)) throw new Error("Invalid size");
        if (l.ship !== undefined && !["pickup", "delivery", "shipping"].includes(l.ship)) throw new Error("Invalid delivery");
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
        ? { rent: "rental", buy: "purchase" }
        : lang === "es"
          ? { rent: "alquiler", buy: "compra" }
          : { rent: "Miete", buy: "Kauf" };
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
    /* Angebote der Konditorei: Preis aus der Datenbank, nur für den Kunden selbst */
    let offers = new Map<number, { cents: number; qty: number }>();
    if ((data.sweets ?? []).some((x) => x.offerId)) {
      let uid: string | null = null;
      try {
        const { requireUser } = await import("@/lib/supabase.server");
        uid = (await requireUser()).user.id;
      } catch {
        uid = null;
      }
      const { adminClient } = await import("@/lib/supabase.server");
      const { offerPrices } = await import("@/lib/wishcake.server");
      const r = await offerPrices(adminClient(), uid, data.sweets ?? []);
      if ("error" in r) return { error: r.error };
      offers = r.ok;
    }
    const { lines, unknown } = priceLines(
      data.shop,
      data.bookings,
      name,
      labels,
      (data.sweets ?? []).map((x) => {
        const o = x.offerId ? offers.get(x.offerId) : undefined;
        return { sweetId: x.sweetId, qty: o ? o.qty : x.qty, dateISO: x.dateISO, ...(o ? { price: o.cents / 100 } : {}) };
      }),
      extra,
      { allowDemo: false },
    );
    if (unknown.length) {
      return {
        error:
          "Beispielangebote und Posten, die nicht in der Datenbank stehen, können nicht bezahlt werden: " +
          unknown.join(", "),
      };
    }
    const total = lines.reduce((s, l) => s + l.amountInCents * l.quantity, 0);
    if (total < 50) return { error: "Amount must be at least 50 cents" };

    /* Torten: Vorlauf, Tageskapazität und Allergenangaben auf dem Server prüfen */
    if (data.sweets?.length) {
      try {
        const { adminClient } = await import("@/lib/supabase.server");
        const { checkCakeOrders } = await import("@/lib/cakes.server");
        const err = await checkCakeOrders(adminClient(), data.sweets.filter((x) => !x.offerId));
        if (err) return { error: err };
      } catch {
        /* ohne Datenbank (Vorschau) keine echten Anbieter */
      }
    }

    /* Deko-/Kostümanbieter im Urlaubsmodus */
    if (data.shop?.length) {
      try {
        const { adminClient } = await import("@/lib/supabase.server");
        const { checkAwayShop } = await import("@/lib/away.server");
        const err = await checkAwayShop(adminClient(), data.shop);
        if (err) return { error: err };
      } catch {
        /* ohne Datenbank (Vorschau) keine echten Anbieter */
      }
    }

    /* Termine echter Künstler während des Bezahlens reservieren. Die
       Datenbank sperrt dabei die Zeile des Künstlers und lässt keine
       Überschneidung zu (inkl. einer Stunde Fahrtzeit, auch mit Terminen aus
       seinem eigenen Kalender). Ist ein Termin belegt, gibt es keine
       Zahlung. Die Reservierung läuft nach HOLD_MINUTES ab oder wird nach
       der Zahlung zur Buchung (recordCart). */
    let holdKey: string | null = null;
    let holdUntil: string | null = null;
    const real = data.bookings.filter((b) => b.artistId >= 100000);
    if (real.length) {
      try {
        const { claimSlots, claimMessage, newHoldKey, HOLD_MINUTES } = await import("@/lib/slots.server");
        const { syncStaleFeeds } = await import("@/lib/calsync.server");
        /* Eigene Kalender der Künstler kurz vorher abgleichen */
        await syncStaleFeeds(real.map((b) => b.artistId)).catch(() => 0);
        holdKey = newHoldKey();
        const r = await claimSlots(
          real.map((b) => ({ artist_id: b.artistId, day: b.dateISO, slot: b.slot, hours: Math.max(1, Math.round(b.hours) || 1) })),
          "hold",
          holdKey,
        );
        if (!r.ok) {
          const b = real[r.index] ?? real[0]!;
          return { error: claimMessage(r.reason, lang, { day: b.dateISO, slot: b.slot }) };
        }
        holdUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
      } catch {
        holdKey = null; // ohne Datenbank (Vorschau) gibt es keine echten Termine
      }
    }
    /* Mietartikel für den Zeitraum reservieren (Stückzahl, Reinigungspuffer) */
    try {
      const { rentalItems, claimRentals } = await import("@/lib/rentals.server");
      const { findItem } = await import("@/showly/pricing");
      const rent = rentalItems(data.shop, (id) => findItem(id, extra));
      if (rent.length) {
        const { newHoldKey, HOLD_MINUTES } = await import("@/lib/slots.server");
        holdKey ??= newHoldKey();
        holdUntil ??= new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
        const r = await claimRentals(rent, "hold", holdKey);
        if (!r.ok) {
          const { releaseHold } = await import("@/lib/slots.server");
          await releaseHold(holdKey).catch(() => undefined);
          return {
            error:
              lang === "en"
                ? "A rental item is already taken for the chosen period. Please choose another period."
                : lang === "es"
                  ? "Un artículo de alquiler ya está reservado en ese periodo. Elige otro periodo."
                  : "Ein Mietartikel ist im gewählten Zeitraum schon vergeben. Bitte einen anderen Zeitraum wählen.",
          };
        }
      }
    } catch {
      /* ohne Datenbank (Vorschau) keine echten Mietartikel */
    }
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
        /* Bestell-Button eindeutig („Bezahlen“, § 312j Abs. 3 BGB) */
        submit_type: "pay",
        /* Rabattcodes und Geschenkgutscheine (in der Verwaltung angelegt) */
        allow_promotion_codes: true,
        payment_intent_data: { description: "Showly Bestellung" },
        locale: lang,
        ...(data.customerEmail && { customer_email: data.customerEmail }),
        /* Reservierung an die Zahlung hängen; Stripe lässt eine offene
           Kasse frühestens nach 30 Minuten ablaufen */
        ...(holdKey
          ? { metadata: { hold_key: holdKey }, expires_at: Math.floor(Date.now() / 1000) + 30 * 60 }
          : {}),
      });
      if (data.snapshot) await saveDraft(session.id, data.environment, data.snapshot, holdKey);
      return { clientSecret: session.client_secret ?? "", ...(holdKey && holdUntil ? { holdKey, holdUntil } : {}) };
    } catch (error) {
      if (holdKey) {
        const { releaseHold } = await import("@/lib/slots.server");
        await releaseHold(holdKey).catch(() => undefined);
      }
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Kasse abgebrochen: reservierte Termine sofort wieder freigeben */
export const releaseCartHold = createServerFn({ method: "POST" })
  .inputValidator((d: { holdKey: string }) => {
    if (!/^[0-9a-f]{32}$/.test(String(d?.holdKey))) throw new Error("Ungültig");
    return { holdKey: d.holdKey };
  })
  .handler(async ({ data }) => {
    try {
      const { releaseHold } = await import("@/lib/slots.server");
      await releaseHold(data.holdKey);
    } catch {
      /* ohne Datenbank nichts zu tun */
    }
    return { ok: true as const };
  });
