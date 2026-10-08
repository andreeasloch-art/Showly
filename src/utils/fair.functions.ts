/* Faire Regeln über die Datenbank (showly/policies.ts):
 *  - Künstlerprofil speichern (alle Felder, Stornostufe, Springer-Liste)
 *  - einmal kostenlos umbuchen
 *  - Auszahlung schneller gegen Gebühr
 *  - Reklamation mit Nachweisen, Stellungnahme, Einigung per Klick,
 *    Entscheidung durch das Team
 *  - Übergabeprotokoll und Schadenskatalog beim Verleih
 *  - Bewertungen: verifiziert, Teilnoten, Antwort, doppelt verdeckt
 * Der Browser schickt nur, was passieren soll; erlaubt ist, was der Server
 * nach den Regeln prüft. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import type { ComplaintRow, HandoverRow } from "@/lib/database.types";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^\d{2}:\d{2}$/;
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const dateDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

async function contactIn(...texts: string[]): Promise<boolean> {
  const { findContact } = await import("@/showly/contactGuard");
  return texts.some((t) => t && findContact(t).length > 0);
}

async function ownsArtist(db: ReturnType<typeof adminClient>, artistId: number | null, uid: string) {
  if (!artistId) return false;
  const { data } = await db.from("artists").select("owner").eq("id", artistId).maybeSingle();
  return data?.owner === uid;
}

/* ---------------------------------------------------------------------------
 * Künstlerprofil speichern (Profile aus der Datenbank)
 * ------------------------------------------------------------------------ */
export interface ProfilePatch {
  artistId: number;
  name: string;
  desc: string;
  loc: string;
  tags: string[];
  langs: string[];
  includes: string[];
  specs: string[];
  price: number;
  instantBook: boolean;
  cancelTier: string;
  standby: boolean;
}

const list = (v: unknown, n: number, max: number) =>
  (Array.isArray(v) ? v : []).map((x) => s(x, max)).filter(Boolean).slice(0, n);

