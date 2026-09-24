/* Preise an einer Stelle, für Browser und Server gleich.
 *
 * Der Browser zeigt damit die Summen an. Der Server rechnet beim Bezahlen
 * mit genau diesen Funktionen noch einmal selbst nach und nimmt dafür nur
 * Kennungen entgegen (Künstler, Stunden, Artikel, Menge), nie Beträge.
 * So kann niemand im Browser einen Preis auf 1 Euro ändern. */
import { ARTISTS, SHOP_ITEMS, type Artist, type ShopItem } from "./data";

/** Servicegebühr auf Buchungen */
export const FEE_RATE = 0.2;
export const MAX_HOURS = 12;

export type Mode = "rent" | "buy";

export interface CartShopLine {
  shopId: number;
  mode: Mode;
  qty: number;
}

export interface CartBookingLine {
  key: string;
  artistId: number;
  dateISO: string;
  slot: string;
  hours: number;
  pkg?: string | undefined;
  figure?: string | undefined;
  guests?: string | undefined;
  address?: string | undefined;
  occasion?: string | undefined;
  notes?: string | undefined;
}

export interface CartRequestLine {
  key: string;
  sweetId: number;
  bakerId: number;
  dateISO: string;
  qty: number;
  city: string;
  wishes: string;
  estimate: number;
}

export function minHoursOf(a: Artist) {
  return Math.max(1, Number(a["minHours"]) || 1);
}

export function packageOf(a: Artist, pkgId?: string) {
  if (!pkgId) return null;
  const list = ((a as { packages?: { id: string; name: unknown; price: number }[] }).packages || []);
  return list.find((p) => p.id === pkgId) ?? null;
}

export function bookingPrice(a: Artist, hours: number, pkgId?: string) {
  const pkg = packageOf(a, pkgId);
  const h = Math.min(MAX_HOURS, Math.max(minHoursOf(a), Math.round(hours) || 1));
  const hourly = a.price;
  const base = pkg ? pkg.price : hourly * h;
  const fee = Math.round(base * FEE_RATE);
  return { pkg, hours: h, hourly, base, fee, total: base + fee, payout: Math.round(base * (1 - FEE_RATE)) };
}

export function shopUnit(i: ShopItem, mode: Mode) {
  return mode === "rent" && i.rent > 0 ? i.rent : i.buy;
}

export function findArtist(id: number) {
  return ARTISTS.find((a) => a.id === id);
}
export function findItem(id: number) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** Summen für den ganzen Warenkorb */
export function cartTotals(shop: CartShopLine[], bookings: CartBookingLine[]) {
  let items = 0;
  for (const l of shop) {
    const i = findItem(l.shopId);
    if (i) items += shopUnit(i, l.mode) * l.qty;
  }
  let artists = 0;
  let fees = 0;
  for (const b of bookings) {
    const a = findArtist(b.artistId);
    if (!a) continue;
    const p = bookingPrice(a, b.hours, b.pkg);
    artists += p.base;
    fees += p.fee;
  }
  return { items, artists, fees, total: items + artists + fees };
}

export interface PriceLine {
  name: string;
  amountInCents: number;
  quantity: number;
}

/** Zahlungsposten, wie sie beim Zahlungsanbieter erscheinen.
 *  Unbekannte Kennungen werden gemeldet statt still übergangen. */
export function priceLines(
  shop: { shopId: number; mode: Mode; qty: number }[],
  bookings: { artistId: number; hours: number; pkg?: string | undefined; dateISO: string; slot: string }[],
  name: (v: unknown) => string,
  labels: { rent: string; buy: string; fee: string },
): { lines: PriceLine[]; unknown: string[] } {
  const lines: PriceLine[] = [];
  const unknown: string[] = [];
  let fee = 0;
  for (const b of bookings) {
    const a = findArtist(b.artistId);
    if (!a) {
      unknown.push(`artist:${b.artistId}`);
      continue;
    }
    const p = bookingPrice(a, b.hours, b.pkg);
    lines.push(
      p.pkg
        ? { name: `${name(a.name)} · ${name(p.pkg.name)} · ${b.dateISO} ${b.slot}`, amountInCents: Math.round(p.base * 100), quantity: 1 }
        : { name: `${name(a.name)} · ${b.dateISO} ${b.slot} · Std.`, amountInCents: Math.round(p.hourly * 100), quantity: p.hours },
    );
    fee += p.fee;
  }
  for (const l of shop) {
    const i = findItem(l.shopId);
    const qty = Math.min(99, Math.max(1, Math.round(l.qty) || 1));
    if (!i || i.own) {
      unknown.push(`item:${l.shopId}`);
      continue;
    }
    lines.push({
      name: `${name(i.name)} (${l.mode === "rent" && i.rent > 0 ? labels.rent : labels.buy})`,
      amountInCents: Math.round(shopUnit(i, l.mode) * 100),
      quantity: qty,
    });
  }
  if (fee > 0) lines.push({ name: labels.fee, amountInCents: Math.round(fee * 100), quantity: 1 });
  return { lines, unknown };
}
