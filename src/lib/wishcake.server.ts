/* Wunschtorten: sofort bezahlt, dann Zusage, Absage oder neuer Preis.
 *
 *  - Kasse: Der Kunde zahlt den Richtpreis (pricing.ts cakePrice).
 *  - Absage der Konditorei: alles zurück.
 *  - Zusage zum gleichen oder niedrigeren Preis: Differenz zurück, die
 *    Auszahlung wird geplant (wie bei allen Anbietern, AGB § 21).
 *  - Höherer Preis: Status "quoted". Der Kunde bestätigt und zahlt die
 *    Differenz nach (eigene Stripe-Zahlung), oder lehnt ab und bekommt alles
 *    zurück.
 * Nur auf dem Server, mit dem Dienstschlüssel. */
import { adminClient } from "./supabase.server";
import { createStripeClient, getStripeErrorMessage } from "./stripe.server";
import { stripeEnv } from "./money.server";
import { notify } from "./notify.server";
import type { SweetRequestRow } from "./database.types";

type Db = ReturnType<typeof adminClient>;
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const day = (d: string) => d.split("-").reverse().join(".");

async function piOf(session: string | null | undefined, env: "sandbox" | "live"): Promise<string | null> {
  const id = String(session || "").split(":")[0];
  if (!id) return null;
  const s = await createStripeClient(env).checkout.sessions.retrieve(id);
  return typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
}

/** Teil oder Rest einer Wunschtorte erstatten. Zuerst aus der ersten
 *  Zahlung, was darüber hinausgeht aus der Nachzahlung. */
export async function refundSweet(id: number, cents: number, reason: string): Promise<{ ok: true; cents: number } | { error: string }> {
  const db = adminClient();
  const { data: r } = await db.from("sweet_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Anfrage nicht gefunden" };
  const paid = r.paid_cents ?? 0;
  const extra = r.extra_cents ?? 0;
  const refunded = r.refunded_cents ?? 0;
  const amount = Math.min(paid - refunded, Math.max(0, Math.round(cents)));
  if (amount <= 0) return { ok: true, cents: 0 };
  const firstLeft = Math.max(0, paid - extra - refunded);
  const fromFirst = Math.min(amount, firstLeft);
  const fromExtra = amount - fromFirst;
  const env = stripeEnv();
  try {
    const stripe = createStripeClient(env);
    if (fromFirst > 0) {
      const pi = await piOf(r.stripe_session_id, env);
      if (!pi) return { error: "Keine Zahlung zu dieser Torte" };
      await stripe.refunds.create(
        { payment_intent: pi, amount: fromFirst, metadata: { sweet_request_id: String(r.id) } },
        { idempotencyKey: `sweet-refund-${r.id}-${refunded}-${fromFirst}` },
      );
    }
    if (fromExtra > 0) {
      const pi = await piOf(r.extra_session_id, env);
      if (!pi) return { error: "Keine Nachzahlung zu dieser Torte" };
      await stripe.refunds.create(
        { payment_intent: pi, amount: fromExtra, metadata: { sweet_request_id: String(r.id), part: "nachzahlung" } },
        { idempotencyKey: `sweet-refund-x-${r.id}-${refunded}-${fromExtra}` },
      );
    }
  } catch (e) {
    return { error: getStripeErrorMessage(e) };
  }
  await db.from("sweet_requests").update({ refunded_cents: refunded + amount }).eq("id", r.id);
  /* Storno- bzw. Korrekturbeleg und Abrechnung mit der Konditorei */
  {
    const { data: po } = await db.from("payouts").select("id").eq("sweet_request_id", r.id).maybeSingle();
    const { erstattungVerbuchen } = await import("./belege.server");
    await erstattungVerbuchen({ subOrderId: r.sub_order_id ?? null, cents: amount, grund: reason, ref: `sweet:${r.id}:${refunded}`, payoutId: po?.id ?? null }).catch((e) =>
      console.error("beleg erstattung", e),
    );
  }
  await notify(r.customer, "Erstattung deiner Torten-Bestellung", [
    `Wir haben ${euro(amount)} erstattet (${reason}).`,
    "Das Geld geht auf das Zahlungsmittel zurück, mit dem du bezahlt hast. Je nach Bank dauert die Gutschrift einige Tage.",
  ]).catch(() => false);
  return { ok: true, cents: amount };
}

