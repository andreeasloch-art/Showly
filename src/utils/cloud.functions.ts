/* Buchungen, Strafen, Gutscheine, Auszahlungen, Torten und Shop in der
 * Datenbank, Server-Seite.
 *
 * Der Browser schickt nur, WAS passieren soll (Warenkorb mit Kennungen,
 * "Anfrage annehmen", "Check-in mit Code 4711"). Ob es erlaubt ist und was
 * es kostet, entscheidet der Server: Preise aus dem Katalog bzw. aus der
 * Datenbank, Regeln aus cloudRules.ts. Geschrieben wird mit dem
 * Dienstschlüssel, gelesen mit den Rechten der angemeldeten Person.
 *
 * Ohne Anmeldung über die Datenbank tun diese Funktionen nichts; die App
 * läuft dann wie bisher im Browser weiter. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import type { BookingRow, PenaltyRow } from "@/lib/database.types";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import type { CloudAction } from "@/showly/cloudRules";

type Snapshot = {
  bookings: {
    artistId: number;
    dateISO: string;
    slot: string;
    hours: number;
    pkg?: string | undefined;
    figure?: string | undefined;
    guests?: string | undefined;
    address?: string | undefined;
    occasion?: string | undefined;
    notes?: string | undefined;
  }[];
  requests: {
    sweetId: number;
    bakerId: number;
    dateISO: string;
    qty: number;
    city: string;
    wishes: string;
    estimate: number;
    direct?: boolean | undefined;
  }[];
  shop: { shopId: number; mode: "rent" | "buy"; qty: number }[];
  contact: { name: string; address?: string | undefined };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT = /^\d{2}:\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Nur die Felder übernehmen, die wir kennen, in vernünftiger Länge */
function cleanSnapshot(s: Snapshot): Snapshot {
  if (!s || !Array.isArray(s.bookings) || !Array.isArray(s.requests) || !Array.isArray(s.shop))
    throw new Error("Ungültiger Warenkorb");
  if (s.bookings.length > 10 || s.requests.length > 20 || s.shop.length > 50) throw new Error("Warenkorb zu groß");
  return {
    bookings: s.bookings.map((b) => {
      if (!Number.isInteger(b.artistId) || !DATE.test(b.dateISO) || !SLOT.test(b.slot)) throw new Error("Ungültige Buchung");
      return {
        artistId: b.artistId,
        dateISO: b.dateISO,
        slot: b.slot,
        hours: Math.max(1, Math.min(12, Math.round(Number(b.hours)) || 1)),
        pkg: text(b.pkg, 40),
        figure: text(b.figure, 120),
        guests: text(b.guests, 12),
        address: text(b.address, 300),
        occasion: text(b.occasion, 120),
        notes: text(b.notes, 2000),
      };
    }),
    requests: s.requests.map((r) => {
      if (!Number.isInteger(r.sweetId) || !Number.isInteger(r.bakerId) || !DATE.test(r.dateISO)) throw new Error("Ungültige Anfrage");
      return {
        sweetId: r.sweetId,
        bakerId: r.bakerId,
        dateISO: r.dateISO,
        qty: Math.max(1, Math.min(5000, Math.round(Number(r.qty)) || 1)),
        city: text(r.city, 80) ?? "",
        wishes: text(r.wishes, 2000) ?? "",
        estimate: Math.max(0, Number(r.estimate) || 0),
        direct: !!r.direct,
      };
    }),
    shop: s.shop.map((l) => {
      if (!Number.isInteger(l.shopId) || (l.mode !== "rent" && l.mode !== "buy")) throw new Error("Ungültiger Artikel");
      return { shopId: l.shopId, mode: l.mode, qty: Math.max(1, Math.min(99, Math.round(Number(l.qty)) || 1)) };
    }),
    contact: { name: text(s.contact?.name, 120) ?? "", address: text(s.contact?.address, 300) },
  };
}

/** Ist der Nutzer nicht über die Datenbank angemeldet, bleibt alles im Browser */
async function userOrNull() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Preise eines Künstlers: Katalog (Beispielprofile) oder Datenbank
 * ------------------------------------------------------------------------ */