export const saveArtistProfileCloud = createServerFn({ method: "POST" })
  .inputValidator((d: ProfilePatch) => ({
    artistId: int(d.artistId, 0, 1e9),
    name: s(d.name, 80),
    desc: s(d.desc, 4000),
    loc: s(d.loc, 80),
    tags: list(d.tags, 20, 40),
    langs: list(d.langs, 10, 30),
    includes: list(d.includes, 20, 120),
    specs: list(d.specs, 40, 40),
    price: int(d.price, 0, 100000),
    instantBook: d.instantBook !== false,
    cancelTier: s(d.cancelTier, 10),
    standby: d.standby === true,
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: a } = await db.from("artists").select("owner, packages").eq("id", data.artistId).maybeSingle();
    if (!a || a.owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!data.name) return { error: "Bitte gib einen Namen an" };
    if (await contactIn(data.name, data.desc, ...data.tags, ...data.includes, ...data.specs))
      return { error: "Bitte keine Kontaktdaten in öffentlichen Texten" };
    const planner = Array.isArray(a.packages) && a.packages.length > 0;
    if (!planner && (data.price < 10 || data.price > 2000)) return { error: "Preis zwischen 10 und 2.000 €" };
    const { tierOf } = await import("@/showly/policies");
    /* Übersetzungen bleiben, bis sie neu gepflegt werden: Deutsch ist führend */
    const { error } = await db
      .from("artists")
      .update({
        name: { de: data.name, en: data.name },
        descr: { de: data.desc, en: data.desc },
        loc: { de: data.loc, en: data.loc },
        tags: { de: data.tags, en: data.tags },
        langs: { de: data.langs, en: data.langs },
        includes: { de: data.includes, en: data.includes },
        specs: { de: data.specs, en: data.specs },
        ...(planner ? {} : { price_cents: data.price * 100 }),
        instant_book: data.instantBook,
        cancel_tier: tierOf(data.cancelTier),
        standby: data.standby,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.artistId);
    return error ? { error: "Speichern hat nicht geklappt" } : { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Einmal kostenlos umbuchen
 * ------------------------------------------------------------------------ */
export const rebookBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { bookingId: number; day: string; slot: string }) => {
    if (!DAY_RE.test(String(d.day)) || !SLOT_RE.test(String(d.slot))) throw new Error("Ungültiger Termin");
    return { bookingId: int(d.bookingId, 0, 1e12), day: String(d.day), slot: String(d.slot) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: b } = await db.from("bookings").select("*").eq("id", data.bookingId).maybeSingle();
    if (!b || b.customer !== ctx.user.id) return { error: "Keine Berechtigung" };
    const { canRebook, rebookTargetOk } = await import("@/showly/policies");
    const { berlinStart, policyOf } = await import("@/showly/cloudRules");
    const today = new Date().toISOString().slice(0, 10);
    if (!canRebook(b.policy ? policyOf(b) : null, b, berlinStart(b.day, b.slot), Date.now()))
      return { error: "Umbuchen geht einmal und bis 48 Stunden vor Beginn." };
    if (!rebookTargetOk(b.day, data.day, today)) return { error: "Der neue Termin muss in der Zukunft und höchstens 6 Monate nach dem alten liegen." };
    if (b.artist_id) {
      const { claimSlots, claimMessage } = await import("@/lib/slots.server");
      const r = await claimSlots([{ artist_id: b.artist_id, day: data.day, slot: data.slot, hours: b.hours, booking_id: b.id }], "booking");
      if (!r.ok) return { error: claimMessage(r.reason, "de", { day: data.day, slot: data.slot }) };
      await db.from("slot_claims").delete().eq("booking_id", b.id).eq("day", b.day);
      if (b.slot) await db.from("availability").delete().eq("artist_id", b.artist_id).eq("day", b.day).eq("slot", b.slot);
      await db.from("availability").upsert({ artist_id: b.artist_id, day: data.day, slot: data.slot, blocked: true });
    }
    const now = new Date().toISOString();
    const { error } = await db
      .from("bookings")
      .update({ day: data.day, slot: data.slot, rebooked_at: now, rebooked_from: b.day, checkin_alert_at: null })
      .eq("id", b.id);
    if (error) return { error: "Umbuchen hat nicht geklappt" };
    const { payoutDate } = await import("@/showly/booking");
    await db.from("payouts").update({ payout_on: payoutDate(data.day), speed: "standard", express_fee_cents: 0, net_cents: b.payout_cents }).eq("booking_id", b.id).eq("status", "scheduled");
    const { notify, ownerOfArtist } = await import("@/lib/notify.server");
    await notify(await ownerOfArtist(b.artist_id), "Eine Buchung wurde umgebucht", [
      `Die Buchung vom ${dateDe(b.day)} wurde auf den ${dateDe(data.day)}, ${data.slot} Uhr verlegt (einmalige kostenlose Umbuchung). Der neue Termin ist in deinem Kalender eingetragen.`,
    ], { path: "/portal" }).catch(() => false);
    return { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Auszahlung schneller gegen Gebühr
 * ------------------------------------------------------------------------ */
export const choosePayoutSpeed = createServerFn({ method: "POST" })
  .inputValidator((d: { payoutId: number; speed: string }) => ({ payoutId: int(d.payoutId, 0, 1e12), speed: String(d.speed) }))
  .handler(async ({ data }): Promise<{ ok: true; payoutOn: string; feeCents: number; netCents: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: p } = await db.from("payouts").select("*").eq("id", data.payoutId).maybeSingle();
    if (!p || !(await ownsArtist(db, p.artist_id, ctx.user.id))) return { error: "Keine Berechtigung" };
    if (p.status !== "scheduled" || p.stripe_transfer_id) return { error: "Diese Auszahlung läuft schon" };
    if (p.frozen) return { error: "Bei einer offenen Reklamation geht keine schnellere Auszahlung" };
    const { data: pen } = await db.from("penalties").select("status").eq("booking_id", p.booking_id).maybeSingle();
    if (pen && pen.status !== "waived") return { error: "Bei einer offenen Meldung geht keine schnellere Auszahlung" };
    const { data: b } = await db.from("bookings").select("day").eq("id", p.booking_id).maybeSingle();
    if (!b) return { error: "Buchung nicht gefunden" };
    const { payoutFor, speedOf } = await import("@/showly/policies");
    const base = p.net_cents + (p.express_fee_cents ?? 0);
    const next = payoutFor(b.day, base, speedOf(data.speed));
    const { error } = await db
      .from("payouts")
      .update({ payout_on: next.payout_on, express_fee_cents: next.express_fee_cents, net_cents: next.net_cents, speed: next.speed })
      .eq("id", p.id)
      .eq("status", "scheduled");
    if (error) return { error: "Speichern hat nicht geklappt" };
    return { ok: true, payoutOn: next.payout_on, feeCents: next.express_fee_cents, netCents: next.net_cents };
  });

/* ---------------------------------------------------------------------------
 * Nachweise hochladen (Fotos/Videos), privat
 * ------------------------------------------------------------------------ */
type Ref = { kind: "booking" | "order" | "sweet"; id: number };
const EVIDENCE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

async function partyOf(db: ReturnType<typeof adminClient>, ref: Ref, uid: string) {
  if (ref.kind === "booking") {
    const { data: b } = await db.from("bookings").select("customer, artist_id").eq("id", ref.id).maybeSingle();
    if (!b) return null;
    if (b.customer === uid) return "customer" as const;
    return (await ownsArtist(db, b.artist_id, uid)) ? ("provider" as const) : null;
  }
  if (ref.kind === "order") {
    const { data: o } = await db.from("shop_orders").select("customer, provider_owners").eq("id", ref.id).maybeSingle();
    if (!o) return null;
    if (o.customer === uid) return "customer" as const;
    return (o.provider_owners || []).includes(uid) ? ("provider" as const) : null;
  }
  const { data: r } = await db.from("sweet_requests").select("customer, baker_owner").eq("id", ref.id).maybeSingle();
  if (!r) return null;
  return r.customer === uid ? ("customer" as const) : r.baker_owner === uid ? ("provider" as const) : null;
}

const refKey = (r: Ref) => `${r.kind}-${r.id}`;
const cleanRef = (r: Ref): Ref => ({
  kind: r?.kind === "order" ? "order" : r?.kind === "sweet" ? "sweet" : "booking",
  id: int(r?.id, 0, 1e12),
});

export const evidenceUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: Ref; mime: string; bytes: number }) => ({ ref: cleanRef(d.ref), mime: String(d.mime || ""), bytes: int(d.bytes, 0, 1e9) }))
  .handler(async ({ data }): Promise<{ path: string; token: string } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("upload", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    if (!(await partyOf(db, data.ref, ctx.user.id))) return { error: "Keine Berechtigung" };
    const ext = EVIDENCE_MIME[data.mime];
    if (!ext) return { error: "Erlaubt sind Fotos (JPEG, PNG, WebP) und Videos (MP4, MOV, WebM)." };
    if (data.bytes < 1 || data.bytes > 50 * 1024 * 1024) return { error: "Die Datei ist zu groß (höchstens 50 MB)." };
    const path = `${refKey(data.ref)}/${crypto.randomUUID()}.${ext}`;
    const { data: up, error } = await db.storage.from("evidence").createSignedUploadUrl(path);
    if (error || !up) return { error: "Hochladen ist gerade nicht möglich" };
    return { path, token: up.token };
  });

/** Nur Pfade, die zu dieser Buchung/Bestellung gehören; Fotos ohne Metadaten */
async function checkEvidence(db: ReturnType<typeof adminClient>, ref: Ref, paths: unknown): Promise<string[]> {
  const prefix = refKey(ref) + "/";
  const ok = (Array.isArray(paths) ? paths : [])
    .map((p) => String(p))
    .filter((p) => p.startsWith(prefix) && !p.includes("..") && /^[\w-]+\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/.test(p))
    .slice(0, 12);
  const { stripImageMetadata } = await import("@/showly/imageSafety");
  for (const p of ok) {
    if (!/\.(jpg|png|webp)$/.test(p)) continue;
    const { data: blob } = await db.storage.from("evidence").download(p);
    if (!blob) continue;
    const clean = stripImageMetadata(new Uint8Array(await blob.arrayBuffer()));
    if (clean.changed) await db.storage.from("evidence").upload(p, clean.bytes, { upsert: true });
  }
  return ok;
}

/** Signierte Adressen zum Ansehen der Nachweise (für Beteiligte und Team) */
export const evidenceUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: Ref; paths: string[] }) => ({ ref: cleanRef(d.ref), paths: (Array.isArray(d.paths) ? d.paths : []).map(String).slice(0, 30) }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const ctx = await me();
    if (!ctx) return {};
    const db = adminClient();
    if (ctx.profile?.role !== "admin" && !(await partyOf(db, data.ref, ctx.user.id))) return {};
    const own = data.paths.filter((p) => p.startsWith(refKey(data.ref) + "/"));
    if (!own.length) return {};
    const { data: urls } = await db.storage.from("evidence").createSignedUrls(own, 3600);
    return Object.fromEntries((urls || []).filter((u) => u.signedUrl && u.path).map((u) => [u.path!, u.signedUrl as string]));
  });

