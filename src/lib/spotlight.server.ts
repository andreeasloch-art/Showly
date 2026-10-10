/* Top Act der Woche, Server-Seite: Zahlung prüfen und den reservierten
 * Zeitraum fest buchen. Aufgerufen nach der Rückkehr aus Stripe und vom
 * Webhook; doppelte Aufrufe ändern nichts. */
import { adminClient } from "./supabase.server";
import { createStripeClient } from "./stripe.server";
import { stripeEnv } from "./money.server";

export async function settleSpotlight(sessionId: string, env: "sandbox" | "live" = stripeEnv()): Promise<{ ok: true; id: number } | { error: string }> {
  const db = adminClient();
  const s = await createStripeClient(env).checkout.sessions.retrieve(sessionId);
  if (s.payment_status !== "paid" || s.metadata?.["kind"] !== "spotlight") return { error: "Zahlung nicht bestätigt" };
  const id = Number(s.metadata?.["spotlight_id"]);
  const { data: row } = await db.from("spotlights").select("*").eq("id", id).maybeSingle();
  if (!row) return { error: "Platzierung nicht gefunden" };
  if (row.status === "paid") return { ok: true, id };
  if ((s.amount_total ?? 0) !== row.amount_cents) return { error: "Betrag passt nicht" };
  await db.from("spotlights").update({ status: "paid", stripe_session_id: sessionId, hold_until: null }).eq("id", id).neq("status", "paid");
  const { notify } = await import("./notify.server");
  const d = (x: string) => x.split("-").reverse().join(".");
  const loc = row.kind === "location";
  await notify(row.owner, loc ? "Deine Location ist Location der Woche" : "Du bist Top Act der Woche", [
    `Deine Platzierung in ${row.city} ist gebucht: ${d(row.starts_on)} bis ${d(row.ends_on)}.`,
    loc
      ? "Ab dem ersten Tag erscheint deine Location ganz oben auf der Startseite, wenn Kunden nach Locations suchen."
      : "Ab dem ersten Tag erscheinst du ganz oben auf der Startseite für deine Stadt und Umgebung.",
  ]).catch(() => false);
  return { ok: true, id };
}