const REAL_ARTIST_FROM = 100000;

async function artistTerms(admin: ReturnType<typeof adminClient>, artistId: number, hours: number, pkg?: string) {
  const { bookingPrice, findArtist, FEE_RATE, MAX_HOURS } = await import("@/showly/pricing");
  const { isInstant, standingOf } = await import("@/showly/booking");
  if (artistId < REAL_ARTIST_FROM) {
    const a = findArtist(artistId);
    if (!a) return null;
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
    amount_cents: base + fee,
    fee_cents: fee,
    payout_cents: Math.round(base * (1 - FEE_RATE)),
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

export const recordCart = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { snapshot: Snapshot; sessionId?: string; environment?: StripeEnv }) => {
      if (data.sessionId !== undefined && !/^[a-zA-Z0-9_-]{8,200}$/.test(data.sessionId))
        throw new Error("Ungültige Sitzung");
      if (data.environment !== undefined && data.environment !== "sandbox" && data.environment !== "live")
        throw new Error("Ungültige Umgebung");
      return { ...data, snapshot: cleanSnapshot(data.snapshot) };
    },
  )
  .handler(async ({ data }): Promise<RecordResult> => {
    const ctx = await userOrNull();
    if (!ctx) return { skipped: true };
    const uid = ctx.user.id;
    if (!(await allow("cart", uid))) return { error: TOO_MANY };
    const admin = adminClient();
    const snap = data.snapshot;
    const { loadCatalog } = await import("@/lib/catalog.server");
    const cat = await loadCatalog(admin, {
      artists: snap.bookings.map((b) => b.artistId),
      sweets: snap.requests.map((r) => r.sweetId),
      items: snap.shop.map((l) => l.shopId),
    });
    const { newCheckinCode } = await import("@/showly/booking");
    const { findItem, shopUnit, sweetPrice } = await import("@/showly/pricing");
    const { plannedPayout } = await import("@/showly/cloudRules");

    /* Bezahlt? Nur Stripe selbst gibt darüber Auskunft. Dieselbe Zahlung
       wird nur einmal eingetragen. */
    let paid = false;
    if (data.sessionId) {
      const { data: seen } = await admin
        .from("bookings")
        .select("id")
        .like("stripe_session_id", `${data.sessionId}:%`)
        .limit(1);
      const { data: seenOrder } = await admin
        .from("shop_orders")
        .select("id")
        .eq("stripe_session_id", data.sessionId)
        .limit(1);
      if ((seen && seen.length) || (seenOrder && seenOrder.length)) return { ok: true, bookingIds: [], sweetIds: [], orderId: null };
      let amount = -1;
      try {
        const stripe = createStripeClient(data.environment ?? "sandbox");
        const s = await stripe.checkout.sessions.retrieve(data.sessionId);
        paid = s.payment_status === "paid";
        amount = s.amount_total ?? -1;
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
        { rent: "", buy: "", fee: "" },
        snap.requests.filter((r) => r.direct).map((r) => ({ sweetId: r.sweetId, qty: r.qty, dateISO: r.dateISO })),
        cat.extra,
      );
      const expected = lines.reduce((s, l) => s + l.amountInCents * l.quantity, 0);
      if (unknown.length || expected !== amount) return { error: "Betrag passt nicht zum Warenkorb" };
    }

    const bookingIds: number[] = [];
    for (const [i, b] of snap.bookings.entries()) {
      const terms = await artistTerms(admin, b.artistId, b.hours, b.pkg);
      if (!terms) continue;
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
      } as Partial<BookingRow>;
      const { data: ins, error } = await admin.from("bookings").insert(row).select("id").single();
      if (error || !ins) continue;
      bookingIds.push(ins.id);
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
      /* Termin im Kalender des Künstlers belegen */
      if (terms.artist_id)
        await admin.from("availability").upsert({ artist_id: terms.artist_id, day: b.dateISO, slot: b.slot, blocked: true });
    }

    /* Besitzer echter Torten-Anbieter, damit sie die Anfrage sehen */
    const bakerRefs = [...new Set(snap.requests.map((r) => r.bakerId).filter((x) => x >= 100000))];
    const bakerOwner = new Map<number, string>();
    if (bakerRefs.length) {
      const { data: provs } = await admin.from("providers").select("id, owner").in("id", bakerRefs).eq("kind", "baker");
      for (const p of provs || []) bakerOwner.set(p.id, p.owner);
    }
    const sweetIds: number[] = [];
    for (const r of snap.requests) {
      const fixed = r.direct ? sweetPrice(r.sweetId, r.qty, cat.extra) : null;
      /* Direkt buchen geht nur mit Katalogpreis und nur bezahlt */
      const direct = fixed !== null && paid;
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
        })
        .select("id")
        .single();
      if (ins) sweetIds.push(ins.id);
    }

    let orderId: number | null = null;
    const items = snap.shop
      .map((l) => {
        const it = findItem(l.shopId, cat.extra);
        return it && !it.own ? { ...l, price_cents: Math.round(shopUnit(it, l.mode) * l.qty * 100) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const providerOwners = [...new Set(items.map((x) => cat.offerOwner.get(x.shopId)).filter((x): x is string => !!x))];
    if (items.length) {
      const { data: ins } = await admin
        .from("shop_orders")
        .insert({
          customer: uid,
          items,
          total_cents: items.reduce((s, x) => s + x.price_cents, 0),
          status: paid ? "paid" : "pending",
          ship_to: snap.contact.address ?? null,
          stripe_session_id: data.sessionId ?? null,
          provider_owners: providerOwners,
        })
        .select("id")
        .single();
      orderId = ins?.id ?? null;
    }
    return { ok: true, bookingIds, sweetIds, orderId };
  });

/* ---------------------------------------------------------------------------
 * Aktion an einer Buchung: annehmen, absagen, einchecken, melden …
 * ------------------------------------------------------------------------ */
export type ActionResult = { ok: true; result: string } | { error: string } | { skipped: true };

const KINDS = new Set(["respond", "cancelArtist", "cancelCustomer", "reportNoShow", "confirmPresence", "checkin", "claim"]);

export const bookingAction = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingId: number; action: CloudAction }) => {
    if (!Number.isInteger(data.bookingId) || data.bookingId <= 0) throw new Error("Ungültige Buchung");
    if (!data.action || !KINDS.has(data.action.kind)) throw new Error("Ungültige Aktion");
    const a = data.action;
    if (a.kind === "checkin" && !/^\d{4}$/.test(String(a.code).replace(/\D/g, ""))) throw new Error("Ungültiger Code");
    if (a.kind === "claim" && a.statement !== undefined) a.statement = String(a.statement).slice(0, 2000);
    return data;
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    const ctx = await userOrNull();
    if (!ctx) return { skipped: true };
    const uid = ctx.user.id;
    if (!(await allow("action", uid))) return { error: TOO_MANY };
    const admin = adminClient();
    const { decide, plannedPayout } = await import("@/showly/cloudRules");
    const { VOUCHER_EUR, voucherCode, voucherValidUntil } = await import("@/showly/booking");

    const { data: b } = await admin.from("bookings").select("*").eq("id", data.bookingId).maybeSingle();
    if (!b) return { error: "Buchung nicht gefunden" };
    let role: "customer" | "artist" | null = b.customer === uid ? "customer" : null;
    if (b.artist_id) {
      const { data: a } = await admin.from("artists").select("owner").eq("id", b.artist_id).maybeSingle();
      if (a?.owner === uid) role = "artist";
    }
    if (!role) return { error: "Keine Berechtigung" };

    const { data: pen } = await admin.from("penalties").select("*").eq("booking_id", b.id).maybeSingle();
    const { data: code } = await admin.from("booking_codes").select("code").eq("booking_id", b.id).maybeSingle();
    const d = decide(data.action, role, { ...b, checkin_code: code?.code ?? null }, Date.now(), pen);
    if ("error" in d) return d;

    if (d.booking) {
      const { error } = await admin.from("bookings").update(d.booking as Partial<BookingRow>).eq("id", b.id);
      if (error) return { error: "Speichern fehlgeschlagen" };
      if ((d.booking["status"] === "declined" || d.booking["status"] === "cancelled") && b.artist_id && b.slot)
        await admin.from("availability").delete().eq("artist_id", b.artist_id).eq("day", b.day).eq("slot", b.slot);
    }
    if (d.newPenalty) {
      await admin.from("penalties").upsert(
        { booking_id: b.id, artist_id: b.artist_id, ...d.newPenalty } as Partial<PenaltyRow>,
        { onConflict: "booking_id" },
      );
    }
    if (d.penalty && pen) await admin.from("penalties").update(d.penalty as Partial<PenaltyRow>).eq("id", pen.id);
    if (d.voucher && b.customer) await issueVoucher(admin, b.id, b.customer, VOUCHER_EUR, voucherCode, voucherValidUntil);
    if (d.payout === "cancel") await admin.from("payouts").update({ status: "cancelled" }).eq("booking_id", b.id).neq("status", "paid");
    if (d.payout === "create" && b.artist_id) {
      const { count } = await admin.from("payouts").select("id", { count: "exact", head: true }).eq("artist_id", b.artist_id);
      await admin
        .from("payouts")
        .upsert({ artist_id: b.artist_id, booking_id: b.id, ...plannedPayout(b, count || 0) }, { onConflict: "booking_id" });
    }
    return { ok: true, result: d.result };
  });