/* ---------------------------------------------------------------------------
 * Reklamation
 * ------------------------------------------------------------------------ */
export type ComplaintInfo = ComplaintRow & { role: "customer" | "provider"; title: string; guide: string };

async function payoutFreeze(db: ReturnType<typeof adminClient>, bookingId: number | null, frozen: boolean) {
  if (bookingId) await db.from("payouts").update({ frozen }).eq("booking_id", bookingId).neq("status", "paid");
}

/** Erstattung nach Einigung oder Entscheidung; Auszahlung anteilig kürzen */
async function settle(db: ReturnType<typeof adminClient>, c: ComplaintRow, cents: number, reason: string) {
  if (cents > 0 && c.booking_id) {
    const { refundBooking } = await import("@/lib/money.server");
    await refundBooking(c.booking_id, { cents, reason }).catch(() => null);
    const { data: b } = await db.from("bookings").select("amount_cents, payout_cents").eq("id", c.booking_id).maybeSingle();
    const { data: p } = await db.from("payouts").select("id, net_cents").eq("booking_id", c.booking_id).neq("status", "paid").maybeSingle();
    if (b && p && b.amount_cents > 0)
      await db
        .from("payouts")
        .update({ net_cents: Math.max(0, p.net_cents - Math.round((cents * b.payout_cents) / b.amount_cents)) })
        .eq("id", p.id);
  } else if (cents > 0 && c.shop_order_id && c.category === "damage") {
    /* Einspruch gegen Schaden: einbehaltene Kaution zurück */
    const { refundDeposit } = await import("@/lib/money.server");
    await refundDeposit(c.shop_order_id, cents).catch(() => null);
  } else if (cents > 0) {
    /* Shop und Torten: Erstattung führt das Team in Stripe aus */
    await db.from("support_tickets").insert({
      profile: c.customer,
      email: "support@showly.eu",
      name: "Reklamation",
      topic: "payment",
      body: `Reklamation ${c.id}: bitte ${euro(cents)} erstatten (${c.shop_order_id ? `Bestellung ${c.shop_order_id}` : `Torte ${c.sweet_request_id}`}).`,
    });
  }
  await payoutFreeze(db, c.booking_id, false);
}

