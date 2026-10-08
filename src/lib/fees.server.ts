/* Provisionsregeln aus der Datenbank (fee_rules, Migration 0014). Ohne
 * Tabelle oder bei Fehlern gilt der Standard aus pricing.ts. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { FeeRule } from "@/showly/feeRules";

export async function loadFeeRules(admin: SupabaseClient<Database>): Promise<FeeRule[]> {
  try {
    const { data } = await admin.from("fee_rules").select("scope, ref, rate").limit(1000);
    return (data || []).map((r) => ({ scope: r.scope, ref: r.ref, rate: Number(r.rate) }));
  } catch {
    return [];
  }
}
