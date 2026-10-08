/* Tägliche Aufgaben des Servers, nur mit Dienstschlüssel.
 *
 *  1. Unbeantwortete Anfragen verfallen lassen und das Geld erstatten
 *  2. Erinnerung an Anbieter, deren Anfrage seit über 24 Stunden wartet
 *  3. Fällige Auszahlungen an Anbieter überweisen (AGB § 21)
 *  4. Löschfristen aus der Datenschutzerklärung einhalten
 *  4b. Faire Regeln (fair.server.ts): Kaution, Bewertungen, Reklamationen
 *  5. Abgelaufene Termin-Reservierungen löschen, externe Kalender der
 *     Künstler (Google, Apple, Outlook) abgleichen
 *
 * Aufruf: einmal täglich über /api/taeglich (mit CRON_SECRET, etwa aus
 * pg_cron oder einem Zeitplan-Dienst) oder per Knopf in der Verwaltung.
 * Mehrfaches Ausführen schadet nicht. */
import { adminClient } from "./supabase.server";
import { refundBooking, runDuePayouts } from "./money.server";
import { notifyBookingChange, remindOpenRequests } from "./notify.server";

export interface DailyResult {
  lapsed: number;
  reminded: number;
  payouts: { paid: number; held: number; skipped: number; failed: number };
  calendars: { ok: number; failed: number };
  mails: { reminders: number; reviews: number; returns: number };
  fair: { deposits: number; reviews: number; escalated: number; reminders: number; checkins: number };
}

export async function runDaily(): Promise<DailyResult> {
  const db = adminClient();
  const { requestLapsed } = await import("@/showly/cloudRules");

  let lapsed = 0;
  const { data: open } = await db.from("bookings").select("*").eq("status", "requested").limit(500);
  for (const b of open || []) {
    if (!requestLapsed(b)) continue;
    const { data: upd } = await db
      .from("bookings")
      .update({ status: "declined" })
      .eq("id", b.id)
      .eq("status", "requested")
      .select("id");
    if (!upd?.length) continue;
    lapsed++;
    if (b.artist_id && b.slot)
      await db.from("availability").delete().eq("artist_id", b.artist_id).eq("day", b.day).eq("slot", b.slot);
    if (b.paid) await refundBooking(b.id, { reason: "Anfrage nicht rechtzeitig bestätigt" }).catch(() => null);
    await notifyBookingChange("declined", b).catch(() => false);
  }

  const reminded = await remindOpenRequests().catch(() => 0);
  /* Erinnerung vor dem Event, Bewertungsanfrage danach, Rückgabe beim Verleih */
  const { eventMails } = await import("./notify.server");
  const mails = await eventMails().catch(() => ({ reminders: 0, reviews: 0, returns: 0 }));
  /* Faire Regeln: Kaution nach 72 h frei, Bewertungen veröffentlichen,
     Reklamationen ohne Stellungnahme ans Team, Check-in-Wächter */
  const { runFairDaily, runCheckinWatch } = await import("./fair.server");
  const fairDaily = await runFairDaily().catch(() => ({ deposits: 0, reviews: 0, escalated: 0, reminders: 0 }));
  const checkins = await runCheckinWatch().catch(() => 0);
  const fair = { ...fairDaily, checkins };
  const payouts = await runDuePayouts().catch(() => ({ paid: 0, held: 0, skipped: 0, failed: 0 }));
  await db.rpc("purge_old_data").then(undefined, () => null);
  await db.rpc("purge_sms_log").then(undefined, () => null);
  await db.rpc("purge_slot_holds").then(undefined, () => null);
  /* Warenkorb-Entwürfe nicht bezahlter Kassen (Stripe-Webhook) nach 2 Tagen */
  await db
    .from("checkout_drafts")
    .delete()
    .lt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .then(undefined, () => null);
  const { syncAllFeeds } = await import("./calsync.server");
  const calendars = await syncAllFeeds().catch(() => ({ ok: 0, failed: 0 }));
  /* Merker für verschickte Mails nach 30 Tagen löschen */
  await db
    .from("notifications_sent")
    .delete()
    .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .then(undefined, () => null);
  return { lapsed, reminded, payouts, calendars, mails, fair };
}