export const createComplaint = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { ref: Ref; category: string; body: string; evidence: string[]; lateMin?: number; playedMin?: number }) => ({
      ref: cleanRef(d.ref),
      category: String(d.category),
      body: s(d.body, 4000),
      evidence: Array.isArray(d.evidence) ? d.evidence.map(String).slice(0, 12) : [],
      lateMin: int(d.lateMin, 0, 600),
      playedMin: int(d.playedMin, 0, 1440),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true; id: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { COMPLAINT_CATS, COMPLAINT_LABEL, complaintOpen, evidenceRequired, guideline, STATEMENT_HOURS, DECIDE_DAYS } = await import("@/showly/policies");
    if (!(COMPLAINT_CATS as readonly string[]).includes(data.category)) return { error: "Bitte wähle einen Grund" };
    const cat = data.category as (typeof COMPLAINT_CATS)[number];
    if (data.body.length < 10) return { error: "Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen)" };
    if ((await partyOf(db, data.ref, ctx.user.id)) !== "customer") return { error: "Reklamieren kann nur, wer gebucht hat" };
    const { berlinStart } = await import("@/showly/cloudRules");
    let end = 0;
    let amount = 0;
    let owner: string | null = null;
    let bookedMin = 0;
    if (data.ref.kind === "booking") {
      const { data: b } = await db.from("bookings").select("*").eq("id", data.ref.id).maybeSingle();
      if (!b || !["confirmed", "completed", "pending"].includes(b.status)) return { error: "Diese Buchung kann nicht reklamiert werden" };
      end = berlinStart(b.day, b.slot) + (b.hours || 2) * 3600000;
      amount = b.amount_cents - b.refunded_cents;
      bookedMin = (b.hours || 2) * 60;
      const { ownerOfArtist } = await import("@/lib/notify.server");
      owner = await ownerOfArtist(b.artist_id);
    } else if (data.ref.kind === "order") {
      const { data: o } = await db.from("shop_orders").select("*").eq("id", data.ref.id).maybeSingle();
      if (!o) return { error: "Bestellung nicht gefunden" };
      const lastRent = (o.items || []).map((i) => i.to || i.from || "").filter(Boolean).sort().pop();
      /* Miete: 48 h nach Mietende; Kauf: 48 h nach Erhalt (spätestens 14 Tage nach Bestellung) */
      end = lastRent ? berlinStart(lastRent, "23:59") : new Date(o.created_at).getTime() + 12 * 86400000;
      amount = o.total_cents - (o.deposit_cents ?? 0);
      owner = (o.provider_owners || [])[0] ?? null;
    } else {
      const { data: r } = await db.from("sweet_requests").select("*").eq("id", data.ref.id).maybeSingle();
      if (!r || !["confirmed", "booked"].includes(r.status)) return { error: "Diese Bestellung kann nicht reklamiert werden" };
      end = berlinStart(r.day, "23:59");
      amount = r.price_cents;
      owner = r.baker_owner;
    }
    if (!complaintOpen(end, Date.now())) return { error: "Reklamieren geht bis 48 Stunden nach dem Termin. Deine gesetzlichen Rechte bleiben davon unberührt; schreib uns dann über die Hilfe." };
    const evidence = await checkEvidence(db, data.ref, data.evidence);
    if (evidenceRequired(cat) && !evidence.length) return { error: "Bitte hänge Fotos oder ein Video an (bei Torten und Mietartikeln Pflicht)." };
    if (await contactIn(data.body)) return { error: "Bitte keine Kontaktdaten im Text" };
    const now = Date.now();
    const { data: ins, error } = await db
      .from("complaints")
      .insert({
        ...(data.ref.kind === "booking" ? { booking_id: data.ref.id } : data.ref.kind === "order" ? { shop_order_id: data.ref.id } : { sweet_request_id: data.ref.id }),
        customer: ctx.user.id,
        provider_owner: owner,
        category: cat,
        body: data.body,
        evidence,
        amount_cents: amount,
        statement_due: new Date(now + STATEMENT_HOURS * 3600000).toISOString(),
        decide_by: new Date(now + DECIDE_DAYS * 86400000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !ins) return { error: error?.message.includes("complaints_booking_once") ? "Zu dieser Buchung gibt es schon eine Reklamation" : "Speichern hat nicht geklappt" };
    if (data.ref.kind === "booking") await payoutFreeze(db, data.ref.id, true);
    const g = guideline(cat, { lateMin: data.lateMin, bookedMin, playedMin: data.playedMin });
    const { notify } = await import("@/lib/notify.server");
    await notify(owner, "Reklamation zu deinem Auftrag", [
      `Grund: ${COMPLAINT_LABEL[cat]}. Bitte nimm innerhalb von ${STATEMENT_HOURS} Stunden Stellung; du kannst auch direkt eine Teilerstattung anbieten.`,
      `Richtwert: ${g.text}. Die Auszahlung ist bis zur Klärung angehalten.`,
    ], { path: "/portal" }).catch(() => false);
    return { ok: true, id: ins.id };
  });

/** Stellungnahme, Angebot, Annahme, Weiterleiten ans Team, Zurückziehen */
export const complaintAction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { id: number; op: "statement" | "offer" | "accept" | "escalate" | "withdraw"; text?: string; cents?: number }) => ({
      id: int(d.id, 0, 1e12),
      op: (["statement", "offer", "accept", "escalate", "withdraw"] as const).includes(d.op) ? d.op : "statement",
      text: s(d.text, 2000),
      cents: int(d.cents, 0, 1e8),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: c } = await db.from("complaints").select("*").eq("id", data.id).maybeSingle();
    if (!c) return { error: "Reklamation nicht gefunden" };
    const role = c.customer === ctx.user.id ? "customer" : c.provider_owner === ctx.user.id ? "provider" : null;
    if (!role) return { error: "Keine Berechtigung" };
    if (!["open", "offer", "escalated"].includes(c.status)) return { error: "Die Reklamation ist abgeschlossen" };
    const { notify } = await import("@/lib/notify.server");
    const other = role === "customer" ? c.provider_owner : c.customer;
    const now = new Date().toISOString();

    if (data.op === "statement") {
      if (role !== "provider" || data.text.length < 10) return { error: "Bitte schreib eine kurze Stellungnahme" };
      if (await contactIn(data.text)) return { error: "Bitte keine Kontaktdaten im Text" };
      await db.from("complaints").update({ statement: data.text, statement_at: now }).eq("id", c.id);
      await notify(other, "Stellungnahme zu deiner Reklamation", ["Der Anbieter hat Stellung genommen. Du kannst ein Angebot annehmen, selbst eines machen oder das Showly-Team entscheiden lassen."]).catch(() => false);
      return { ok: true };
    }
    if (data.op === "offer") {
      if (data.cents < 1 || data.cents > c.amount_cents) return { error: `Betrag zwischen 0,01 € und ${euro(c.amount_cents)}` };
      await db
        .from("complaints")
        .update({ status: "offer", offer_cents: data.cents, offer_by: role, ...(role === "provider" && !c.statement_at ? { statement_at: now, statement: data.text || "Teilerstattung angeboten" } : {}) })
        .eq("id", c.id);
      await notify(other, "Angebot zu einer Reklamation", [`Vorschlag: ${euro(data.cents)} Teilerstattung. Mit einem Klick in der App annehmen.`]).catch(() => false);
      return { ok: true };
    }
    if (data.op === "accept") {
      if (c.status !== "offer" || !c.offer_cents || c.offer_by === role) return { error: "Kein Angebot der Gegenseite offen" };
      await db.from("complaints").update({ status: "agreed", refund_cents: c.offer_cents, decided_at: now, decision: "Einigung" }).eq("id", c.id);
      await settle(db, c, c.offer_cents, "Einigung zur Reklamation");
      await notify(other, "Einigung zur Reklamation", [`Das Angebot über ${euro(c.offer_cents)} wurde angenommen. Die Erstattung läuft.`]).catch(() => false);
      return { ok: true };
    }
    if (data.op === "escalate") {
      await db.from("complaints").update({ status: "escalated" }).eq("id", c.id);
      return { ok: true };
    }
    if (role !== "customer") return { error: "Nur der Kunde kann zurückziehen" };
    await db.from("complaints").update({ status: "withdrawn", decided_at: now }).eq("id", c.id);
    await payoutFreeze(db, c.booking_id, false);
    return { ok: true };
  });

