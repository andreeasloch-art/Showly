/* Bezahlten Warenkorb in die Datenbank schreiben: Bestellung, Teilbestellungen
 * je Anbieter, Buchungen, Torten, Shop. Aufgerufen von recordCart (Rückkehr
 * aus der Kasse im Browser) und vom Stripe-Webhook (api.stripe.webhook.ts),
 * falls der Browser vorher zugeht. Dieselbe Zahlung wird nur einmal
 * eingetragen, egal wer zuerst kommt. */
import { adminClient } from "@/lib/supabase.server";
import type { BookingRow } from "@/lib/database.types";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import type { Snapshot } from "@/showly/cartSnapshot";
import { policySnapshot } from "@/showly/policies";
import { SWEETS, leadOf } from "@/showly/sweets";

/* ---------------------------------------------------------------------------
 * Preise eines Künstlers: Katalog (Beispielprofile) oder Datenbank
 * ------------------------------------------------------------------------ */
const REAL_ARTIST_FROM = 100000;

async function artistTerms(
  admin: ReturnType<typeof adminClient>,
  artistId: number,
  hours: number,
  pkg?: string,
  rules: import("@/showly/feeRules").FeeRule[] = [],
  day?: string,
) {
  const { bookingPrice, findArtist, FEE_RATE, MAX_HOURS } = await import("@/showly/pricing");
  const { isInstant, standingOf } = await import("@/showly/booking");
  const { tierOf } = await import("@/showly/policies");
  if (artistId < REAL_ARTIST_FROM) {
    const a = findArtist(artistId);
    if (!a || a.demo) return null; // Beispielprofile sind nicht buchbar
    const p = bookingPrice(a, hours, pkg, day);
    return {
      artist_id: null as number | null,
      catalog_artist: artistId,
      hours: p.hours,
      amount_cents: Math.round(p.total * 100),
      fee_cents: Math.round(p.fee * 100),
      payout_cents: Math.round(p.payout * 100),
      instant: isInstant(a),
      tier: tierOf((a as { cancelTier?: string }).cancelTier),
    };
  }
  const { data: a } = await admin
    .from("artists")
    .select("id, cat, price_cents, instant_book, published, packages, cancel_tier, surcharges, created_at")
    .eq("id", artistId)
    .maybeSingle();
  if (!a || !a.published) return null;
  const { data: pens } = await admin
    .from("penalties")
    .select("reason, status, due_at, created_at")
    .eq("artist_id", artistId);
  const standing = standingOf(
    artistId,
    (pens || []).map((p) => ({
      artistId,
      reason: p.reason,
      status: p.status,
      dateISO: p.created_at,
      ...(p.due_at ? { dueAt: p.due_at } : {}),
    })),
  );
  if (!standing.bookable) return null;
  const h = Math.min(MAX_HOURS, Math.max(1, Math.round(hours) || 1));
  /* Planer-Paket (Basic/Premium/Luxus): Festpreis aus der Datenbank */
  const { cleanPackages } = await import("@/showly/plannerPackages");
  const pk = pkg ? cleanPackages(a.packages).find((p) => p.id === pkg) : undefined;
  if (pkg && !pk) return null;
  /* Wochenendzuschlag und Saisonpreis wie in der App (showly/surcharges.ts) */
  const { cleanSurcharges, withSurcharge } = await import("@/showly/surcharges");
  const sc = cleanSurcharges(a.surcharges);
  const base = pk
    ? Math.round(withSurcharge(pk.price, sc, day) * 100)
    : Math.round(withSurcharge(a.price_cents / 100, sc, day) * 100) * h;
  const { pickRate, inStartPhase } = await import("@/showly/feeRules");
  /* Startphase: die ersten 3 Monate nach der Anmeldung ohne Provision */
  const fee = inStartPhase((a as { created_at?: string }).created_at)
    ? 0
    : Math.round(base * pickRate(rules, { kind: "artist", providerId: a.id, category: a.cat }, FEE_RATE));
  return {
    artist_id: a.id as number | null,
    catalog_artist: null as number | null,
    hours: h,
    /* Kunde zahlt den Endpreis; Showly behält die Provision ein */
    amount_cents: base,
    fee_cents: fee,
    payout_cents: base - fee,
    instant: a.instant_book && standing.instantAllowed,
    tier: tierOf(a.cancel_tier),
  };
}