async function issueVoucher(
  admin: ReturnType<typeof adminClient>,
  bookingId: number,
  owner: string,
  eur: number,
  code: () => string,
  validUntil: () => string,
) {
  for (let i = 0; i < 3; i++) {
    const { error } = await admin
      .from("vouchers")
      .insert({ code: code(), owner, booking_id: bookingId, amount_cents: eur * 100, valid_until: validUntil() });
    /* Doppelter Code: neu würfeln. Schon ein Gutschein zur Buchung: fertig. */
    if (!error || error.message.includes("booking_id")) return;
  }
}

/* ---------------------------------------------------------------------------
 * Eigene Daten laden (als Kunde und als Künstler)
 *
 * Vorher werden abgelaufene Fristen erledigt: unbeantwortete Anfragen
 * verfallen nach 48 Stunden, Anhörungen nach 7 Tagen werden zur fälligen
 * Strafe mit Gutschein für den Kunden.
 * ------------------------------------------------------------------------ */
export const loadMine = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await userOrNull();
  if (!ctx) return { skipped: true as const };
  const uid = ctx.user.id;
  const admin = adminClient();
  const sb = ctx.sb;
  const { requestLapsed, hearingOver } = await import("@/showly/cloudRules");
  const { VOUCHER_EUR, voucherCode, voucherValidUntil } = await import("@/showly/booking");

  const { data: own } = await admin.from("artists").select("id, name").eq("owner", uid);
  const artistIds = (own || []).map((a) => a.id);

  /* Fristen erledigen, soweit sie diese Person betreffen */
  const mineFilter = artistIds.length ? `customer.eq.${uid},artist_id.in.(${artistIds.join(",")})` : `customer.eq.${uid}`;
  const { data: open } = await admin.from("bookings").select("*").eq("status", "requested").or(mineFilter);
  for (const b of open || []) {
    if (requestLapsed(b)) {
      await admin.from("bookings").update({ status: "declined" }).eq("id", b.id).eq("status", "requested");
      if (b.artist_id && b.slot)
        await admin.from("availability").delete().eq("artist_id", b.artist_id).eq("day", b.day).eq("slot", b.slot);
    }
  }
  const { data: hearings } = await admin
    .from("penalties")
    .select("id, booking_id, status, hearing_until, bookings!inner(customer, artist_id)")
    .eq("status", "hearing");
  for (const p of (hearings || []) as unknown as (PenaltyRow & { bookings: { customer: string | null; artist_id: number | null } })[]) {
    const involved = p.bookings.customer === uid || (p.bookings.artist_id != null && artistIds.includes(p.bookings.artist_id));
    if (!involved || !hearingOver(p)) continue;
    const now = new Date().toISOString();
    await admin.from("penalties").update({ status: "due", due_at: now, updated_at: now }).eq("id", p.id).eq("status", "hearing");
    if (p.bookings.customer)
      await issueVoucher(admin, p.booking_id, p.bookings.customer, VOUCHER_EUR, voucherCode, voucherValidUntil);
  }

  /* Lesen mit den Rechten der Person: die Zugriffsregeln gelten */
  const [bookings, penalties, vouchers, payouts, sweets, orders, account, codes] = await Promise.all([
    sb.from("bookings").select("*").order("day", { ascending: false }).limit(500),
    sb.from("penalties").select("*").limit(500),
    sb.from("vouchers").select("*").limit(100),
    sb.from("payouts").select("*").order("payout_on", { ascending: false }).limit(500),
    sb.from("sweet_requests").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("payout_accounts").select("payouts_enabled").eq("profile_id", uid).maybeSingle(),
    /* nur die Codes eigener Buchungen als Kunde (Zugriffsregel) */
    sb.from("booking_codes").select("booking_id, code").limit(500),
  ]);
  return {
    skipped: false as const,
    uid,
    artists: (own || []).map((a) => ({ id: a.id as number, name: a.name })),
    bookings: bookings.data || [],
    penalties: penalties.data || [],
    vouchers: vouchers.data || [],
    payouts: payouts.data || [],
    sweets: sweets.data || [],
    orders: orders.data || [],
    payoutAccount: account.data ? { enabled: account.data.payouts_enabled } : null,
    codes: codes.data || [],
  };
});