/** Eigene Reklamationen, als Kunde und als Anbieter */
export const myComplaints = createServerFn({ method: "POST" }).handler(async (): Promise<ComplaintInfo[]> => {
  const ctx = await me();
  if (!ctx) return [];
  const db = adminClient();
  const uid = ctx.user.id;
  const { data } = await db
    .from("complaints")
    .select("*")
    .or(`customer.eq.${uid},provider_owner.eq.${uid}`)
    .order("created_at", { ascending: false })
    .limit(100);
  const { COMPLAINT_LABEL, guideline } = await import("@/showly/policies");
  return (data || []).map((c) => ({
    ...c,
    role: c.customer === uid ? ("customer" as const) : ("provider" as const),
    title: (COMPLAINT_LABEL as Record<string, string>)[c.category] ?? "Schaden an Mietartikel",
    guide: c.category === "damage" ? "Einspruch gegen Schadensabzug" : guideline(c.category as "late", {}).text,
  }));
});

/** Verwaltung: offene Reklamationen und Entscheidung (höchstens 5 Tage) */
export const adminComplaints = createServerFn({ method: "POST" })
  .inputValidator((d: { op: "list" } | { op: "decide"; id: number; cents: number; decision: string }) => d)
  .handler(async ({ data }): Promise<{ list: (ComplaintRow & { flagged: boolean; title: string })[] } | { error: string }> => {
    try {
      const { requireAdmin } = await import("@/lib/guard.server");
      await requireAdmin();
    } catch {
      return { error: "Keine Berechtigung" };
    }
    const db = adminClient();
    if (data.op === "decide") {
      const id = int(data.id, 0, 1e12);
      const { data: c } = await db.from("complaints").select("*").eq("id", id).maybeSingle();
      if (!c) return { error: "Nicht gefunden" };
      const cents = int(data.cents, 0, c.amount_cents);
      const decision = s(data.decision, 2000);
      if (decision.length < 5) return { error: "Bitte die Entscheidung kurz begründen" };
      await db.from("complaints").update({ status: "decided", refund_cents: cents, decision, decided_at: new Date().toISOString() }).eq("id", id);
      await settle(db, c, cents, "Entscheidung zur Reklamation");
      const { notify } = await import("@/lib/notify.server");
      for (const who of [c.customer, c.provider_owner])
        await notify(who, "Entscheidung zur Reklamation", [`Das Showly-Team hat entschieden: ${cents ? `${euro(cents)} Erstattung` : "keine Erstattung"}. Begründung: ${decision}`, "Die gesetzlichen Rechte bleiben unberührt."]).catch(() => false);
      await db.from("admin_audit").insert({ actor: null, action: "complaint.decide", target: String(id), detail: { cents, decision } });
    }
    const { data: rows } = await db.from("complaints").select("*").order("created_at", { ascending: false }).limit(300);
    const { COMPLAINT_LABEL, frequentComplainer } = await import("@/showly/policies");
    const by = new Map<string, string[]>();
    for (const r of rows || []) by.set(r.customer, [...(by.get(r.customer) || []), r.created_at]);
    return {
      list: (rows || []).map((r) => ({
        ...r,
        flagged: frequentComplainer(by.get(r.customer) || [], Date.now()),
        title: (COMPLAINT_LABEL as Record<string, string>)[r.category] ?? "Schaden an Mietartikel",
      })),
    };
  });

