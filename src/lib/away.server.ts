/* Urlaubsmodus von Konditoreien und Deko-/Kostümanbietern prüfen
 * (providers.data.awayUntil). Künstler sperren dafür ihre Kalendertage,
 * das prüft schon die Datenbank beim Reservieren (claim_slots). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { CartShopLine } from "@/showly/pricing";

const DB_FROM = 100000;
const dateDe = (iso: string) => iso.split("-").reverse().join(".");

/** Fehlertext, wenn ein Artikel von einem Anbieter im Urlaub stammt */
export async function checkAwayShop(
  admin: SupabaseClient<Database>,
  lines: CartShopLine[],
  todayISO = new Date().toISOString().slice(0, 10),
): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.shopId).filter((x) => x >= DB_FROM))];
  if (!ids.length) return null;
  const { data: offers } = await admin.from("provider_offers").select("id, provider_id").in("id", ids);
  const provIds = [...new Set((offers || []).map((o) => o.provider_id))];
  if (!provIds.length) return null;
  const { data: provs } = await admin.from("providers").select("id, data").in("id", provIds);
  const away = new Map(
    (provs || []).map((p) => [p.id, String(((p.data || {}) as Record<string, unknown>)["awayUntil"] || "")]),
  );
  for (const l of lines) {
    const pid = (offers || []).find((o) => o.id === l.shopId)?.provider_id;
    const until = pid ? away.get(pid) : "";
    if (!until || until < todayISO) continue;
    /* Kauf: Versand erst nach dem Urlaub; Miete: Beginn muss danach liegen */
    if (l.mode === "buy" || !l.from || l.from <= until)
      return `Ein Anbieter in deinem Warenkorb ist bis ${dateDe(until)} im Urlaub. ${l.mode === "rent" ? "Bitte wähle einen späteren Mietbeginn" : "Bestellen geht danach wieder"}.`;
  }
  return null;
}
