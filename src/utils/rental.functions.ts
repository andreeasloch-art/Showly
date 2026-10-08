/* Verleih: Ist ein Mietartikel im gewünschten Zeitraum noch frei?
 * Nur zur Anzeige im Warenkorb; verbindlich prüft die Kasse
 * (createCartCheckout → claim_rentals). */
import { createServerFn } from "@tanstack/react-start";

export const rentalCheck = createServerFn({ method: "POST" })
  .inputValidator((d: { itemId: number; from: string; to: string; qty: number }) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!Number.isInteger(d.itemId) || !iso.test(String(d.from)) || !iso.test(String(d.to))) throw new Error("Ungültig");
    return { itemId: d.itemId, from: d.from, to: d.to, qty: Math.max(1, Math.min(99, Math.round(Number(d.qty)) || 1)) };
  })
  .handler(async ({ data }): Promise<{ free: boolean } | { skipped: true }> => {
    if (data.itemId < 100000) return { skipped: true };
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const { cleanRentTerms, rentalFree } = await import("@/showly/rental");
      const db = adminClient();
      const { data: o } = await db.from("provider_offers").select("data").eq("id", data.itemId).maybeSingle();
      if (!o) return { free: false };
      const terms = cleanRentTerms((o.data || {}) as Record<string, unknown>);
      const { data: claims } = await db
        .from("rental_claims")
        .select("from_day, until_day, qty, kind, expires_at")
        .eq("item_ref", data.itemId)
        .gte("until_day", data.from);
      const now = Date.now();
      const live = (claims || [])
        .filter((c) => c.kind === "booking" || (c.expires_at && Date.parse(c.expires_at) > now))
        .map((c) => ({ from: c.from_day, until: c.until_day, qty: c.qty }));
      return { free: rentalFree(terms, live, data.from, data.to, data.qty) };
    } catch {
      return { skipped: true };
    }
  });