/* ---------------------------------------------------------------------------
 * Verleih: Übergabeprotokoll und Schadenskatalog
 * ------------------------------------------------------------------------ */
export const handoverRecord = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: number; step: "out" | "back"; photos: string[]; note?: string }) => ({
    orderId: int(d.orderId, 0, 1e12),
    step: d.step === "back" ? ("back" as const) : ("out" as const),
    photos: Array.isArray(d.photos) ? d.photos.map(String) : [],
    note: s(d.note, 500),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const ref: Ref = { kind: "order", id: data.orderId };
    if ((await partyOf(db, ref, ctx.user.id)) !== "provider") return { error: "Keine Berechtigung" };
    const photos = await checkEvidence(db, ref, data.photos);
    if (!photos.length) return { error: "Bitte mindestens ein Foto vom Zustand anhängen" };
    const { data: o } = await db.from("shop_orders").select("handover, status, returned_at, customer").eq("id", data.orderId).maybeSingle();
    if (!o) return { error: "Bestellung nicht gefunden" };
    const now = new Date().toISOString();
    const handover: HandoverRow = { ...(o.handover || {}), [data.step]: { photos, at: now, by: ctx.user.id, ...(data.note ? { note: data.note } : {}) } };
    await db
      .from("shop_orders")
      .update({
        handover,
        ...(data.step === "out" && o.status === "paid" ? { status: "shipped" as const } : {}),
        ...(data.step === "back" && !o.returned_at ? { status: "returned" as const, returned_at: now } : {}),
      })
      .eq("id", data.orderId);
    const { notify } = await import("@/lib/notify.server");
    await notify(o.customer, data.step === "out" ? "Übergabeprotokoll: bitte bestätigen" : "Rückgabe protokolliert", [
      data.step === "out"
        ? "Der Anbieter hat den Zustand bei der Ausgabe mit Fotos festgehalten. Bitte prüfe sie in der App und bestätige sie."
        : "Der Anbieter hat die Rückgabe mit Fotos festgehalten. Meldet er innerhalb von 72 Stunden keinen Schaden, bekommst du die Kaution automatisch zurück.",
    ], { path: "/dashboard" }).catch(() => false);
    return { ok: true };
  });

