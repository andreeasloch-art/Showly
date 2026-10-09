/* Torten & Süßes, Server-Seite: vor Bestellung und Anfrage prüfen, ob der
 * Tag möglich ist (Vorlaufzeit, Tageskapazität der Backstube) und ob die
 * Pflichtangaben zu Allergenen und Zutaten vollständig sind (LMIV). Regeln
 * in showly/cakeRules.ts. Beispielangebote aus dem Katalog prüft der
 * Server nicht; sie sind ohnehin nicht bezahlbar. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { checkCakeDay, cleanFoodInfo, foodInfoComplete } from "@/showly/cakeRules";

const DB_FROM = 100000;

export async function checkCakeOrders(
  admin: SupabaseClient<Database>,
  items: { sweetId: number; dateISO: string }[],
  todayISO = new Date().toISOString().slice(0, 10),
): Promise<string | null> {
  const real = items.filter((x) => x.sweetId >= DB_FROM);
  if (!real.length) return null;
  const { data: offers } = await admin
    .from("provider_offers")
    .select("id, provider_id, data")
    .in("id", [...new Set(real.map((x) => x.sweetId))]);
  const offer = new Map((offers || []).map((o) => [o.id, o]));
  const provIds = [...new Set((offers || []).map((o) => o.provider_id))];
  const { data: provs } = provIds.length
    ? await admin.from("providers").select("id, data").in("id", provIds)
    : { data: [] as { id: number; data: Record<string, unknown> }[] };
  const prov = new Map((provs || []).map((p) => [p.id, (p.data || {}) as Record<string, unknown>]));

  /* je Anbieter und Tag zusammenzählen, was dieser Warenkorb dazu bringt */
  const adding = new Map<string, number>();
  for (const it of real) {
    const o = offer.get(it.sweetId);
    if (!o) return "Dieses Angebot gibt es nicht mehr.";
    const od = (o.data || {}) as Record<string, unknown>;
    if (!foodInfoComplete(cleanFoodInfo(od["food"])))
      return "Für dieses Angebot fehlen noch Allergen- und Zutatenangaben. Es kann erst bestellt werden, wenn der Anbieter sie ergänzt hat.";
    const k = `${o.provider_id}|${it.dateISO}`;
    adding.set(k, (adding.get(k) ?? 0) + 1);
  }
  for (const [k, n] of adding) {
    const [pid, day] = k.split("|") as [string, string];
    const pd = prov.get(Number(pid)) ?? {};
    const first = real.find((x) => offer.get(x.sweetId)?.provider_id === Number(pid) && x.dateISO === day)!;
    const od = (offer.get(first.sweetId)!.data || {}) as Record<string, unknown>;
    const leadDays = od["leadDays"] != null ? Number(od["leadDays"]) || 0 : Number(pd["leadDays"]) || 0;
    const maxPerDay = Number(pd["maxPerDay"]) || 0;
    /* Urlaubsmodus der Konditorei */
    const awayUntil = String(pd["awayUntil"] || "");
    if (awayUntil && day <= awayUntil)
      return `Die Konditorei ist bis ${awayUntil.split("-").reverse().join(".")} im Urlaub. Bitte wähle einen späteren Tag.`;
    let taken = 0;
    if (maxPerDay > 0) {
      const { count } = await admin
        .from("sweet_requests")
        .select("id", { count: "exact", head: true })
        .eq("baker_ref", Number(pid))
        .eq("day", day)
        .in("status", ["sent", "confirmed", "booked"]);
      taken = count ?? 0;
    }
    const r = checkCakeDay({ leadDays, maxPerDay }, day, todayISO, taken, n);
    if (!r.ok)
      return r.reason === "lead"
        ? `Der Anbieter braucht mindestens ${leadDays} Tage Vorlauf. Frühester Termin: ${r.earliest.split("-").reverse().join(".")}.`
        : `Am ${day.split("-").reverse().join(".")} ist die Backstube schon ausgebucht. Bitte einen anderen Tag wählen.`;
  }
  return null;
}
