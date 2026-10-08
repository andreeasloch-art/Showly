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

import type { RecordResult } from "@/lib/cart.server";
import { cleanSnapshot, type Snapshot } from "@/showly/cartSnapshot";

export type { RecordResult };

/** Ist der Nutzer nicht über die Datenbank angemeldet, bleibt alles im Browser */
async function userOrNull() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}


export const recordCart = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { snapshot: Snapshot; sessionId?: string; environment?: StripeEnv; holdKey?: string }) => {
      if (data.sessionId !== undefined && !/^[a-zA-Z0-9_-]{8,200}$/.test(data.sessionId))
        throw new Error("Ungültige Sitzung");
      if (data.holdKey !== undefined && !/^[0-9a-f]{32}$/.test(data.holdKey)) throw new Error("Ungültige Reservierung");
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
    const { recordCartCore } = await import("@/lib/cart.server");
    return recordCartCore(uid, data);
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
    const { voucherCode, voucherValidUntil } = await import("@/showly/booking");

    const { data: b } = await admin.from("bookings").select("*").eq("id", data.bookingId).maybeSingle();
    if (!b) return { error: "Buchung nicht gefunden" };
    let role: "customer" | "artist" | null = b.customer === uid ? "customer" : null;
    let business = true;
    if (b.artist_id) {
      const { data: a } = await admin.from("artists").select("owner, business").eq("id", b.artist_id).maybeSingle();
      if (a?.owner === uid) role = "artist";
      business = a?.business !== false;
    }
    if (!role) return { error: "Keine Berechtigung" };

    /* Zusage nur, wenn die Show samt einer Stunde Fahrtzeit neben die schon
       zugesagten Shows passt (showly/schedule.ts). Offene Anfragen anderer
       Kunden zählen hier nicht; über die entscheidet der Künstler danach. */
    if (data.action.kind === "respond" && data.action.accept && b.artist_id && b.slot) {
      const { bookingEntry, clashes, parseBusy } = await import("@/showly/schedule");
      const { data: others } = await admin
        .from("bookings")
        .select("slot, hours")
        .eq("artist_id", b.artist_id)
        .eq("day", b.day)
        .neq("id", b.id)
        .in("status", ["pending", "confirmed", "completed"]);
      const busy = parseBusy((others || []).filter((o) => o.slot).map((o) => bookingEntry(o.slot!, o.hours || 2)));
      if (clashes(b.slot, b.hours || 2, busy))
        return { error: "Diese Show überschneidet sich mit einer anderen Show an dem Tag (zwischen zwei Shows bleibt eine Stunde Fahrtzeit). Bitte lehne die Anfrage ab oder sprich einen anderen Termin ab." };
    }

    const { data: pen } = await admin.from("penalties").select("*").eq("booking_id", b.id).maybeSingle();
    const { data: code } = await admin.from("booking_codes").select("code").eq("booking_id", b.id).maybeSingle();
    const d = decide(data.action, role, { ...b, checkin_code: code?.code ?? null, business }, Date.now(), pen);
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
    /* Erstattung sofort über Stripe. Klappt das nicht, sieht die Verwaltung
       die Buchung unter "Erstattungen" und kann es per Klick nachholen. */
    if (d.refund) {
      const { refundBooking } = await import("@/lib/money.server");
      const reason =
        data.action.kind === "cancelCustomer"
          ? "kostenlose Stornierung"
          : data.action.kind === "reportNoShow"
            ? "Nichterscheinen gemeldet"
            : "Absage durch die anbietende Person";
      await refundBooking(b.id, { reason }).catch(() => null);
    }
    {
      const { notifyBookingChange } = await import("@/lib/notify.server");
      const k = data.action.kind;
      const change =
        k === "respond"
          ? data.action.accept
            ? "accepted"
            : "declined"
          : k === "cancelArtist"
            ? "cancelledByArtist"
            : k === "cancelCustomer"
              ? "cancelledByCustomer"
              : null;
      if (change) await notifyBookingChange(change, b).catch(() => false);
    }
    /* Teil-Erstattung nach Stornostufe; Auszahlung auf den Anteil kürzen */
    if (d.refundCents) {
      const { refundBooking } = await import("@/lib/money.server");
      await refundBooking(b.id, { cents: d.refundCents, reason: "Stornierung nach Stornostufe" }).catch(() => null);
    }
    if (d.payoutShare !== undefined && d.payoutShare < 1) {
      const { data: po } = await admin.from("payouts").select("id, net_cents").eq("booking_id", b.id).neq("status", "paid").maybeSingle();
      if (po)
        await admin
          .from("payouts")
          .update({ net_cents: Math.round(b.payout_cents * d.payoutShare), reserve_cents: 0 })
          .eq("id", po.id);
    }
    /* Ersatzgarantie: drei Ersatz-Vorschläge, Ticket, unter 48 h vorrangig per E-Mail (lib/fair.server.ts) */
    if (data.action.kind === "cancelArtist" || data.action.kind === "reportNoShow") {
      const { guaranteeCase } = await import("@/lib/fair.server");
      await guaranteeCase(admin, b, data.action.kind).catch(() => null);
    }
    if (d.voucher && b.customer) {
      const { apologyVoucherCents } = await import("@/showly/policies");
      await issueVoucher(admin, b.id, b.customer, apologyVoucherCents(b.amount_cents) / 100, voucherCode, voucherValidUntil);
    }
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
      .insert({ code: code(), owner, booking_id: bookingId, amount_cents: Math.round(eur * 100), valid_until: validUntil() });
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
  const { voucherCode, voucherValidUntil } = await import("@/showly/booking");

  const { data: own } = await admin.from("artists").select("id, name").eq("owner", uid);
  const artistIds = (own || []).map((a) => a.id);

  /* Fristen erledigen, soweit sie diese Person betreffen */
  const mineFilter = artistIds.length ? `customer.eq.${uid},artist_id.in.(${artistIds.join(",")})` : `customer.eq.${uid}`;
  const { data: open } = await admin.from("bookings").select("*").eq("status", "requested").or(mineFilter);
  for (const b of open || []) {
    if (requestLapsed(b)) {
      await admin.from("bookings").update({ status: "declined" }).eq("id", b.id).eq("status", "requested");
      /* Nicht rechtzeitig bestätigt: Geld zurück (AGB § 5 Abs. 3) */
      if (b.paid) {
        const { refundBooking } = await import("@/lib/money.server");
        await refundBooking(b.id, { reason: "Anfrage nicht rechtzeitig bestätigt" }).catch(() => null);
      }
      const { notifyBookingChange } = await import("@/lib/notify.server");
      await notifyBookingChange("declined", b).catch(() => false);
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
    if (p.bookings.customer) {
      const { data: bk } = await admin.from("bookings").select("amount_cents").eq("id", p.booking_id).maybeSingle();
      const { apologyVoucherCents } = await import("@/showly/policies");
      await issueVoucher(admin, p.booking_id, p.bookings.customer, apologyVoucherCents(bk?.amount_cents ?? 0) / 100, voucherCode, voucherValidUntil);
    }
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
  /** Volljährigkeit bestätigt (kein Geburtsdatum, Datensparsamkeit) */
  adult: boolean;
  business: boolean;
  rulesAcceptedAt: string;
  taxAck: boolean;
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
      adult: d.adult === true,
      business: d.business === true,
      rulesAcceptedAt: s(d.rulesAcceptedAt, 40),
      taxAck: d.taxAck === true,
    };
    if (!/^[a-z0-9_-]{2,40}$/.test(out.cat) || !out.real || !out.loc || !out.adult)
      throw new Error("Angaben unvollständig");
    /* AGB § 18: privat oder gewerblich angegeben, Regeln zu Absage und
       Nichterscheinen sowie Steuerhinweis bestätigt */
    if (typeof d.business !== "boolean" || !out.rulesAcceptedAt || !out.taxAck)
      throw new Error("Bestätigungen fehlen");
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
        business: data.business,
        tax_ack_at: new Date().toISOString(),
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
