/* Hilfen zu hochgeladenen Fotos und Videos, nur auf dem Server. */
import { adminClient } from "./supabase.server";

/** Gehören alle Kennungen (aus public.media) dieser Person? */
export async function ownsAll(uid: string, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const { data } = await adminClient().from("media").select("id").eq("owner", uid).in("id", ids);
  return (data || []).length === new Set(ids).size;
}

/** Zahl der Dateien, die auf Freigabe warten (Übersicht der Verwaltung) */
export async function pendingMediaCount(): Promise<number> {
  const { count } = await adminClient()
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count || 0;
}
