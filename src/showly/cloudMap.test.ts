import { describe, expect, it } from "vitest";
import { DB_ID_BASE, bookingFromRow, dbIdOf, mergeById } from "./cloudMap";
import type { BookingRow } from "@/lib/database.types";

const row: BookingRow = {
  id: 7,
  customer: "u1",
  artist_id: null,
  catalog_artist: 3,
  day: "2026-10-10",
  slot: "15:00",
  hours: 2,
  amount_cents: 24000,
  fee_cents: 4000,
  payout_cents: 16000,
  status: "confirmed",
  figure: null,
  location: null,
  guests: 30,
  stripe_session_id: null,
  requested_at: null,
  pkg: null,
  occasion: "Geburtstag",
  notes: null,
  address: null,
  customer_name: "Lena",
  paid: true,
  cancelled_by: null,
  cancelled_at: null,
  checked_in_at: null,
  checked_in_by: null,
  created_at: "2026-09-26T10:00:00Z",
};

describe("cloudMap", () => {
  it("Buchung aus der Datenbank: Euro statt Cent, eigene Kennung, Katalog-Künstler", () => {
    const b = bookingFromRow(row, "4711");
    expect(b).toMatchObject({ id: DB_ID_BASE + 7, artistId: 3, amount: 240, guests: "30", checkinCode: "4711", customer: "Lena" });
    expect(dbIdOf(b.id)).toBe(7);
    expect(dbIdOf(105)).toBeNull();
    expect(dbIdOf(Date.now())).toBeNull();
  });
  it("Zusammenführen: Datenbank ersetzt alte Fassung, lokale Einträge bleiben", () => {
    const local = [{ id: 105 }, { id: DB_ID_BASE + 7 }, { id: DB_ID_BASE + 9 }, { id: 1_790_000_000_000 }];
    const merged = mergeById(local, [{ id: DB_ID_BASE + 7 }]);
    expect(merged.map((x) => x.id)).toEqual([DB_ID_BASE + 7, 105, 1_790_000_000_000]);
  });
});
