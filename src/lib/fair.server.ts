/* Faire Regeln auf dem Server (showly/policies.ts): Ersatz-Vorschläge bei
 * Ausfall, Check-in-Wächter, Kaution nach 72 Stunden freigeben,
 * Reklamationen weiterleiten, verdeckte Bewertungen veröffentlichen.
 * Nur mit Dienstschlüssel. */
import { adminClient } from "./supabase.server";
import { notify, ownerOfArtist } from "./notify.server";
import type { BookingRow } from "./database.types";

type Db = ReturnType<typeof adminClient>;
const dateDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

export interface Replacement {
  id: number;
  name: string;
  price_cents: number;
  rating: number;
  standby: boolean;
}

/** Drei freie Ersatz-Künstler: gleiche Kategorie, gleiche Stadt, am Termin frei */
export async function findReplacements(db: Db, b: Pick<BookingRow, "id" | "artist_id" | "day" | "slot" | "amount_cents">): Promise<Replacement[]> {
  if (!b.artist_id) return [];
  const { pickReplacements } = await import("@/showly/policies");
  const { data: orig } = await db.from("artists").select("id, cat, loc, price_cents").eq("id", b.artist_id).maybeSingle();
  if (!orig) return [];
  const { data: list } = await db
    .from("artists")
    .select("id, cat, loc, name, rating, price_cents, standby, blocked")
    .eq("cat", orig.cat)
    .eq("published", true)
    .neq("id", orig.id)
    .limit(200);
  const ids = (list || []).map((a) => a.id);
  if (!ids.length) return [];
  /* Belegt: Buchung oder Sperre an dem Tag (ganzer Tag oder gleiche Uhrzeit) */
  const [{ data: booked }, { data: blocked }] = await Promise.all([
    db.from("bookings").select("artist_id, slot").in("artist_id", ids).eq("day", b.day).in("status", ["pending", "confirmed", "requested"]),
    db.from("availability").select("artist_id, slot").in("artist_id", ids).eq("day", b.day),
  ]);
  const busy = new Set<number>();
  for (const r of [...(booked || []), ...(blocked || [])])
    if (r.artist_id && (r.slot === "all" || !b.slot || r.slot === b.slot)) busy.add(r.artist_id);
  const city = (orig.loc as { de?: string })?.de || "";
  const picks = pickReplacements(
    { id: orig.id, cat: orig.cat, city, price_cents: b.amount_cents || orig.price_cents },
    (list || []).map((a) => ({
      id: a.id,
      cat: a.cat,
      city: (a.loc as { de?: string })?.de || "",
      rating: Number(a.rating) || 0,
      price_cents: a.price_cents,
      standby: a.standby === true,
      busy: busy.has(a.id),
      blocked: a.blocked === true,
    })),
  );
  const byId = new Map((list || []).map((a) => [a.id, a]));
  return picks.map((p) => ({
    id: p.id,
    name: (byId.get(p.id)?.name as { de?: string })?.de || `Künstler ${p.id}`,
    price_cents: p.price_cents,
    rating: p.rating,
    standby: p.standby,
  }));
}

