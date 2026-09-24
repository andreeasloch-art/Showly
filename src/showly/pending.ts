/* Zwischenspeicher für eine Zahlung, die gerade beim Zahlungsdienstleister läuft. */

export interface PendingLine {
  name: string;
  amountInCents: number;
  quantity?: number;
  /** Katalog-Preis-ID im Zahlungsanbieter (nur Shop-Artikel). */
  priceId?: string;
}

export interface PendingBooking {
  kind: "booking";
  artistId: number;
  artistName: string;
  dateISO: string;
  slot: string;
  hours: number;
  hourly: number;
  amount: number;
  payout: number;
  figure?: string;
  pkg?: string;
  title: string;
  lines: PendingLine[];
  email?: string;
}

export interface PendingOrder {
  kind: "order";
  total: number;
  title: string;
  lines: PendingLine[];
  email?: string;
}

export interface PendingSpotlight {
  kind: "spotlight";
  total: number;
  title: string;
  lines: PendingLine[];
  email?: string;
  spot: {
    name: string;
    cat: string;
    city: string;
    tagline: string;
    image?: string;
    link?: string;
  };
}

export interface PendingCart {
  kind: "cart";
  total: number;
  title: string;
  lines: PendingLine[];
  email?: string;
  snapshot: import("./store").CartSnapshot;
}

export type Pending = PendingBooking | PendingOrder | PendingSpotlight | PendingCart;

const KEY = "showly.pendingPayment";

export function setPending(p: Pending) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* Storage nicht verfügbar */
  }
}

export function getPending(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Storage nicht verfügbar */
  }
}