/* ---------------------------------------------------------------------------
 * Warenkorb in die Datenbank schreiben
 * ------------------------------------------------------------------------ */
export type RecordResult =
  | { skipped: true }
  | { ok: true; bookingIds: number[]; sweetIds: number[]; orderId: number | null }
  | { error: string };

export async function recordCartCore(
  uid: string,
  data: { snapshot: Snapshot; sessionId?: string | undefined; environment?: StripeEnv | undefined; holdKey?: string | undefined },
): Promise<RecordResult> {
  const admin = adminClient();
  const snap = data.snapshot;
  const { loadCatalog } = await import("@/lib/catalog.server");
  const cat = await loadCatalog(admin, {
    artists: snap.bookings.map((b) => b.artistId),
    sweets: snap.requests.map((r) => r.sweetId),
    items: snap.shop.map((l) => l.shopId),
    venues: (snap.venues ?? []).map((v) => v.venueId),
  });
  const { newCheckinCode } = await import("@/showly/booking");
  const { cakePrice, findItem, shopLineParts, sweetPrice } = await import("@/showly/pricing");
  const { plannedPayout } = await import("@/showly/cloudRules");
  /* Angebote der Konditorei (Anfrage vor dem Bezahlen): Preis aus der Datenbank */
  const { offerPrices, bookPaidOffer } = await import("@/lib/wishcake.server");
  const off = await offerPrices(admin, uid, snap.requests);
  if ("error" in off) return off;
  const offers = off.ok;
  const offerOf = (r: { offerId?: number | undefined }) => (r.offerId ? offers.get(r.offerId) : undefined);

  /* Bezahlt? Nur Stripe selbst gibt darüber Auskunft. Dieselbe Zahlung
     wird nur einmal eingetragen. */
  let paid = false;
  let discount = 0;
  let holdKey: string | null = data.holdKey ?? null;
  if (data.sessionId) {
    const { data: seen } = await admin
      .from("bookings")
      .select("id")
      .like("stripe_session_id", `${data.sessionId}:%`)
      .limit(1);
    /* Bestellung (orders) ist je Zahlung eindeutig; alte Shop-Zeilen ohne Bestellung zur Sicherheit auch */
    const { data: seenOrder } = await admin.from("orders").select("id").eq("stripe_session_id", data.sessionId).limit(1);
    const { data: seenShop } = await admin
      .from("shop_orders")
      .select("id")
      .like("stripe_session_id", `${data.sessionId}%`)
      .limit(1);
    if (seen?.length || seenOrder?.length || seenShop?.length) return { ok: true, bookingIds: [], sweetIds: [], orderId: null };
    let amount = -1;
    try {
      const stripe = createStripeClient(data.environment ?? "sandbox");
      const s = await stripe.checkout.sessions.retrieve(data.sessionId);
      paid = s.payment_status === "paid";
      /* Rabattcodes (Stripe-Promotion-Codes) trägt Showly: verglichen wird
         der Betrag vor Rabatt, die Anbieter bekommen den vollen Anteil */
      amount = s.amount_subtotal ?? s.amount_total ?? -1;
      discount = Math.max(0, (s.amount_subtotal ?? 0) - (s.amount_total ?? 0));
      /* Reservierung aus der Kasse (createCartCheckout) */
      const hk = s.metadata?.["hold_key"];
      if (typeof hk === "string" && /^[0-9a-f]{32}$/.test(hk)) holdKey = hk;
    } catch {
      return { error: "Zahlung konnte nicht geprüft werden" };
    }
    if (!paid) return { error: "Zahlung nicht bestätigt" };
    /* Passt der bezahlte Betrag genau zu diesem Warenkorb? Sonst ließe
       sich eine kleine Zahlung für einen großen Warenkorb ausgeben. */
    const { priceLines } = await import("@/showly/pricing");
    const { lines, unknown } = priceLines(
      snap.shop,
      snap.bookings,
      () => "",
      { rent: "", buy: "" },
      /* Alle Torten werden sofort bezahlt: Pakete zum Festpreis, Wunschtorten zum Richtpreis */
      snap.requests.map((r) => {
        const o = offerOf(r);
        return { sweetId: r.sweetId, qty: o ? o.qty : r.qty, dateISO: r.dateISO, ...(o ? { price: o.cents / 100 } : {}) };
      }),
      cat.extra,
      { allowDemo: false, venues: snap.venues ?? [] },
    );
    const expected = lines.reduce((s, l) => s + l.amountInCents * l.quantity, 0);
    if (unknown.length || expected !== amount) return { error: "Betrag passt nicht zum Warenkorb" };
  }

  /* Torten-Anfragen ohne Zahlung: Tag und Pflichtangaben prüfen (mit
     Zahlung hat das schon die Kasse getan, createCartCheckout) */
  if (!data.sessionId && snap.requests.length) {
    const { checkCakeOrders } = await import("@/lib/cakes.server");
    const err = await checkCakeOrders(admin, snap.requests.filter((r) => !offerOf(r)));
    if (err) return { error: err };
  }

  /* ------------------------------------------------------------------
     Ein Warenkorb für ein Event, aber verschiedene Anbieter: Bestellung
     (orders) mit einer Teilbestellung je Anbieter (sub_orders). Jede
     Buchung, Torte und Shop-Position hängt an ihrer Teilbestellung.
     ------------------------------------------------------------------ */
  const { splitIntoSubOrders } = await import("@/showly/subOrders");
  const { FEE_RATE } = await import("@/showly/pricing");

  const { loadFeeRules } = await import("@/lib/fees.server");
  const { pickRate } = await import("@/showly/feeRules");
  const feeRules = await loadFeeRules(admin);
  const bk = (await Promise.all(snap.bookings.map((b) => artistTerms(admin, b.artistId, b.hours, b.pkg, feeRules, b.dateISO))))
    .map((t, i) => ({ b: snap.bookings[i]!, t, i }))
    .filter((x): x is { b: Snapshot["bookings"][number]; t: NonNullable<typeof x.t>; i: number } => !!x.t);
  const artistIds = [...new Set(bk.map((x) => x.t.artist_id).filter((x): x is number => !!x))];
  const artistOwner = new Map<number, string>();
  if (artistIds.length) {
    const { data: rows } = await admin.from("artists").select("id, owner").in("id", artistIds);
    for (const r of rows || []) artistOwner.set(r.id, r.owner);
  }

  /* Besitzer echter Torten-Anbieter, damit sie die Anfrage sehen */
  const bakerRefs = [...new Set(snap.requests.map((r) => r.bakerId).filter((x) => x >= 100000))];
  const bakerOwner = new Map<number, string>();
  if (bakerRefs.length) {
    const { data: provs } = await admin.from("providers").select("id, owner").in("id", bakerRefs).eq("kind", "baker");
    for (const p of provs || []) bakerOwner.set(p.id, p.owner);
  }
  const sw = snap.requests.map((r) => {
    /* Angebot: der vereinbarte Preis gilt als Festpreis */
    const o = offerOf(r);
    if (o) return { r: { ...r, qty: o.qty }, fixed: o.cents / 100, charged: paid ? o.cents / 100 : null, direct: paid, offer: o.row };
    const fixed = r.direct ? sweetPrice(r.sweetId, r.qty, cat.extra) : null;
    /* Was für diese Torte bezahlt wurde (Festpreis bzw. Richtpreis) */
    const charged = paid ? cakePrice(r.sweetId, r.qty, cat.extra) : null;
    /* Direkt buchen geht nur mit Katalogpreis und nur bezahlt */
    return { r, fixed, charged, direct: fixed !== null && paid, offer: null };
  });

  const sh = snap.shop
    .map((l) => {
      const it = findItem(l.shopId, cat.extra);
      if (!it || it.own) return null;
      const parts = shopLineParts(it, l);
      return {
        ...l,
        /* Ware bzw. Miete samt Übergabe; die Kaution steht extra */
        price_cents: Math.round((parts.goods + parts.ship + parts.care) * 100),
        deposit_cents: Math.round(parts.deposit * 100),
        providerId: cat.offerProvider.get(l.shopId) ?? null,
        owner: cat.offerOwner.get(l.shopId) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  /* Startphase: Torten-, Deko- und Kostümanbieter zahlen in den ersten drei
     Monaten keine Provision (AGB § 21 Abs. 1), wie die Künstler */
  const { inStartPhase } = await import("@/showly/feeRules");
  const provIds = [...new Set([...bakerRefs, ...sh.map((l) => l.providerId).filter((x): x is number => typeof x === "number")])];
  const provSince = new Map<number, string>();
  if (provIds.length) {
    const { data: rows } = await admin.from("providers").select("id, created_at").in("id", provIds);
    for (const r of rows || []) provSince.set(r.id, r.created_at);
  }

  /* Locations: Preis wie im Browser (locations.ts), nur echte aus der Datenbank */
  const { venueLinePrice } = await import("@/showly/pricing");
  const vn = (snap.venues ?? [])
    .map((l, i) => ({ l, i, p: venueLinePrice(l, cat.extra), who: cat.venueOwner.get(l.venueId) }))
    .filter((x): x is typeof x & { p: NonNullable<typeof x.p>; who: { owner: string; since: string } } => !!x.p && x.p.quote.ok && !!x.who);
  for (const x of vn) provSince.set(x.l.venueId, x.who.since);

  const drafts = splitIntoSubOrders({
    paid,
    feeRate: FEE_RATE,
    rateFor: (kind, providerId) =>
      providerId != null && inStartPhase(provSince.get(providerId))
        ? 0
        : pickRate(feeRules, { kind, providerId }, FEE_RATE),
    bookings: bk.map((x) => ({
      artistId: x.t.artist_id ?? x.b.artistId,
      owner: x.t.artist_id ? (artistOwner.get(x.t.artist_id) ?? null) : null,
      amountCents: x.t.amount_cents,
      feeCents: x.t.fee_cents,
      payoutCents: x.t.payout_cents,
      request: !x.t.instant,
    })),
    sweets: sw.map((x) => ({
      bakerId: x.r.bakerId,
      owner: bakerOwner.get(x.r.bakerId) ?? null,
      priceCents: Math.round((x.fixed ?? 0) * 100),
      direct: x.direct,
    })),
    shop: sh.map((l) => ({ providerId: l.providerId, owner: l.owner, amountCents: l.price_cents })),
    venues: vn.map((x) => ({
      venueId: x.l.venueId,
      owner: x.who.owner,
      amountCents: Math.round(x.p.quote.total * 100),
      request: !x.p.venue.instant,
    })),
  });

  /* Bestellung und Teilbestellungen anlegen */
  let orderId: number | null = null;
  const subId = new Map<string, number>();
  const partSub = new Map<string, number>();
  if (drafts.length) {
    const days = [...bk.map((x) => x.b.dateISO), ...sw.map((x) => x.r.dateISO), ...vn.map((x) => x.l.dateISO)].sort();
    const { data: order } = await admin
      .from("orders")
      .insert({
        customer: uid,
        stripe_session_id: data.sessionId ?? null,
        event_day: days[0] ?? null,
        total_cents: drafts.reduce((n, d) => n + d.amountCents, 0) + vn.reduce((n, x) => n + Math.round(x.p.quote.deposit * 100), 0),
        discount_cents: discount,
        /* Rechnungsempfänger (Belege); Firma und USt-IdNr. nur bei Firmenkunden */
        kunde_name: snap.contact.name || null,
        kunde_firma: snap.contact.company || null,
        kunde_ust_id: snap.contact.vatId || null,
        kunde_anschrift: snap.contact.address || null,
        status: paid ? "paid" : "pending",
      })
      .select("id")
      .single();
    orderId = order?.id ?? null;
    /* Gleichzeitig zweimal dieselbe Zahlung (z. B. Seite neu geladen):
       die Bestellnummer je Zahlung ist eindeutig, der zweite Aufruf endet hier */
    if (!orderId && data.sessionId) return { ok: true, bookingIds: [], sweetIds: [], orderId: null };
    if (orderId) {
      const { data: subs } = await admin
        .from("sub_orders")
        .insert(
          drafts.map((d) => ({
            order_id: orderId!,
            provider_kind: d.kind,
            provider_id: d.providerId,
            provider_owner: d.owner,
            amount_cents: d.amountCents,
            fee_cents: d.feeCents,
            payout_cents: d.payoutCents,
            status: d.status,
          })),
        )
        .select("id, provider_kind, provider_id");
      for (const r of subs || []) subId.set(`${r.provider_kind}:${r.provider_id ?? "showly"}`, r.id);
      for (const d of drafts) {
        const id = subId.get(d.key);
        if (id) for (const p of d.parts) partSub.set(`${p.type}:${p.index}`, id);
      }
      /* Auszahlung an Konditoreien und Deko-/Kostümanbieter planen, genau
         wie bei Künstlern: 7 Tage nach Liefertag, Mietende bzw. Bestelltag,
         Sicherheitseinbehalt bei den ersten 5 Aufträgen (policies.ts,
         cloudRules.ts) */
      const { orderPayoutDay } = await import("@/showly/policies");
      const { reserveFor, provisionFelder } = await import("@/showly/cloudRules");
      const earlier = new Map<string, number>();
      const orderDay = new Date().toISOString().slice(0, 10);
      const due = drafts.filter(
        (d) => (d.kind === "baker" || d.kind === "deco" || d.kind === "location") && d.owner && d.payoutCents > 0 && (d.status === "paid" || d.status === "confirmed"),
      );
      for (const o of new Set(due.map((d) => d.owner!))) {
        const { count } = await admin.from("payouts").select("id", { count: "exact", head: true }).eq("owner", o);
        earlier.set(o, count || 0);
      }
      const plans = due
        .map((d) => {
          const cakeDays = d.parts.filter((p) => p.type === "sweet").map((p) => sw[p.index]?.r.dateISO ?? "");
          const lines = d.parts.filter((p) => p.type === "shop").map((p) => sh[p.index]);
          const rentTo = lines.filter((l) => l?.mode === "rent").map((l) => l?.to ?? "");
          /* Location: wie Künstler 7 Tage nach dem Event */
          const venueDays = d.parts.filter((p) => p.type === "venue").map((p) => vn[p.index]?.l.dateISO ?? "");
          const when = orderPayoutDay({ cakeDays: [...cakeDays, ...venueDays], rentTo, orderDay });
          const n = earlier.get(d.owner!) ?? 0;
          earlier.set(d.owner!, n + 1);
          return {
            sub_order_id: subId.get(d.key)!,
            owner: d.owner,
            kind: d.kind as "baker" | "deco" | "location",
            booking_id: null,
            artist_id: null,
            gross_cents: d.amountCents,
            fee_cents: d.feeCents,
            ...provisionFelder(d.amountCents, d.feeCents),
            event_day: when.event_day,
            payout_on: when.payout_on,
            ...reserveFor(when.event_day, d.payoutCents, n),
          };
        })
        .filter((x) => x.sub_order_id);
      if (plans.length) await admin.from("payouts").upsert(plans, { onConflict: "sub_order_id" });
    }
  }

  /* ---- Künstler ---- */
  const bookingIds: number[] = [];
  const { claimSlots } = await import("@/lib/slots.server");
  for (const [j, { b, t: terms, i }] of bk.entries()) {
    const status = !terms.instant ? "requested" : paid ? "confirmed" : "pending";
    const row = {
      customer: uid,
      artist_id: terms.artist_id,
      catalog_artist: terms.catalog_artist,
      day: b.dateISO,
      slot: b.slot,
      hours: terms.hours,
      amount_cents: terms.amount_cents,
      fee_cents: terms.fee_cents,
      payout_cents: terms.payout_cents,
      status,
      paid,
      figure: b.figure ?? null,
      pkg: b.pkg ?? null,
      occasion: b.occasion ?? null,
      notes: b.notes ?? null,
      address: b.address ?? snap.contact.address ?? null,
      guests: b.guests && /^\d+$/.test(b.guests) ? Number(b.guests) : null,
      customer_name: snap.contact.name || null,
      requested_at: status === "requested" ? new Date().toISOString() : null,
      stripe_session_id: data.sessionId ? `${data.sessionId}:${i}` : null,
      sub_order_id: partSub.get(`booking:${j}`) ?? null,
      /* Stornostufe zum Zeitpunkt der Buchung; spätere Änderungen gelten nicht */
      policy: policySnapshot("artist", terms.tier),
    } as Partial<BookingRow>;
    const { data: ins, error } = await admin.from("bookings").insert(row).select("id").single();
    if (error || !ins) continue;

    /* Termin fest belegen: die Reservierung aus der Kasse wird zur Buchung.
       Ist sie abgelaufen und hat inzwischen jemand anderes gebucht, lehnt
       die Datenbank ab (Zeilensperre + Ausschlussregel). Dann wird die
       Buchung sofort abgelehnt und das Geld zurückgezahlt, statt den
       Künstler doppelt zu buchen. */
    if (terms.artist_id) {
      const claim = await claimSlots(
        [{ artist_id: terms.artist_id, day: b.dateISO, slot: b.slot, hours: terms.hours, booking_id: ins.id }],
        "booking",
        holdKey,
      );
      if (!claim.ok) {
        await admin.from("bookings").update({ status: "declined" }).eq("id", ins.id);
        if (paid) {
          const { refundBooking } = await import("@/lib/money.server");
          await refundBooking(ins.id, {
            reason: "der Termin war beim Abschluss der Zahlung schon vergeben",
            ...(data.environment ? { env: data.environment } : {}),
          }).catch(() => null);
        }
        continue;
      }
    }
    bookingIds.push(ins.id);
    {
      const { notifyNewBooking } = await import("@/lib/notify.server");
      await notifyNewBooking({ id: ins.id, artist_id: terms.artist_id, day: b.dateISO, slot: b.slot, status }).catch(() => false);
    }
    await admin.from("booking_codes").insert({ booking_id: ins.id, code: newCheckinCode() });
    if (status === "confirmed" && terms.artist_id) {
      const { count } = await admin
        .from("payouts")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", terms.artist_id);
      await admin.from("payouts").insert({
        artist_id: terms.artist_id,
        booking_id: ins.id,
        owner: artistOwner.get(terms.artist_id) ?? null,
        ...plannedPayout({ day: b.dateISO, amount_cents: terms.amount_cents, payout_cents: terms.payout_cents }, count || 0),
      });
    }
    /* Startzeit im Kalender des Künstlers anzeigen */
    if (terms.artist_id)
      await admin.from("availability").upsert({ artist_id: terms.artist_id, day: b.dateISO, slot: b.slot, blocked: true });
  }
  /* Nicht mehr gebrauchte Reservierungen (z. B. Anfrage-Künstler) freigeben */

  /* ---- Locations: Termin unter Sperre belegen, sonst sofort erstatten ---- */
  const venueIds: number[] = [];
  for (const [j, x] of vn.entries()) {
    const q = x.p.quote;
    const v = x.p.venue;
    const status = !v.instant ? "requested" : paid ? "confirmed" : "requested";
    const { data: res } = await admin.rpc("venue_reservieren", {
      p: {
        venue_id: x.l.venueId,
        day: x.l.dateISO,
        start: x.l.start,
        hours: q.hours,
        parallel: v.parallel,
        buffer_min: v.bufferMin,
        booking: {
          customer: uid,
          owner: x.who.owner,
          guests: q.guests,
          pkg: x.l.pkg ?? "",
          extras: x.l.extras ?? [],
          occasion: x.l.occasion ?? "",
          notes: x.l.notes ?? "",
          customer_name: snap.contact.name || "",
          amount_cents: Math.round(q.total * 100),
          fee_cents: Math.round(q.fee * 100),
          payout_cents: Math.round(q.payout * 100),
          deposit_cents: Math.round(q.deposit * 100),
          status,
          paid,
          stripe_session_id: data.sessionId ? `${data.sessionId}:v${j}` : "",
          sub_order_id: partSub.get(`venue:${j}`) ?? "",
          policy: policySnapshot("artist", v.cancelTier),
        },
      },
    });
    const r = res as { id?: number; error?: string } | null;
    if (!r?.id) {
      /* In der Zwischenzeit voll geworden: nicht doppelt vermieten, Geld zurück */
      if (paid && data.sessionId) {
        const { stripeEnv } = await import("@/lib/money.server");
        try {
          const stripe = createStripeClient(data.environment ?? stripeEnv());
          const s = await stripe.checkout.sessions.retrieve(data.sessionId);
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
          if (pi)
            await stripe.refunds.create(
              { payment_intent: pi, amount: Math.round((q.total + q.deposit) * 100), metadata: { venue_full: String(x.l.venueId) } },
              { idempotencyKey: `venue-full-${data.sessionId}-${j}` },
            );
        } catch (e) {
          console.error("venue refund", e);
        }
      }
      const sid = partSub.get(`venue:${j}`);
      if (sid) await admin.from("sub_orders").update({ status: "refunded" }).eq("id", sid);
      continue;
    }
    venueIds.push(r.id);
    const { notify } = await import("@/lib/notify.server");
    await notify(x.who.owner, status === "requested" ? "Neue Buchungsanfrage für deine Location" : "Neue Buchung deiner Location", [
      `${v.name}: ${x.l.dateISO.split("-").reverse().join(".")} ab ${x.l.start} Uhr, ${q.guests} Gäste${q.pkg ? `, Paket ${q.pkg.name}` : ""}.`,
      status === "requested"
        ? "Bitte sag innerhalb von 48 Stunden in der App zu oder ab. Ohne Antwort verfällt die Anfrage und der Kunde bekommt sein Geld zurück."
        : "Die Buchung ist bezahlt und verbindlich. Alle Angaben stehen in der App.",
    ]).catch(() => false);
  }

  /* ---- Torten & Süßes ---- */
  const sweetIds: number[] = [];
  for (const [j, { r, fixed, charged, direct, offer }] of sw.entries()) {
    /* Bezahltes Angebot: die bestehende Anfrage wird zur Bestellung */
    if (offer) {
      if (paid && (await bookPaidOffer(admin, offer, {
        sessionId: data.sessionId ?? null,
        cents: Math.round((fixed ?? 0) * 100),
        subOrderId: partSub.get(`sweet:${j}`) ?? null,
        customerName: snap.contact.name || null,
      })))
        sweetIds.push(offer.id);
      continue;
    }
    const { data: ins } = await admin
      .from("sweet_requests")
      .insert({
        customer: uid,
        baker_ref: r.bakerId,
        baker_owner: bakerOwner.get(r.bakerId) ?? null,
        sweet_ref: r.sweetId,
        day: r.dateISO,
        qty: r.qty,
        city: r.city,
        wishes: r.wishes,
        customer_name: snap.contact.name || null,
        price_cents: Math.round((fixed ?? charged ?? r.estimate) * 100),
        direct,
        status: direct ? "booked" : "sent",
        /* Wunschtorten sind ebenfalls bezahlt; die Konditorei sagt zu, senkt
           oder erhöht den Preis (lib/wishcake.server.ts) */
        stripe_session_id: paid ? (data.sessionId ?? null) : null,
        paid_cents: charged !== null ? Math.round(charged * 100) : 0,
        sub_order_id: partSub.get(`sweet:${j}`) ?? null,
        /* Stornoregel Torte (kostenlos bis Produktionsbeginn) mit der Bestellung speichern */
        policy: policySnapshot("cake", "moderat", (() => {
          const sweet = cat.extra?.sweet?.(r.sweetId) ?? SWEETS.find((x) => x.id === r.sweetId);
          return sweet ? leadOf(sweet) : 0;
        })()),
      })
      .select("id")
      .single();
    if (ins) {
      sweetIds.push(ins.id);
      const { notifyNewSweet } = await import("@/lib/notify.server");
      await notifyNewSweet(bakerOwner.get(r.bakerId) ?? null, r.dateISO, direct).catch(() => false);
    }
  }

  /* ---- Shop: eine Lieferung je Anbieter (Deko-Anbieter bzw. Showly) ---- */
  const bySub = new Map<number | string, typeof sh>();
  sh.forEach((l, j) => {
    const k = partSub.get(`shop:${j}`) ?? `${l.providerId ?? "showly"}`;
    bySub.set(k, [...(bySub.get(k) ?? []), l]);
  });
  for (const [k, lines] of bySub) {
    const owners = [...new Set(lines.map((l) => l.owner).filter((x): x is string => !!x))];
    const { data: ins } = await admin
      .from("shop_orders")
      .insert({
        customer: uid,
        items: lines.map(({ shopId, mode, qty, price_cents, from, to, size, ship, deposit_cents }) => ({
          shopId,
          mode,
          qty,
          price_cents,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(size ? { size } : {}),
          ...(ship ? { ship } : {}),
          ...(deposit_cents ? { deposit_cents } : {}),
        })),
        total_cents: lines.reduce((n, x) => n + x.price_cents + x.deposit_cents, 0),
        deposit_cents: lines.reduce((n, x) => n + x.deposit_cents, 0),
        status: paid ? "paid" : "pending",
        ship_to: snap.contact.address ?? null,
        /* je Anbieter eine Zeile; die Zahlung ist dieselbe */
        stripe_session_id: data.sessionId ? `${data.sessionId}:${k}` : null,
        provider_owners: owners,
        sub_order_id: typeof k === "number" ? k : null,
        /* Stornoregel Verleih und Sorglos-Paket mit der Bestellung speichern */
        ...(lines.some((l) => l.mode === "rent") ? { policy: policySnapshot("rental", "moderat") } : {}),
        carefree: lines.some((l) => l.mode === "rent" && l.care === true),
      })
      .select("id")
      .single();
    /* Mietartikel: Reservierung aus der Kasse wird zur festen Belegung */
    if (ins && paid) {
      const { rentalItems, claimRentals } = await import("@/lib/rentals.server");
      const rent = rentalItems(lines, (id) => findItem(id, cat.extra));
      if (rent.length) {
        const r = await claimRentals(rent, "booking", holdKey, ins.id);
        if (!r.ok)
          await admin.from("support_tickets").insert({
            profile: uid,
            email: "support@showly.eu",
            name: "Showly",
            topic: "booking",
            body: `Mietartikel doppelt belegt: Bestellung ${ins.id} (Zahlung ${data.sessionId}) kam nach Ablauf der Reservierung, der Zeitraum ist inzwischen vergeben. Bitte mit Anbieter klären oder erstatten.`,
          });
      }
    }
    if (ins && paid) {
      const { notify } = await import("@/lib/notify.server");
      for (const owner of owners)
        await notify(owner, "Neue Bestellung im Showly-Shop", [
          "Es gibt eine neue, bezahlte Bestellung für deine Artikel. Bitte verschick sie zeitnah; alle Angaben stehen in der App.",
        ]).catch(() => false);
    }
  }
  /* Bestätigung mit Zahlungsbeleg an den Kunden (einmal je Zahlung) */
  if (paid && data.sessionId) {
    const itemName = (id: number) => {
      const n = findItem(id, cat.extra)?.name;
      return typeof n === "string" ? n : (n?.de ?? `Artikel ${id}`);
    };
    const sum = [
      ...bk.map((x) => ({ label: `Auftritt am ${x.b.dateISO.split("-").reverse().join(".")}, ${x.b.slot} Uhr`, cents: x.t.amount_cents })),
      ...sw.filter((x) => x.direct && x.fixed).map((x) => ({ label: `Torte/Süßes am ${x.r.dateISO.split("-").reverse().join(".")}`, cents: Math.round(x.fixed! * 100) })),
      ...vn.map((x) => ({
        label: `${x.p.venue.name} am ${x.l.dateISO.split("-").reverse().join(".")}, ${x.l.start} Uhr${x.p.quote.deposit ? ` inkl. Kaution ${(x.p.quote.deposit).toFixed(2).replace(".", ",")} €` : ""}`,
        cents: Math.round((x.p.quote.total + x.p.quote.deposit) * 100),
      })),
      ...sh.map((l) => ({
        label: `${itemName(l.shopId)} (${l.mode === "rent" ? "Miete" : "Kauf"}, ${l.qty}×)${l.deposit_cents ? ` inkl. Kaution ${(l.deposit_cents / 100).toFixed(2).replace(".", ",")} €` : ""}`,
        cents: l.price_cents + l.deposit_cents,
      })),
    ];
    const { notifyOrderConfirmation } = await import("@/lib/notify.server");
    await notifyOrderConfirmation(uid, data.sessionId, sum, sum.reduce((n, x) => n + x.cents, 0)).catch(() => false);
  }

  /* Was von der Reservierung übrig ist, wird frei */
  if (holdKey) {
    const { releaseHold } = await import("@/lib/slots.server");
    await releaseHold(holdKey).catch(() => undefined);
  }
  /* Belege: je Anbieter Rechnung bzw. Buchungsquittung, per E-Mail als PDF
     (lib/belege.server.ts). Wiederholbar; ein Fehler hält die Buchung nicht auf. */
  if (paid && orderId) {
    const { belegeFuerBestellung } = await import("@/lib/belege.server");
    await belegeFuerBestellung(orderId).catch((e) => console.error("belege", e));
  }
  return { ok: true, bookingIds, sweetIds, orderId };
}