/* ---------------------------------------------------------------------------
 * Künstlerprofil anlegen (Registrierung über "Mitmachen")
 *
 * Die Rolle setzt nur der Server. Das Profil bleibt unveröffentlicht, bis
 * die Ausweisprüfung bestanden ist (identity.functions.ts veröffentlicht es
 * dann). So kann niemand ungeprüft Buchungen annehmen.
 * ------------------------------------------------------------------------ */
export interface ArtistSignup {
  cat: string;
  stage: string;
  real: string;
  loc: string;
  price: number;
  desc: string;
  planner: boolean;
  figures: string[];
  radiusKm: number;
  birthDate: string;
  business: boolean;
  rulesAcceptedAt: string;
}

export const registerArtist = createServerFn({ method: "POST" })
  .inputValidator((d: ArtistSignup) => {
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const out: ArtistSignup = {
      cat: s(d.cat, 40),
      stage: s(d.stage, 80),
      real: s(d.real, 120),
      loc: s(d.loc, 80),
      price: Math.max(1, Math.min(100000, Math.round(Number(d.price)) || 0)),
      desc: s(d.desc, 3000),
      planner: !!d.planner,
      figures: Array.isArray(d.figures) ? d.figures.map((f) => s(f, 60)).filter(Boolean).slice(0, 30) : [],
      radiusKm: Math.max(1, Math.min(800, Math.round(Number(d.radiusKm)) || 50)),
      birthDate: DATE.test(d.birthDate) ? d.birthDate : "",
      business: d.business === true,
      rulesAcceptedAt: s(d.rulesAcceptedAt, 40),
    };
    if (!/^[a-z0-9_-]{2,40}$/.test(out.cat) || !out.real || !out.loc || !out.birthDate)
      throw new Error("Angaben unvollständig");
    /* AGB § 18: gewerblich und Regeln zu Absage und Strafe bestätigt */
    if (!out.business || !out.rulesAcceptedAt) throw new Error("Bestätigungen fehlen");
    return out;
  })
  .handler(async ({ data }): Promise<{ id: number } | { error: string } | { skipped: true }> => {
    const ctx = await userOrNull();
    if (!ctx) return { skipped: true };
    if (!(await allow("signup", ctx.user.id))) return { error: TOO_MANY };
    const admin = adminClient();
    const { data: existing } = await admin.from("artists").select("id").eq("owner", ctx.user.id).limit(1);
    if (existing && existing[0]) return { id: existing[0].id };

    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role: data.planner ? "planner" : "artist", display_name: data.real, updated_at: new Date().toISOString() })
      .eq("id", ctx.user.id);
    if (roleErr) return { error: "Profil konnte nicht gespeichert werden" };

    const L = (v: string) => ({ de: v, en: v, es: v });
    const { data: ins, error } = await admin
      .from("artists")
      .insert({
        owner: ctx.user.id,
        cat: data.cat,
        name: L(data.stage || data.real),
        loc: L(data.loc),
        descr: L(data.desc),
        tags: { de: [], en: [] },
        langs: { de: ["Deutsch"], en: ["German"] },
        includes: data.planner
          ? { de: ["Beratung", "Planung", "Koordination"], en: ["Consulting", "Planning", "Coordination"] }
          : { de: ["Auftritt", "Kostüm", "Musik"], en: ["Performance", "Costume", "Music"] },
        specs: { de: data.figures, en: data.figures },
        price_cents: data.price * 100,
        published: false,
        instant_book: true,
      })
      .select("id")
      .single();
    if (error || !ins) return { error: "Profil konnte nicht angelegt werden" };
    return { id: ins.id };
  });

