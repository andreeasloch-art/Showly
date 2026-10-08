/* Verleih von Kostümen und Deko (rein, getestet in rental.test.ts).
 *
 *  - Miete immer für einen Zeitraum (erster bis letzter Tag, beide
 *    eingeschlossen), Preis = Tagespreis × Tage × Stück.
 *  - Stückzahl: Ein Artikel kann mehrfach vorhanden sein (stock). An keinem
 *    Tag dürfen mehr Stück vermietet sein, als es gibt.
 *  - Puffer nach der Rückgabe (Reinigung, Prüfung, Reparatur): so viele
 *    Tage bleibt der Artikel nach dem letzten Miettag gesperrt.
 *  - Kaution: echte Zahlung, nach der Rückgabe erstattet (eine
 *    Kartenreservierung hielte nur etwa 7 Tage).
 *  - Übergabe: Abholung, Lieferung oder Versand (inkl. Rückversand). */
import { addDaysISO } from "./cakeRules";

export type Ship = "pickup" | "delivery" | "shipping";

export interface RentTerms {
  /** vorhandene Stück (Standard 1) */
  stock?: number | undefined;
  /** gesperrte Tage nach der Rückgabe (Standard 1) */
  bufferDays?: number | undefined;
  /** Kaution je Stück in Euro (Standard 0) */
  deposit?: number | undefined;
  /** Größen zur Auswahl, z. B. ["S", "M", "L"] oder ["116", "128"] */
  sizes?: string[] | undefined;
  /** Hygienehinweis, z. B. "chemisch gereinigt, Perücke nur mit Haarnetz" */
  hygiene?: string | undefined;
  /** Übergabearten; Preise in Euro, null = nicht angeboten */
  pickup?: boolean | undefined;
  deliveryFee?: number | null | undefined;
  shippingFee?: number | null | undefined;
}

export const MAX_RENT_DAYS = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Miettage inklusive erstem und letztem Tag; 0 bei ungültigem Zeitraum */
export function rentDays(from: string | undefined, to: string | undefined): number {
  if (!from || !to || !ISO.test(from) || !ISO.test(to) || to < from) return 0;
  const d = Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000) + 1;
  return d > MAX_RENT_DAYS ? 0 : d;
}

export const stockOf = (t: RentTerms) => Math.max(1, Math.min(999, Math.round(Number(t.stock) || 1)));
export const bufferOf = (t: RentTerms) => Math.max(0, Math.min(14, Math.round(t.bufferDays ?? 1)));
export const depositOf = (t: RentTerms) => Math.max(0, Math.min(5000, Number(t.deposit) || 0));

/** Übergabearten, die der Anbieter anbietet (mindestens Abholung) */
export function shipOptions(t: RentTerms): Ship[] {
  const out: Ship[] = [];
  if (t.pickup !== false) out.push("pickup");
  if (t.deliveryFee != null && t.deliveryFee >= 0) out.push("delivery");
  if (t.shippingFee != null && t.shippingFee >= 0) out.push("shipping");
  return out.length ? out : ["pickup"];
}

/** Kosten der Übergabe; Versand inklusive Rückversand */
export function shipFee(t: RentTerms, ship: Ship | undefined): number | null {
  const s = ship ?? "pickup";
  if (!shipOptions(t).includes(s)) return null;
  if (s === "delivery") return Math.max(0, Number(t.deliveryFee) || 0);
  if (s === "shipping") return Math.max(0, Number(t.shippingFee) || 0);
  return 0;
}

/** Belegter Zeitraum samt Puffer: [from, to + buffer] */
export function occupied(from: string, to: string, buffer: number): [string, string] {
  return [from, addDaysISO(to, buffer)];
}

export interface Claim {
  from: string;
  /** letzter belegter Tag inklusive Puffer */
  until: string;
  qty: number;
}

/** Wie viele Stück sind im Zeitraum [from, until] höchstens schon vergeben? */
export function maxInUse(claims: Claim[], from: string, until: string): number {
  let max = 0;
  for (let d = from; d <= until; d = addDaysISO(d, 1)) {
    let n = 0;
    for (const c of claims) if (c.from <= d && d <= c.until) n += c.qty;
    if (n > max) max = n;
  }
  return max;
}

/** Ist der Artikel in dieser Menge für den Zeitraum frei (inkl. Puffer)? */
export function rentalFree(t: RentTerms, claims: Claim[], from: string, to: string, qty: number): boolean {
  if (!rentDays(from, to)) return false;
  const [a, b] = occupied(from, to, bufferOf(t));
  return maxInUse(claims, a, b) + Math.max(1, qty) <= stockOf(t);
}

/** Beispielwerte für Katalog-Artikel (nicht buchbar, nur zur Ansicht) */
export function demoRentTerms(i: { section?: string | undefined; buy: number }): RentTerms {
  const costume = i.section !== "deko";
  return {
    stock: costume ? 2 : 3,
    bufferDays: costume ? 2 : 1,
    deposit: Math.max(20, Math.round((i.buy * 0.3) / 10) * 10),
    ...(costume ? { sizes: ["S", "M", "L", "XL"] } : {}),
    hygiene: costume
      ? "Wird nach jeder Miete professionell gereinigt. Perücken und Masken nur mit Haarnetz bzw. Hygieneeinlage tragen."
      : "Wird nach jeder Miete gereinigt und auf Schäden geprüft.",
    pickup: true,
    deliveryFee: costume ? null : 25,
    shippingFee: costume ? 9.9 : null,
  };
}

/** Mietangaben eines Anbieters prüfen (Browser und Server) */
export function cleanRentTerms(d: Record<string, unknown>): RentTerms {
  const num = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return v === null || v === undefined || v === "" || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
  };
  const fee = (v: unknown) => (v === null || v === undefined || v === "" ? null : (num(v, 0, 500) ?? null));
  const sizes = Array.isArray(d["sizes"])
    ? [...new Set((d["sizes"] as unknown[]).map((x) => String(x).trim().slice(0, 20)).filter(Boolean))].slice(0, 12)
    : [];
  const out: RentTerms = {
    stock: Math.round(num(d["stock"], 1, 999) ?? 1),
    bufferDays: Math.round(num(d["bufferDays"], 0, 14) ?? 1),
    deposit: Math.round((num(d["deposit"], 0, 5000) ?? 0) * 100) / 100,
    pickup: d["pickup"] !== false,
    deliveryFee: fee(d["deliveryFee"]),
    shippingFee: fee(d["shippingFee"]),
  };
  if (sizes.length) out.sizes = sizes;
  const hy = typeof d["hygiene"] === "string" ? d["hygiene"].trim().slice(0, 300) : "";
  if (hy) out.hygiene = hy;
  return out;
}
