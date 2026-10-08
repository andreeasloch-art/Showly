/* Warenkorb, wie er zum Server geht: Buchungen, Torten-Anfragen, Shop und
 * Kontakt. cleanSnapshot übernimmt nur bekannte Felder in vernünftiger Länge
 * (rein, auch für den Webhook-Entwurf in payments.functions.ts). */
export type Snapshot = {
  bookings: {
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
  }[];
  requests: {
    sweetId: number;
    bakerId: number;
    dateISO: string;
    qty: number;
    city: string;
    wishes: string;
    estimate: number;
    direct?: boolean | undefined;
  }[];
  shop: {
    shopId: number;
    mode: "rent" | "buy";
    qty: number;
    from?: string | undefined;
    to?: string | undefined;
    size?: string | undefined;
    ship?: "pickup" | "delivery" | "shipping" | undefined;
    care?: boolean | undefined;
  }[];
  contact: { name: string; address?: string | undefined };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT = /^\d{2}:\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Nur die Felder übernehmen, die wir kennen, in vernünftiger Länge */
export function cleanSnapshot(s: Snapshot): Snapshot {
  if (!s || !Array.isArray(s.bookings) || !Array.isArray(s.requests) || !Array.isArray(s.shop))
    throw new Error("Ungültiger Warenkorb");
  if (s.bookings.length > 10 || s.requests.length > 20 || s.shop.length > 50) throw new Error("Warenkorb zu groß");
  return {
    bookings: s.bookings.map((b) => {
      if (!Number.isInteger(b.artistId) || !DATE.test(b.dateISO) || !SLOT.test(b.slot)) throw new Error("Ungültige Buchung");
      return {
        artistId: b.artistId,
        dateISO: b.dateISO,
        slot: b.slot,
        hours: Math.max(1, Math.min(12, Math.round(Number(b.hours)) || 1)),
        pkg: text(b.pkg, 40),
        figure: text(b.figure, 120),
        guests: text(b.guests, 12),
        address: text(b.address, 300),
        occasion: text(b.occasion, 120),
        notes: text(b.notes, 2000),
      };
    }),
    requests: s.requests.map((r) => {
      if (!Number.isInteger(r.sweetId) || !Number.isInteger(r.bakerId) || !DATE.test(r.dateISO)) throw new Error("Ungültige Anfrage");
      return {
        sweetId: r.sweetId,
        bakerId: r.bakerId,
        dateISO: r.dateISO,
        qty: Math.max(1, Math.min(5000, Math.round(Number(r.qty)) || 1)),
        city: text(r.city, 80) ?? "",
        wishes: text(r.wishes, 2000) ?? "",
        estimate: Math.max(0, Number(r.estimate) || 0),
        direct: !!r.direct,
      };
    }),
    shop: s.shop.map((l) => {
      if (!Number.isInteger(l.shopId) || (l.mode !== "rent" && l.mode !== "buy")) throw new Error("Ungültiger Artikel");
      return {
        shopId: l.shopId,
        mode: l.mode,
        qty: Math.max(1, Math.min(99, Math.round(Number(l.qty)) || 1)),
        ...(l.mode === "rent" && typeof l.from === "string" && DATE.test(l.from) ? { from: l.from } : {}),
        ...(l.mode === "rent" && typeof l.to === "string" && DATE.test(l.to) ? { to: l.to } : {}),
        ...(typeof l.size === "string" && l.size ? { size: l.size.slice(0, 20) } : {}),
        ...(l.ship === "pickup" || l.ship === "delivery" || l.ship === "shipping" ? { ship: l.ship } : {}),
        ...(l.mode === "rent" && l.care === true ? { care: true } : {}),
      };
    }),
    contact: { name: text(s.contact?.name, 120) ?? "", address: text(s.contact?.address, 300) },
  };
}