/* ---------------------------------------------------------------------------
 * Auszahlungskonto über Stripe Connect (AGB § 21 Abs. 3)
 *
 * Bankdaten und Identität erfasst Stripe in einem eigenen, gesicherten
 * Fenster. Showly merkt sich nur die Kontokennung von Stripe. Voraussetzung:
 * Connect ist im Stripe-Dashboard für das Showly-Konto freigeschaltet.
 * ------------------------------------------------------------------------ */
export const connectOnboarding = createServerFn({ method: "POST" })
  .inputValidator((d: { returnUrl: string; environment: StripeEnv }) => {
    if (!/^https?:\/\/[^\s]+$/.test(d.returnUrl)) throw new Error("Ungültige Adresse");
    if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Ungültige Umgebung");
    return d;
  })
  .handler(async ({ data }): Promise<{ url: string } | { error: string } | { skipped: true }> => {
    const ctx = await userOrNull();
    if (!ctx) return { skipped: true };
    if (!(await allow("connect", ctx.user.id))) return { error: TOO_MANY };
    const admin = adminClient();
    /* Auszahlungskonto für Künstler und für Anbieter (Torten, Deko) */
    const { data: own } = await admin.from("artists").select("id").eq("owner", ctx.user.id).limit(1);
    const { data: prov } = await admin.from("providers").select("id").eq("owner", ctx.user.id).limit(1);
    if ((!own || !own[0]) && (!prov || !prov[0])) return { error: "Erst ein Anbieterprofil anlegen" };
    try {
      const stripe = createStripeClient(data.environment);
      const { data: acc } = await admin
        .from("payout_accounts")
        .select("stripe_account_id")
        .eq("profile_id", ctx.user.id)
        .maybeSingle();
      let accountId = acc?.stripe_account_id;
      if (!accountId) {
        const created = await stripe.accounts.create({
          type: "express",
          country: "DE",
          ...(ctx.user.email ? { email: ctx.user.email } : {}),
          capabilities: { transfers: { requested: true } },
          metadata: { profile_id: ctx.user.id },
        });
        accountId = created.id;
        await admin.from("payout_accounts").insert({ profile_id: ctx.user.id, stripe_account_id: accountId });
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        return_url: data.returnUrl,
        refresh_url: data.returnUrl,
      });
      return { url: link.url };
    } catch (e) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(e) };
    }
  });

export const connectStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { environment: StripeEnv }) => {
    if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Ungültige Umgebung");
    return d;
  })
  .handler(async ({ data }): Promise<{ state: "none" | "incomplete" | "ready" } | { skipped: true } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx) return { skipped: true };
    const admin = adminClient();
    const { data: acc } = await admin
      .from("payout_accounts")
      .select("stripe_account_id")
      .eq("profile_id", ctx.user.id)
      .maybeSingle();
    if (!acc) return { state: "none" };
    try {
      const stripe = createStripeClient(data.environment);
      const a = await stripe.accounts.retrieve(acc.stripe_account_id);
      const ready = !!a.payouts_enabled;
      await admin
        .from("payout_accounts")
        .update({ payouts_enabled: ready, updated_at: new Date().toISOString() })
        .eq("profile_id", ctx.user.id);
      return { state: ready ? "ready" : "incomplete" };
    } catch (e) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(e) };
    }
  });
