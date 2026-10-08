/* Preise an einer Stelle, für Browser und Server gleich.
 *
 * Der Browser zeigt damit die Summen an. Der Server rechnet beim Bezahlen
 * mit genau diesen Funktionen noch einmal selbst nach und nimmt dafür nur
 * Kennungen entgegen (Künstler, Stunden, Artikel, Menge), nie Beträge.
 * So kann niemand im Browser einen Preis auf 1 Euro ändern. */
import { ARTISTS, SHOP_ITEMS, type Artist, type ShopItem } from "./data";
import { BAKERS, SWEETS, estimate, isDirectSweet, type Sweet } from "./sweets";
import { depositOf, rentDays, shipFee, type Ship } from "./rental";

const bakerIsDemo = (id: number) => !!BAKERS.find((b) => b.id === id)?.demo;

/** Zusätzliche Einträge aus der Datenbank (echte Künstler, Torten und Deko
 *  von Anbietern). Der Server lädt sie vor dem Rechnen und reicht sie hier
 *  herein; der Browser braucht das nicht. */
export interface Extra {
  artist?: (id: number) => Artist | undefined;
  sweet?: (id: number) => Sweet | undefined;
  item?: (id: number) => ShopItem | undefined;
}

/** Provision, die Showly von der Gage einbehält. Kunden zahlen den
 *  angezeigten Endpreis ohne Aufschlag; Künstler bekommen 80 %. */
export const FEE_RATE = 0.2;
export const MAX_HOURS = 12;

export type Mode = "rent" | "buy";

export interface CartShopLine {
  shopId: number;
  mode: Mode;
  qty: number;
  /** Miete: erster und letzter Tag */
  from?: string | undefined;
  to?: string | undefined;
  /** gewählte Größe (Kostüme) */
  size?: string | undefined;
  /** Übergabe: Abholung, Lieferung oder Versand inkl. Rückversand */
  ship?: Ship | undefined;
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
  /** Festpreis-Paket, wird sofort bezahlt statt angefragt */
  direct?: boolean;
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
  /* total = was der Kunde zahlt (Endpreis), fee = Showly-Provision,
     payout = was beim Künstler ankommt */
  return { pkg, hours: h, hourly, base, fee, total: base, payout: base - fee };
}

export function shopUnit(i: ShopItem, mode: Mode) {
  return mode === "rent" && i.rent > 0 ? i.rent : i.buy;
}

const isRent = (i: ShopItem, l: { mode: Mode }) => l.mode === "rent" && i.rent > 0;

/** Bestandteile einer Shop-Zeile in Euro: Ware bzw. Miete, Kaution, Übergabe.
 *  Miete ohne gültigen Zeitraum zählt als 1 Tag (Anzeige); bezahlt werden
 *  kann sie erst mit Zeitraum (priceLines meldet sie sonst als unbekannt). */
export function shopLineParts(i: ShopItem, l: CartShopLine) {
  const qty = Math.min(99, Math.max(1, Math.round(l.qty) || 1));
  if (!isRent(i, l)) return { goods: i.buy * qty, deposit: 0, ship: 0, days: 0, qty };
  const days = rentDays(l.from, l.to);
  return {
    goods: i.rent * Math.max(1, days) * qty,
    deposit: depositOf(i) * qty,
    ship: shipFee(i, l.ship) ?? 0,
    days,
    qty,
  };
}

/** Summe einer Shop-Zeile (inkl. Kaution und Übergabe) */
export function shopLineTotal(i: ShopItem, l: CartShopLine) {
  const p = shopLineParts(i, l);
  return p.goods + p.deposit + p.ship;
}

export function findArtist(id: number, extra?: Extra) {
  return extra?.artist?.(id) ?? ARTISTS.find((a) => a.id === id);
}
export function findItem(id: number, extra?: Extra) {
  return extra?.item?.(id) ?? SHOP_ITEMS.find((i) => i.id === id);
}

/** Summen für den ganzen Warenkorb */
/** Preis eines direkt buchbaren Süßwaren-Pakets, nur aus dem Katalog */
export function sweetPrice(sweetId: number, qty: number, extra?: Extra): number | null {
  const s = extra?.sweet?.(sweetId) ?? SWEETS.find((x) => x.id === sweetId);
  if (!s || s.own || !isDirectSweet(s)) return null;
  return estimate(
    s,
    Math.min(s.unit === "set" ? 20 : 2000, Math.max(1, Math.round(qty) || 1)),
  );
}

