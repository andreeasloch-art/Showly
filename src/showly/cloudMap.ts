/* Umrechnung zwischen Datenbankzeilen und den Daten, mit denen die App
 * arbeitet. Beträge liegen in der Datenbank in Cent, in der App in Euro.
 *
 * Buchungen aus der Datenbank bekommen in der App eine eigene Kennung
 * (DB_ID_BASE + Datenbank-Kennung). So überschneiden sie sich nie mit
 * Buchungen, die nur im Browser liegen, und dieselbe Buchung hat auf jedem
 * Gerät dieselbe Kennung. */
import type {
  BookingRow,
  PayoutRow,
  PenaltyRow,
  ShopOrderRow,
  SweetRequestRow,
  VoucherRow,
} from "@/lib/database.types";
import type { Booking, Order, Payout, Penalty, Voucher } from "./store";
import type { SweetRequest } from "./sweets";

export const DB_ID_BASE = 1_000_000_000;

export const localIdOf = (dbId: number) => DB_ID_BASE + dbId;
export const dbIdOf = (localId: number) => (localId >= DB_ID_BASE ? localId - DB_ID_BASE : null);

const euro = (cents: number | null | undefined) => Math.round(cents ?? 0) / 100;

export function bookingFromRow(r: BookingRow): Booking {
  return {
    id: localIdOf(r.id),
    artistId: r.artist_id ?? r.catalog_artist ?? 0,
    dateISO: r.day,
    ...(r.slot ? { slot: r.slot } : {}),
    amount: euro(r.amount_cents),
    status: r.status,
    ...(r.cancelled_by ? { cancelledBy: r.cancelled_by } : {}),
    ...(r.checkin_code ? { checkinCode: r.checkin_code } : {}),
    ...(r.checked_in_at ? { checkedInAt: r.checked_in_at } : {}),
    ...(r.checked_in_by ? { checkedInBy: r.checked_in_by } : {}),
    ...(r.requested_at ? { requestedAt: r.requested_at } : {}),
    paid: r.paid,
    ...(r.customer_name ? { customer: r.customer_name } : {}),
    ...(r.occasion ? { occasion: r.occasion } : {}),
    ...(r.guests != null ? { guests: String(r.guests) } : {}),
    ...(r.figure ? { figure: r.figure } : {}),
    ...(r.pkg ? { pkg: r.pkg } : {}),
    hours: r.hours,
    ...(r.address ? { address: r.address } : {}),
  };
}

export function penaltyFromRow(r: PenaltyRow, artistOf: (bookingId: number) => number): Penalty {
  return {
    id: localIdOf(r.id),
    bookingId: localIdOf(r.booking_id),
    artistId: r.artist_id ?? artistOf(r.booking_id),
    amount: euro(r.amount_cents),
    reason: r.reason,
    status: r.status,
    dateISO: r.created_at,
    ...(r.hearing_until ? { hearingUntil: r.hearing_until } : {}),
    ...(r.due_at ? { dueAt: r.due_at } : {}),
  };
}

export function voucherFromRow(r: VoucherRow): Voucher {
  return {
    code: r.code,
    amount: euro(r.amount_cents),
    bookingId: r.booking_id != null ? localIdOf(r.booking_id) : 0,
    dateISO: r.created_at,
    validUntil: r.valid_until,
  };
}

export function payoutFromRow(r: PayoutRow, dayOf: (bookingId: number) => string, name: string): Payout {
  return {
    id: localIdOf(r.id),
    artistId: r.artist_id ?? 0,
    artistName: name,
    dateISO: dayOf(r.booking_id),
    gross: euro(r.gross_cents),
    fee: euro(r.fee_cents),
    net: euro(r.net_cents),
    status: r.status === "paid" ? "paid" : "pending",
    payoutOn: r.payout_on,
    ...(r.reserve_cents ? { reserve: euro(r.reserve_cents) } : {}),
    ...(r.reserve_until ? { reserveUntil: r.reserve_until } : {}),
  };
}

export function sweetFromRow(r: SweetRequestRow, email = ""): SweetRequest {
  return {
    id: "db-" + r.id,
    sweetId: r.sweet_ref,
    bakerId: r.baker_ref,
    dateISO: r.day,
    qty: r.qty,
    city: r.city ?? "",
    wishes: r.wishes ?? "",
    name: r.customer_name ?? "",
    email,
    estimate: euro(r.price_cents),
    createdISO: r.created_at,
    status: r.status === "cancelled" ? "declined" : r.status,
    ...(r.direct ? { direct: true } : {}),
  };
}

export function orderFromRow(r: ShopOrderRow): Order {
  return {
    id: localIdOf(r.id),
    dateISO: r.created_at.slice(0, 10),
    items: r.items.map((i) => ({ shopId: i.shopId, mode: i.mode, qty: i.qty, price: euro(i.price_cents) })),
    total: euro(r.total_cents),
    status: r.status === "paid" ? "confirmed" : r.status,
  };
}

/** Buchungen zusammenführen: Einträge aus der Datenbank ersetzen ihre alten
 *  Fassungen, reine Browser-Buchungen bleiben daneben stehen. */
export function mergeById<T extends { id: number }>(local: T[], fromDb: T[]): T[] {
  const ids = new Set(fromDb.map((x) => x.id));
  return [...fromDb, ...local.filter((x) => x.id < DB_ID_BASE && !ids.has(x.id))];
}