export const handoverConfirm = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: number; step: "out" | "back" }) => ({ orderId: int(d.orderId, 0, 1e12), step: d.step === "back" ? ("back" as const) : ("out" as const) }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: o } = await db.from("shop_orders").select("customer, handover").eq("id", data.orderId).maybeSingle();
    if (!o || o.customer !== ctx.user.id) return { error: "Keine Berechtigung" };
    const step = o.handover?.[data.step];
    if (!step) return { error: "Noch kein Protokoll" };
    await db
      .from("shop_orders")
      .update({ handover: { ...o.handover, [data.step]: { ...step, confirmed_at: new Date().toISOString() } } })
      .eq("id", data.orderId);
    return { ok: true };
  });

/** Schaden nach Katalog melden (bis 72 h nach Rückgabe); Rest der Kaution sofort zurück */
export const reportDamage = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: number; items: { key: string; qty?: number }[]; valueCents?: number; note?: string }) => ({
    orderId: int(d.orderId, 0, 1e12),
    items: (Array.isArray(d.items) ? d.items : []).slice(0, 10).map((i) => ({ key: s(i?.key, 20), qty: int(i?.qty ?? 1, 1, 20) })),
    valueCents: int(d.valueCents, 0, 1e8),
    note: s(d.note, 1000),
  }))
  .handler(async ({ data }): Promise<{ ok: true; keptCents: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: o } = await db.from("shop_orders").select("*").eq("id", data.orderId).maybeSingle();
    if (!o || !(o.provider_owners || []).includes(ctx.user.id)) return { error: "Keine Berechtigung" };
    const { DAMAGE_REPORT_HOURS, damageCents } = await import("@/showly/policies");
    if (!o.returned_at) return { error: "Bitte zuerst die Rückgabe mit Fotos protokollieren" };
    if (o.damage_reported_at || o.deposit_released_at) return { error: "Die Kaution ist schon abgerechnet" };
    if (Date.now() > new Date(o.returned_at).getTime() + DAMAGE_REPORT_HOURS * 3600000)
      return { error: "Die Frist von 72 Stunden ist vorbei; die Kaution ist freigegeben" };
    const dep = (o.deposit_cents ?? 0) - (o.deposit_refunded_cents ?? 0);
    const kept = damageCents(data.items, { carefree: o.carefree === true, valueCents: data.valueCents, depositCents: dep });
    const now = new Date().toISOString();
    await db
      .from("shop_orders")
      .update({ damage: { items: data.items, cents: kept, ...(data.note ? { note: data.note } : {}) }, damage_reported_at: now, deposit_released_at: now })
      .eq("id", o.id);
    const { refundDeposit } = await import("@/lib/money.server");
    if (dep - kept > 0) await refundDeposit(o.id, dep - kept).catch(() => null);
    const { notify } = await import("@/lib/notify.server");
    await notify(o.customer, "Abrechnung deiner Kaution", [
      kept
        ? `Der Anbieter hat einen Schaden nach dem Schadenskatalog gemeldet: ${euro(kept)} werden von der Kaution einbehalten${o.carefree ? " (kleine Schäden sind durch dein Sorglos-Paket abgedeckt)" : ""}. Der Rest kommt zurück.`
        : `Kein Abzug${o.carefree ? " dank Sorglos-Paket" : ""}: Die Kaution kommt vollständig zurück.`,
      kept ? "Bist du nicht einverstanden, kannst du in der App widersprechen. Dann prüft das Showly-Team den Fall anhand der Übergabefotos." : "",
    ].filter(Boolean), { path: "/dashboard" }).catch(() => false);
    return { ok: true, keptCents: kept };
  });