/** Ersatzgarantie auslösen: Vorschläge speichern, Kunde informieren, Ticket fürs Team */
export async function guaranteeCase(db: Db, b: BookingRow, why: "cancelArtist" | "reportNoShow") {
  const { URGENT_HOURS, UPGRADE_CAP_EUR, apologyVoucherCents } = await import("@/showly/policies");
  const { berlinStart } = await import("@/showly/cloudRules");
  const reps = await findReplacements(db, b).catch(() => []);
  await db.from("bookings").update({ replacements: reps }).eq("id", b.id);
  const urgent = berlinStart(b.day, b.slot) - Date.now() < URGENT_HOURS * 3600000;
  const hotline = process.env["SUPPORT_HOTLINE"] || "";
  const when = `${dateDe(b.day)}${b.slot ? `, ${b.slot} Uhr` : ""}`;
  const { SITE } = await import("@/showly/seo");
  await db.from("support_tickets").insert({
    profile: b.customer,
    email: "support@showly.eu",
    name: urgent ? "Ersatzgarantie DRINGEND" : "Ersatzgarantie",
    topic: "booking",
    body:
      `${urgent ? "DRINGEND (unter 48 Stunden): Kunden bitte persönlich anrufen. " : ""}` +
      `Buchung ${b.id} (${why === "cancelArtist" ? "Absage durch Künstler" : "Nichterscheinen gemeldet"}), Termin ${when}, Ort ${b.address ?? "–"}, Betrag ${euro(b.amount_cents)}. ` +
      `Vorschläge: ${reps.map((r) => `${r.name} (#${r.id}, ${euro(r.price_cents)}${r.standby ? ", Springer" : ""})`).join("; ") || "keine freien gefunden, bitte Springer-Liste anfragen"}. ` +
      `Aufpreis bis ${UPGRADE_CAP_EUR} € übernehmen, Gutschein ${euro(apologyVoucherCents(b.amount_cents))} ist ausgestellt.`,
  });
  await notify(
    b.customer,
    "Showly-Ersatzgarantie: dein Geld kommt zurück, hier ist Ersatz",
    [
      "Es tut uns leid. Den vollen Betrag erstatten wir sofort.",
      reps.length
        ? `Diese Künstler sind am ${when} frei: ${reps.map((r) => `${r.name} (${euro(r.price_cents)}) ${SITE}/kuenstler/${r.id}`).join(" · ")}`
        : "Unser Team sucht gerade freien Ersatz für deinen Termin und meldet sich.",
      `Kostet der Ersatz mehr, übernehmen wir den Aufpreis bis ${UPGRADE_CAP_EUR} €. Als Entschuldigung bekommst du einen Gutschein über ${euro(apologyVoucherCents(b.amount_cents))}.`,
      ...(urgent ? [`Wir rufen dich in Kürze an.${hotline ? ` Notfall-Hotline (auch am Wochenende): ${hotline}` : ""}`] : []),
    ],
    { key: `guarantee:${b.id}`, path: "/dashboard" },
  ).catch(() => false);
}

/** Ohne Check-in 15 Minuten nach Beginn: Nachricht an Künstler und Kunde.
 *  Läuft alle 5 Minuten (/api/checkin) und zusätzlich beim täglichen Lauf. */
export async function runCheckinWatch(now = Date.now()): Promise<number> {
  const db = adminClient();
  const { CHECKIN_ALERT_MIN } = await import("@/showly/policies");
  const { berlinStart } = await import("@/showly/cloudRules");
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const { data: list } = await db
    .from("bookings")
    .select("id, customer, artist_id, day, slot")
    .in("day", [yesterday, today])
    .in("status", ["confirmed", "pending"])
    .is("checked_in_at", null)
    .is("checkin_alert_at", null)
    .limit(500);
  let n = 0;
  for (const b of list || []) {
    const start = berlinStart(b.day, b.slot);
    if (now < start + CHECKIN_ALERT_MIN * 60000 || now > start + 6 * 3600000) continue;
    const { data: upd } = await db
      .from("bookings")
      .update({ checkin_alert_at: new Date(now).toISOString() })
      .eq("id", b.id)
      .is("checkin_alert_at", null)
      .select("id");
    if (!upd?.length) continue;
    n++;
    await notify(await ownerOfArtist(b.artist_id), "Du hast noch nicht eingecheckt", [
      `Dein Auftritt hat vor ${CHECKIN_ALERT_MIN} Minuten begonnen. Bitte checke jetzt mit dem Code des Kunden ein oder schreib ihm im Chat, wenn du dich verspätest.`,
    ], { key: `checkin-a:${b.id}`, path: "/portal" }).catch(() => false);
    await notify(b.customer, "Ist dein Künstler da?", [
      `Der Künstler hat ${CHECKIN_ALERT_MIN} Minuten nach Beginn noch nicht eingecheckt. Ist er da, nenne ihm den Check-in-Code oder bestätige es im Dashboard.`,
      "Ist er nicht gekommen, tippe im Dashboard auf „Künstler ist nicht erschienen“. Dann bekommst du sofort dein Geld zurück und Ersatz-Vorschläge.",
    ], { key: `checkin-c:${b.id}`, path: "/dashboard" }).catch(() => false);
  }
  return n;
}

/** Tägliche Aufgaben der fairen Regeln */
export async function runFairDaily(now = Date.now()) {
  const db = adminClient();
  const { depositAutoRelease, REVIEW_DAYS } = await import("@/showly/policies");
  const out = { deposits: 0, reviews: 0, escalated: 0, reminders: 0 };

  /* Kaution: 72 Stunden nach Rückgabe ohne Schadensmeldung automatisch frei */
  const { data: returned } = await db
    .from("shop_orders")
    .select("id, returned_at, damage_reported_at, deposit_cents, deposit_refunded_cents")
    .not("returned_at", "is", null)
    .is("deposit_released_at", null)
    .gt("deposit_cents", 0)
    .limit(300);
  const { refundDeposit } = await import("./money.server");
  for (const o of returned || []) {
    if (!depositAutoRelease(o.returned_at ?? null, !!o.damage_reported_at, now)) continue;
    const r = await refundDeposit(o.id, (o.deposit_cents ?? 0) - (o.deposit_refunded_cents ?? 0)).catch(() => null);
    if (r && "ok" in r) {
      await db.from("shop_orders").update({ deposit_released_at: new Date(now).toISOString() }).eq("id", o.id);
      out.deposits++;
    }
  }

  /* Bewertungen: nach Ablauf der 14 Tage veröffentlichen, auch wenn nur eine Seite bewertet hat */
  const cut = new Date(now - (REVIEW_DAYS + 1) * 86400000).toISOString().slice(0, 10);
  const { data: hidden } = await db.from("reviews").select("id, booking_id, event_date").is("published_at", null).limit(500);
  for (const r of hidden || []) {
    if (r.event_date && r.event_date <= cut) {
      await db.from("reviews").update({ published_at: new Date(now).toISOString() }).eq("id", r.id);
      if (r.booking_id) await db.from("guest_reviews").update({ published_at: new Date(now).toISOString() }).eq("booking_id", r.booking_id).is("published_at", null);
      out.reviews++;
    }
  }
  const { data: hiddenGuest } = await db.from("guest_reviews").select("id, booking_id, bookings!inner(day)").is("published_at", null).limit(500);
  for (const g of (hiddenGuest || []) as unknown as { id: number; bookings: { day: string } }[])
    if (g.bookings.day <= cut) await db.from("guest_reviews").update({ published_at: new Date(now).toISOString() }).eq("id", g.id);

  /* Zweite Erinnerung zur Bewertung, 2 Tage nach dem Event */
  const twoAgo = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const { data: past } = await db.from("bookings").select("id, customer, artist_id").eq("day", twoAgo).in("status", ["confirmed", "completed"]).limit(500);
  for (const b of past || []) {
    const { count } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("booking_id", b.id);
    if (count) continue;
    if (
      await notify(b.customer, "Noch 12 Tage: bewerte deinen Auftritt", [
        "Du kannst bis 14 Tage nach dem Event bewerten. Deine Bewertung bleibt verdeckt, bis auch der Künstler dich bewertet hat oder die Frist um ist.",
      ], { key: `review2:${b.id}`, path: `/kuenstler/${b.artist_id}#bewertungen` }).catch(() => false)
    )
      out.reminders++;
    await notify(await ownerOfArtist(b.artist_id), "Bewerte deinen Kunden", [
      "Wie lief die Zusammenarbeit? Deine Bewertung des Kunden bleibt verdeckt, bis beide bewertet haben oder 14 Tage um sind.",
    ], { key: `review2a:${b.id}`, path: "/portal" }).catch(() => false);
  }

  /* Reklamationen: ohne Stellungnahme nach 48 Stunden an das Team */
  const iso = new Date(now).toISOString();
  const { data: overdue } = await db
    .from("complaints")
    .select("id")
    .in("status", ["open", "offer"])
    .lt("statement_due", iso)
    .is("statement_at", null)
    .limit(200);
  for (const c of overdue || []) {
    await db.from("complaints").update({ status: "escalated" }).eq("id", c.id);
    out.escalated++;
  }
  return out;
}