export function cartTotals(
  shop: CartShopLine[],
  bookings: CartBookingLine[],
  requests: {
    sweetId: number;
    qty: number;
    direct?: boolean;
    estimate: number;
  }[] = [],
) {
  let items = 0;
  for (const l of shop) {
    const i = findItem(l.shopId);
    if (i) items += shopLineTotal(i, l);
  }
  let artists = 0;
  for (const b of bookings) {
    const a = findArtist(b.artistId);
    if (!a) continue;
    artists += bookingPrice(a, b.hours, b.pkg).total;
  }
  /* Direkt gebuchte Süßwaren zählen zu den Artikeln. Eigene Angebote aus
     dem Browser haben noch keinen Katalogpreis; dann gilt der angezeigte. */
  let sweets = 0;
  for (const r of requests)
    if (r.direct) sweets += sweetPrice(r.sweetId, r.qty) ?? r.estimate;
  return {
    items,
    artists,
    sweets,
    total: items + artists + sweets,
  };
}

export interface PriceLine {
  name: string;
  amountInCents: number;
  quantity: number;
}

/** Zahlungsposten, wie sie beim Zahlungsanbieter erscheinen.
 *  Unbekannte Kennungen werden gemeldet statt still übergangen. */
export function priceLines(
  shop: CartShopLine[],
  bookings: { artistId: number; hours: number; pkg?: string | undefined; dateISO: string; slot: string }[],
  name: (v: unknown) => string,
  labels: { rent: string; buy: string },
  sweets: { sweetId: number; qty: number; dateISO: string }[] = [],
  extra?: Extra,
  /* Der Server lässt Beispielprofile und -artikel aus dem Katalog nicht
     bezahlen: Hinter ihnen steht kein echter Anbieter. */
  opts: { allowDemo?: boolean } = {},
): { lines: PriceLine[]; unknown: string[] } {
  const allowDemo = opts.allowDemo ?? true;
  const lines: PriceLine[] = [];
  const unknown: string[] = [];
  for (const b of bookings) {
    const a = findArtist(b.artistId, extra);
    if (!a || (!allowDemo && a.demo)) {
      unknown.push(`artist:${b.artistId}`);
      continue;
    }
    const p = bookingPrice(a, b.hours, b.pkg);
    lines.push(
      p.pkg
        ? { name: `${name(a.name)} · ${name(p.pkg.name)} · ${b.dateISO} ${b.slot}`, amountInCents: Math.round(p.base * 100), quantity: 1 }
        : { name: `${name(a.name)} · ${b.dateISO} ${b.slot} · Std.`, amountInCents: Math.round(p.hourly * 100), quantity: p.hours },
    );
  }
  for (const l of shop) {
    const i = findItem(l.shopId, extra);
    const qty = Math.min(99, Math.max(1, Math.round(l.qty) || 1));
    if (!i || i.own || (!allowDemo && i.demo)) {
      unknown.push(`item:${l.shopId}`);
      continue;
    }
    if (!isRent(i, l)) {
      /* Kostüme mit Größen nur mit gewählter Größe */
      if (i.sizes?.length && !(l.size && i.sizes.includes(l.size))) {
        unknown.push(`size:${l.shopId}`);
        continue;
      }
      lines.push({ name: `${name(i.name)} (${labels.buy}${l.size ? `, ${l.size}` : ""})`, amountInCents: Math.round(i.buy * 100), quantity: qty });
      continue;
    }
    /* Miete nur mit gültigem Zeitraum und angebotener Übergabeart */
    const days = rentDays(l.from, l.to);
    const fee = shipFee(i, l.ship);
    if (!days || fee === null || (i.sizes?.length && !(l.size && i.sizes.includes(l.size)))) {
      unknown.push(`rent:${l.shopId}`);
      continue;
    }
    const span = `${l.from!.slice(8)}.${l.from!.slice(5, 7)}.–${l.to!.slice(8)}.${l.to!.slice(5, 7)}.`;
    lines.push({
      name: `${name(i.name)} (${labels.rent}, ${span}, ${days} ${days === 1 ? "Tag" : "Tage"}${l.size ? `, ${l.size}` : ""})`,
      amountInCents: Math.round(i.rent * days * 100),
      quantity: qty,
    });
    const dep = depositOf(i);
    if (dep > 0) lines.push({ name: `Kaution ${name(i.name)} (wird nach Rückgabe erstattet)`, amountInCents: Math.round(dep * 100), quantity: qty });
    if (fee > 0)
      lines.push({
        name: `${l.ship === "shipping" ? "Versand inkl. Rückversand" : "Lieferung und Abholung"} · ${name(i.name)}`,
        amountInCents: Math.round(fee * 100),
        quantity: 1,
      });
  }
  for (const x of sweets) {
    const s = extra?.sweet?.(x.sweetId) ?? SWEETS.find((y) => y.id === x.sweetId);
    const price = sweetPrice(x.sweetId, x.qty, extra);
    const demoBaker = !allowDemo && s && (extra?.sweet?.(x.sweetId) ? false : bakerIsDemo(s.bakerId));
    if (!s || price === null || demoBaker) {
      unknown.push(`sweet:${x.sweetId}`);
      continue;
    }
    lines.push({
      name: `${name(s.name)} · ${x.dateISO} · ${x.qty}×`,
      amountInCents: Math.round(price * 100),
      quantity: 1,
    });
  }
  return { lines, unknown };
}