/** Kunde widerspricht dem Schadensabzug: wird zur Reklamation */
export const objectDamage = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: number; text: string }) => ({ orderId: int(d.orderId, 0, 1e12), text: s(d.text, 2000) }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: o } = await db.from("shop_orders").select("*").eq("id", data.orderId).maybeSingle();
    if (!o || o.customer !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!o.damage?.cents) return { error: "Es wurde nichts einbehalten" };
    if (o.damage.objected_at) return { error: "Du hast schon widersprochen" };
    if (data.text.length < 10) return { error: "Bitte begründe kurz, warum du widersprichst" };
    const { STATEMENT_HOURS, DECIDE_DAYS } = await import("@/showly/policies");
    const now = Date.now();
    await db.from("shop_orders").update({ damage: { ...o.damage, objected_at: new Date(now).toISOString() } }).eq("id", o.id);
    await db.from("complaints").insert({
      shop_order_id: o.id,
      customer: ctx.user.id,
      provider_owner: (o.provider_owners || [])[0] ?? null,
      category: "damage",
      body: data.text,
      evidence: [],
      amount_cents: o.damage.cents,
      statement_due: new Date(now + STATEMENT_HOURS * 3600000).toISOString(),
      decide_by: new Date(now + DECIDE_DAYS * 86400000).toISOString(),
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Bewertungen: Antwort des Anbieters, Bewertung des Kunden (verdeckt)
 * ------------------------------------------------------------------------ */
export const replyReview = createServerFn({ method: "POST" })
  .inputValidator((d: { reviewId: number; text: string }) => ({ reviewId: int(d.reviewId, 0, 1e12), text: s(d.text, 2000) }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: r } = await db.from("reviews").select("id, artist_id").eq("id", data.reviewId).maybeSingle();
    if (!r || !(await ownsArtist(db, r.artist_id, ctx.user.id))) return { error: "Keine Berechtigung" };
    if (await contactIn(data.text)) return { error: "Bitte keine Kontaktdaten in der Antwort" };
    await db
      .from("reviews")
      .update({ reply: data.text || null, reply_at: data.text ? new Date().toISOString() : null })
      .eq("id", r.id);
    return { ok: true };
  });

export const reviewGuest = createServerFn({ method: "POST" })
  .inputValidator((d: { bookingId: number; rating: number; text?: string }) => ({
    bookingId: int(d.bookingId, 0, 1e12),
    rating: int(d.rating, 1, 5),
    text: s(d.text, 2000),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: b } = await db.from("bookings").select("id, artist_id, customer, day, status").eq("id", data.bookingId).maybeSingle();
    if (!b || !b.customer || !(await ownsArtist(db, b.artist_id, ctx.user.id))) return { error: "Keine Berechtigung" };
    const { reviewWindow } = await import("@/showly/policies");
    if (!["confirmed", "completed"].includes(b.status) || reviewWindow(b.day, Date.now()) !== "open")
      return { error: "Bewerten geht bis 14 Tage nach einem stattgefundenen Termin" };
    if (await contactIn(data.text)) return { error: "Bitte keine Kontaktdaten im Text" };
    const { data: theirs } = await db.from("reviews").select("id").eq("booking_id", b.id).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await db.from("guest_reviews").upsert(
      { booking_id: b.id, artist_id: b.artist_id!, customer: b.customer, rating: data.rating, body: data.text || null, published_at: theirs ? now : null },
      { onConflict: "booking_id" },
    );
    if (error) return { error: "Speichern hat nicht geklappt" };
    /* Doppelt verdeckt: hat der Kunde schon bewertet, wird jetzt beides sichtbar */
    if (theirs) await db.from("reviews").update({ published_at: now }).eq("id", theirs.id).is("published_at", null);
    return { ok: true };
  });
