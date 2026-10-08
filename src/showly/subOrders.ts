/* Ein Warenkorb, viele Anbieter: Aufteilung in Teilbestellungen.
 *
 * Kunden legen für dasselbe Event Künstler, Deko und Torten in einen
 * Warenkorb und zahlen einmal. Erfüllt wird aber von verschiedenen
 * Anbietern. Deshalb wird jede Bestellung (orders) in Teilbestellungen
 * (sub_orders) aufgeteilt, eine je Anbieter: jeder Künstler, jede
 * Konditorei, jeder Deko-Anbieter und Showly selbst für Katalogartikel.
 * Jede Teilbestellung hat ihren eigenen Betrag, ihre Provision, ihre
 * Auszahlung und ihren Status; abgesagt oder erstattet wird je Anbieter.
 *
 * Rein und getestet (subOrders.test.ts); recordCart in cloud.functions.ts
 * schreibt das Ergebnis in die Datenbank. */

export type ProviderKind = "artist" | "baker" | "deco" | "showly";
export type SubOrderStatus = "pending" | "paid" | "requested" | "confirmed";

export interface CartPart {
  type: "booking" | "sweet" | "shop";
  /** Position im jeweiligen Teil des Warenkorbs */
  index: number;
}

export interface SubOrderDraft {
  key: string;
  kind: ProviderKind;
  providerId: number | null;
  owner: string | null;
  amountCents: number;
  feeCents: number;
  payoutCents: number;
  status: SubOrderStatus;
  parts: CartPart[];
}

export interface SplitInput {
  paid: boolean;
  feeRate: number;
  /** Provision je Anbieter (feeRules.ts); ohne Angabe gilt feeRate */
  rateFor?: ((kind: "baker" | "deco", providerId: number | null) => number) | undefined;
  bookings: { artistId: number; owner: string | null; amountCents: number; feeCents: number; payoutCents: number; request: boolean }[];
  /** Torten: direkt gebucht (Festpreis, bezahlt) oder Anfrage (noch kein Preis) */
  sweets: { bakerId: number; owner: string | null; priceCents: number; direct: boolean }[];
  /** Shop: Deko-Anbieter (providerId) oder Showly-Katalog (null) */
  shop: { providerId: number | null; owner: string | null; amountCents: number }[];
}

export function splitIntoSubOrders(input: SplitInput): SubOrderDraft[] {
  const map = new Map<string, SubOrderDraft>();
  const get = (kind: ProviderKind, providerId: number | null, owner: string | null) => {
    const key = `${kind}:${providerId ?? "showly"}`;
    let d = map.get(key);
    if (!d) {
      d = { key, kind, providerId, owner, amountCents: 0, feeCents: 0, payoutCents: 0, status: input.paid ? "paid" : "pending", parts: [] };
      map.set(key, d);
    }
    return d;
  };
  const fee = (cents: number, kind: "baker" | "deco", id: number | null) =>
    Math.round(cents * (input.rateFor ? input.rateFor(kind, id) : input.feeRate));

  input.bookings.forEach((b, index) => {
    const d = get("artist", b.artistId, b.owner);
    d.amountCents += b.amountCents;
    d.feeCents += b.feeCents;
    d.payoutCents += b.payoutCents;
    d.parts.push({ type: "booking", index });
  });
  for (const d of map.values()) {
    if (d.kind !== "artist") continue;
    const reqs = d.parts.some((p) => input.bookings[p.index]!.request);
    d.status = reqs ? "requested" : input.paid ? "confirmed" : "pending";
  }

  input.sweets.forEach((s, index) => {
    const d = get("baker", s.bakerId, s.owner);
    const booked = s.direct && input.paid;
    if (booked) {
      d.amountCents += s.priceCents;
      const f = fee(s.priceCents, "baker", s.bakerId);
      d.feeCents += f;
      d.payoutCents += s.priceCents - f;
    }
    d.parts.push({ type: "sweet", index });
  });
  for (const d of map.values()) {
    if (d.kind !== "baker") continue;
    const anyRequest = d.parts.some((p) => !(input.sweets[p.index]!.direct && input.paid));
    d.status = anyRequest ? "requested" : "paid";
  }

  input.shop.forEach((l, index) => {
    const own = l.providerId === null;
    const d = get(own ? "showly" : "deco", l.providerId, own ? null : l.owner);
    d.amountCents += l.amountCents;
    /* Eigene Katalogartikel: alles bleibt bei Showly, keine Auszahlung */
    const f = own ? l.amountCents : fee(l.amountCents, "deco", l.providerId);
    d.feeCents += f;
    d.payoutCents += l.amountCents - f;
    d.parts.push({ type: "shop", index });
  });

  return [...map.values()];
}