/** Auszahlung an die Konditorei planen: gleiche Regeln wie bei allen
 *  Anbietern (7 Tage nach dem Liefertag, Einbehalt bei den ersten 5). */
export async function planWishPayout(db: Db, r: SweetRequestRow): Promise<void> {
  if (!r.baker_owner) return;
  const gross = r.price_cents;
  if (gross <= 0) return;
  const { loadFeeRules } = await import("./fees.server");
  const { pickRate } = await import("@/showly/feeRules");
  const { FEE_RATE } = await import("@/showly/pricing");
  const { orderPayoutDay } = await import("@/showly/policies");
  const { reserveFor } = await import("@/showly/cloudRules");
  /* Startphase: in den ersten drei Monaten keine Provision (AGB § 21 Abs. 1) */
  const { inStartPhase } = await import("@/showly/feeRules");
  const { data: prov } = r.baker_ref
    ? await db.from("providers").select("created_at").eq("id", r.baker_ref).maybeSingle()
    : { data: null };
  const rate = inStartPhase(prov?.created_at)
    ? 0
    : pickRate(await loadFeeRules(db), { kind: "baker", providerId: r.baker_ref }, FEE_RATE);
  const fee = Math.round(gross * rate);
  const { provisionFelder } = await import("@/showly/cloudRules");
  const pf = provisionFelder(gross, fee);
  const net = pf.net_cents;
  const when = orderPayoutDay({ cakeDays: [r.day], orderDay: r.day });
  const { count } = await db.from("payouts").select("id", { count: "exact", head: true }).eq("owner", r.baker_owner);
  await db.from("payouts").upsert(
    {
      sweet_request_id: r.id,
      owner: r.baker_owner,
      kind: "baker",
      booking_id: null,
      artist_id: null,
      gross_cents: gross,
      fee_cents: fee,
      ...pf,
      event_day: when.event_day,
      payout_on: when.payout_on,
      ...reserveFor(when.event_day, net, count || 0),
    },
    { onConflict: "sweet_request_id" },
  );
}

/** Antwort der Konditorei auf eine bezahlte Wunschtorte */
export async function answerPaidWish(
  r: SweetRequestRow,
  accept: boolean,
  priceCents: number,
  note: string,
): Promise<{ ok: true; status: string } | { error: string }> {
  const db = adminClient();
  const paid = (r.paid_cents ?? 0) - (r.refunded_cents ?? 0);
  const { wishOutcome } = await import("@/showly/policies");
  const o = wishOutcome({ paidCents: paid, accept, priceCents });
  if (o.status === "declined") {
    const ref = await refundSweet(r.id, paid, "Die Konditorei hat abgesagt");
    if ("error" in ref) return ref;
    await db.from("sweet_requests").update({ status: "declined" }).eq("id", r.id);
    await notify(r.customer, "Deine Torten-Bestellung wurde abgesagt", [
      `Für den ${day(r.day)} hat es leider nicht geklappt. Du bekommst den ganzen Betrag zurück.`,
    ]).catch(() => false);
    return { ok: true, status: "declined" };
  }
  const price = o.priceCents;
  if (o.status === "confirmed") {
    if (o.refundCents > 0) {
      const ref = await refundSweet(r.id, o.refundCents, "Endpreis niedriger als der Richtpreis");
      if ("error" in ref) return ref;
    }
    const { data: next } = await db
      .from("sweet_requests")
      .update({ status: "confirmed", price_cents: price, quote_cents: null, quote_note: null })
      .eq("id", r.id)
      .select("*")
      .single();
    if (next) await planWishPayout(db, next as SweetRequestRow);
    await notify(r.customer, "Deine Torte ist zugesagt", [
      `Für den ${day(r.day)} ist deine Torte bestätigt. Endpreis: ${euro(price)}.${price < paid ? ` ${euro(paid - price)} bekommst du zurück.` : ""}`,
    ]).catch(() => false);
    return { ok: true, status: "confirmed" };
  }
  /* Höherer Preis: der Kunde muss bestätigen und nachzahlen */
  await db
    .from("sweet_requests")
    .update({ status: "quoted", quote_cents: price, quote_note: note.slice(0, 500) || null })
    .eq("id", r.id);
  await notify(r.customer, "Neuer Preis für deine Torte – bitte bestätigen", [
    `Die Konditorei kann deine Torte für den ${day(r.day)} machen, braucht dafür aber ${euro(price)} statt ${euro(paid)}.`,
    note ? `Begründung: „${note.slice(0, 300)}“` : "",
    `Bestätige den Preis in deinem Konto unter „Anfragen“ und zahle ${euro(price - paid)} nach. Möchtest du nicht, lehnst du dort ab und bekommst alles zurück.`,
  ].filter(Boolean)).catch(() => false);
  return { ok: true, status: "quoted" };
}

