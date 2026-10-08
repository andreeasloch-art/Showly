/* Bezahlten Warenkorb in die Datenbank schreiben: Bestellung, Teilbestellungen
 * je Anbieter, Buchungen, Torten, Shop. Aufgerufen von recordCart (Rückkehr
 * aus der Kasse im Browser) und vom Stripe-Webhook (api.stripe.webhook.ts),
 * falls der Browser vorher zugeht. Dieselbe Zahlung wird nur einmal
 * eingetragen, egal wer zuerst kommt. */
import { adminClient } from "@/lib/supabase.server";
import type { BookingRow } from "@/lib/database.types";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import type { Snapshot } from "@/showly/cartSnapshot";

/* ---------------------------------------------------------------------------
 * Preise eines Künstlers: Katalog (Beispielprofile) oder Datenbank
 * ------------------------------------------------------------------------ */
const REAL_ARTIST_FROM = 100000;

async function artistTerms(admin: ReturnType<typeof adminClient>, artistId: number, hours: number, pkg?: string) {
  const { bookingPrice, findArtist, FEE_RATE, MAX_HOURS } = await import("@/showly/pricing");
  const { isInstant, standingOf } = await import("@/showly/booking");
  if (artistId < REAL_ARTIST_FROM) {
    const a = findArtist(artistId);
    if (!a || a.demo) return null; // Beispielprofile sind nicht buchbar
    const p = bookingPrice(a, hours, pkg);
    return {
      artist_id: null as number | null,
      catalog_artist: artistId,
      hours: p.hours,
      amount_cents: Math.round(p.total * 100),
      fee_cents: Math.round(p.fee * 100),
      payout_cents: Math.round(p.payout * 100),
      instant: isInstant(a),
    };
  }
  const { data: a } = await admin
    .from("artists")
    .select("id, price_cents, instant_book, published")
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
  const base = a.price_cents * h;
  const fee = Math.round(base * FEE_RATE);
  return {
    artist_id: a.id as number | null,
    catalog_artist: null as number | null,
    hours: h,
    /* Kunde zahlt den Endpreis; Showly behält die Provision ein */
    amount_cents: base,
    fee_cents: fee,
    payout_cents: base - fee,
    instant: a.instant_book && standing.instantAllowed,
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
  });
  const { newCheckinCode } = await import("@/showly/booking");
  const { findItem, shopLineParts, sweetPrice } = await import("@/showly/pricing");
  const { plannedPayout } = await import("@/showly/cloudRules");

  /* Bezahlt? Nur Stripe selbst gibt darüber Auskunft. Dieselbe Zahlung
     wird nur einmal eingetragen. */
  let paid = false;
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
      amount = s.amount_total ?? -1;
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
      snap.requests.filter((r) => r.direct).map((r) => ({ sweetId: r.sweetId, qty: r.qty, dateISO: r.dateISO })),
      cat.extra,
      { allowDemo: false },
    );
    const expected = lines.reduce((s, l) => s + l.amountInCents * l.quantity, 0);
    if (unknown.length || expected !== amount) return { error: "Betrag passt nicht zum Warenkorb" };
  }

  /* Torten-Anfragen ohne Zahlung: Tag und Pflichtangaben prüfen (mit
     Zahlung hat das schon die Kasse getan, createCartCheckout) */
  if (!data.sessionId && snap.requests.length) {
    const { checkCakeOrders } = await import("@/lib/cakes.server");
    const err = await checkCakeOrders(admin, snap.requests);
    if (err) return { error: err };
  }

  /* ------------------------------------------------------------------
     Ein Warenkorb für ein Event, aber verschiedene Anbieter: Bestellung
     (orders) mit einer Teilbestellung je Anbieter (sub_orders). Jede
     Buchung, Torte und Shop-Position hängt an ihrer Teilbestellung.
     ------------------------------------------------------------------ */
  const { splitIntoSubOrders } = await import("@/showly/subOrders");
  const { FEE_RATE } = await import("@/showly/pricing");

  const bk = (await Promise.all(snap.bookings.map((b) => artistTerms(admin, b.artistId, b.hours, b.pkg))))
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
    const fixed = r.direct ? sweetPrice(r.sweetId, r.qty, cat.extra) : null;
    /* Direkt buchen geht nur mit Katalogpreis und nur bezahlt */
    return { r, fixed, direct: fixed !== null && paid };
  });

  const sh = snap.shop
    .map((l) => {
      const it = findItem(l.shopId, cat.extra);
      if (!it || it.own) return null;
      const parts = shopLineParts(it, l);
      return {
        ...l,
        /* Ware bzw. Miete samt Übergabe; die Kaution steht extra */
        price_cents: Math.round((parts.goods + parts.ship) * 100),
        deposit_cents: Math.round(parts.deposit * 100),
        providerId: cat.offerProvider.get(l.shopId) ?? null,
        owner: cat.offerOwner.get(l.shopId) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const drafts = splitIntoSubOrders({
    paid,
    feeRate: FEE_RATE,
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
  });

  /* Bestellung und Teilbestellungen anlegen */
  let orderId: number | null = null;
  const subId = new Map<string, number>();
  const partSub = new Map<string, number>();
  if (drafts.length) {
    const days = [...bk.map((x) => x.b.dateISO), ...sw.map((x) => x.r.dateISO)].sort();
    const { data: order } = await admin
      .from("orders")
      .insert({
        customer: uid,
        stripe_session_id: data.sessionId ?? null,
        event_day: days[0] ?? null,
        total_cents: drafts.reduce((n, d) => n + d.amountCents, 0),
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
        ...plannedPayout({ day: b.dateISO, amount_cents: terms.amount_cents, payout_cents: terms.payout_cents }, count || 0),
      });
    }
    /* Startzeit im Kalender des Künstlers anzeigen */
    if (terms.artist_id)
      await admin.from("availability").upsert({ artist_id: terms.artist_id, day: b.dateISO, slot: b.slot, blocked: true });
  }
  /* Nicht mehr gebrauchte Reservierungen (z. B. Anfrage-Künstler) freigeben */

  /* ---- Torten & Süßes ---- */
  const sweetIds: number[] = [];
  for (const [j, { r, fixed, direct }] of sw.entries()) {
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
        price_cents: Math.round((fixed ?? r.estimate) * 100),
        direct,
        status: direct ? "booked" : "sent",
        stripe_session_id: direct ? data.sessionId ?? null : null,
        sub_order_id: partSub.get(`sweet:${j}`) ?? null,
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
  /* Was von der Reservierung übrig ist, wird frei */
  if (holdKey) {
    const { releaseHold } = await import("@/lib/slots.server");
    await releaseHold(holdKey).catch(() => undefined);
  }
  return { ok: true, bookingIds, sweetIds, orderId };
}
