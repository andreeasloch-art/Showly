/* Verleih, Server-Seite: Mietartikel für einen Zeitraum belegen (Stückzahl,
 * Puffer nach der Rückgabe). Regeln in showly/rental.ts, Sperren in der
 * Datenbank (claim_rentals, Migration 0013). Nur echte Angebote von
 * Anbietern (Kennung ab 100000); Katalog-Beispiele sind nicht buchbar. */
import { adminClient } from "./supabase.server";
import type { CartShopLine } from "@/showly/pricing";
import type { ShopItem } from "@/showly/data";
import { bufferOf, occupied, rentDays, stockOf } from "@/showly/rental";

const DB_FROM = 100000;

export interface RentalClaimItem {
  item_ref: number;
  from: string;
  until: string;
  qty: number;
  stock: number;
}

/** Mietzeilen eines Warenkorbs → zu belegende Zeiträume */
export function rentalItems(lines: CartShopLine[], find: (id: number) => ShopItem | undefined): RentalClaimItem[] {
  const out: RentalClaimItem[] = [];
  for (const l of lines) {
    const i = find(l.shopId);
    if (!i || l.mode !== "rent" || !(i.rent > 0) || l.shopId < DB_FROM || !rentDays(l.from, l.to)) continue;
    const [from, until] = occupied(l.from!, l.to!, bufferOf(i));
    out.push({ item_ref: l.shopId, from, until, qty: Math.max(1, Math.min(99, Math.round(l.qty) || 1)), stock: stockOf(i) });
  }
  return out;
}

export async function claimRentals(
  items: RentalClaimItem[],
  kind: "hold" | "booking",
  holdKey: string | null,
  order?: number | null,
): Promise<{ ok: true } | { ok: false; index: number }> {
  if (!items.length) return { ok: true };
  const { data, error } = await adminClient().rpc("claim_rentals", {
    p_items: items,
    p_kind: kind,
    p_hold_key: holdKey,
    p_order: order ?? null,
  });
  if (error || !data) return { ok: false, index: 0 };
  return data.ok ? { ok: true } : { ok: false, index: data.index ?? 0 };
}