/** Nachzahlung verbuchen (aus der Rückkehr von Stripe oder dem Webhook).
 *  Doppelte Aufrufe ändern nichts. */
export async function settleQuotePayment(sessionId: string, env: "sandbox" | "live" = stripeEnv()): Promise<{ ok: true } | { error: string }> {
  const db = adminClient();
  const s = await createStripeClient(env).checkout.sessions.retrieve(sessionId);
  if (s.payment_status !== "paid" || s.metadata?.["kind"] !== "torte-nachzahlung") return { error: "Zahlung nicht bestätigt" };
  const id = Number(s.metadata?.["sweet_request_id"]);
  const { data: r } = await db.from("sweet_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Anfrage nicht gefunden" };
  if (r.extra_session_id === sessionId) return { ok: true };
  if (r.status !== "quoted" || !r.quote_cents) return { error: "Kein offener neuer Preis" };
  const paidNow = s.amount_total ?? 0;
  const due = r.quote_cents - ((r.paid_cents ?? 0) - (r.refunded_cents ?? 0));
  if (paidNow !== due) return { error: "Betrag passt nicht" };
  const { data: next } = await db
    .from("sweet_requests")
    .update({
      status: "confirmed",
      price_cents: r.quote_cents,
      paid_cents: (r.paid_cents ?? 0) + paidNow,
      extra_cents: (r.extra_cents ?? 0) + paidNow,
      extra_session_id: sessionId,
      quote_cents: null,
    })
    .eq("id", r.id)
    .eq("status", "quoted")
    .select("*")
    .maybeSingle();
  if (next) {
    await planWishPayout(db, next as SweetRequestRow);
    const { belegNachzahlung } = await import("./belege.server");
    await belegNachzahlung(r.id, paidNow, sessionId).catch((e) => console.error("beleg nachzahlung", e));
    await notify(r.baker_owner, "Kunde hat den neuen Preis bestätigt", [
      `Die Torte für den ${day(r.day)} ist jetzt fest gebucht, Endpreis ${euro(r.quote_cents)}.`,
    ]).catch(() => false);
  }
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * Anfrage vor dem Bezahlen: Der Kunde beschreibt seine Wunschtorte, die
 * Konditorei schickt ein Angebot (Status "quoted", noch nichts bezahlt).
 * Das Angebot legt der Kunde in den Warenkorb und bezahlt es an der Kasse.
 * ------------------------------------------------------------------------ */

export type OfferLine = { offerId?: number | undefined; sweetId: number; dateISO: string };

/** Angebotspreise für die Angebote im Warenkorb, nur eigene, offene und
 *  noch unbezahlte. Fehler, wenn eines nicht (mehr) gilt. */
export async function offerPrices(
  db: Db,
  uid: string | null,
  lines: OfferLine[],
): Promise<{ ok: Map<number, { cents: number; qty: number; row: SweetRequestRow }> } | { error: string }> {
  const ids = [...new Set(lines.map((l) => l.offerId).filter((x): x is number => !!x))];
  const out = new Map<number, { cents: number; qty: number; row: SweetRequestRow }>();
  if (!ids.length) return { ok: out };
  if (!uid) return { error: "Bitte melde dich an, um ein Angebot zu bezahlen." };
  const { data: rows } = await db.from("sweet_requests").select("*").in("id", ids);
  for (const id of ids) {
    const r = (rows || []).find((x) => x.id === id) as SweetRequestRow | undefined;
    const line = lines.find((l) => l.offerId === id)!;
    if (!r || r.customer !== uid || r.status !== "quoted" || !r.quote_cents || (r.paid_cents ?? 0) > 0)
      return { error: "Dieses Angebot gilt nicht mehr. Bitte schau unter „Meine Anfragen“ nach." };
    if (r.sweet_ref !== line.sweetId || r.day !== line.dateISO) return { error: "Das Angebot passt nicht zum Warenkorb." };
    out.set(id, { cents: r.quote_cents, qty: r.qty, row: r });
  }
  return { ok: out };
}

/** Bezahltes Angebot verbuchen: aus der Anfrage wird eine feste Bestellung */
export async function bookPaidOffer(
  db: Db,
  r: SweetRequestRow,
  p: { sessionId: string | null; cents: number; subOrderId: number | null; customerName: string | null },
): Promise<boolean> {
  const { data: next } = await db
    .from("sweet_requests")
    .update({
      status: "booked",
      direct: true,
      price_cents: p.cents,
      paid_cents: p.cents,
      stripe_session_id: p.sessionId,
      sub_order_id: p.subOrderId,
      customer_name: p.customerName,
      quote_cents: null,
    })
    .eq("id", r.id)
    .eq("status", "quoted")
    .select("*")
    .maybeSingle();
  if (!next) return false;
  await notify(r.baker_owner, "Dein Angebot wurde bezahlt", [
    `Die Torte für den ${day(r.day)} ist fest gebucht (${euro(p.cents)}). Alle Angaben findest du in deinem Eingang.`,
  ]).catch(() => false);
  return true;
}

/** Echte Namen in einem Torten-Verlauf: Anzeigename und Firma der
 *  Konditorei, Name und Firma aus den Steuerdaten, Kontoname beider Seiten.
 *  Damit blockt der Chat-Filter Namen, über die man sich außerhalb von
 *  Showly finden könnte (AGB § 20 Abs. 4). */
export async function namesInSweetThread(db: Db, r: Pick<SweetRequestRow, "baker_ref" | "baker_owner" | "customer">): Promise<string[]> {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (v && typeof v === "object") for (const x of Object.values(v as Record<string, unknown>)) if (typeof x === "string" && x.trim()) out.push(x.trim());
  };
  const { data: p } = await db.from("providers").select("data").eq("id", r.baker_ref).maybeSingle();
  const d = (p?.data || {}) as Record<string, unknown>;
  add(d["name"]);
  add(d["company"]);
  add(d["owner_name"]);
  const ids = [r.baker_owner, r.customer].filter((x): x is string => !!x);
  if (ids.length) {
    const { data: profs } = await db.from("profiles").select("display_name").in("id", ids);
    for (const x of profs || []) add(x.display_name);
    const { data: anb } = await db.from("anbieter").select("name, firma").in("id", ids);
    for (const x of anb || []) {
      add(x.name);
      add(x.firma);
    }
  }
  return [...new Set(out)];
}
