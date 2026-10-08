/* Verleih: Angaben des Anbieters (RentTermsFields), Mietzeitraum, Größe und
 * Übergabe im Warenkorb (RentLineEditor) und Hinweise vor dem Kauf
 * (RentFacts). Regeln in showly/rental.ts. */
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { DateField } from "@/components/showly/DateField";
import { todayISO } from "@/showly/ui";
import type { ShopItem } from "@/showly/data";
import type { CartShopLine } from "@/showly/pricing";
import { bufferOf, depositOf, rentDays, shipFee, shipOptions, stockOf, type RentTerms, type Ship } from "@/showly/rental";

type Lang = "de" | "en" | "es";

const COPY = {
  de: {
    h: "Verleih",
    stock: "Stück vorhanden",
    buffer: "Tage gesperrt nach Rückgabe",
    bufferHint: "Zeit zum Reinigen, Prüfen und Reparieren",
    deposit: "Kaution je Stück",
    depositHint: "Wird nach der Rückgabe erstattet, abzüglich Schäden oder Verspätung.",
    sizes: "Größen (mit Komma getrennt)",
    sizesPh: "z. B. S, M, L oder 116, 128, 140",
    hygiene: "Hygienehinweis",
    hygienePh: "z. B. nach jeder Miete chemisch gereinigt",
    pickup: "Abholung möglich",
    delivery: "Lieferung und Abholung (Preis)",
    shipping: "Versand inkl. Rückversand (Preis)",
    emptyNo: "leer = nicht angeboten",
    from: "Erster Miettag",
    to: "Letzter Miettag",
    size: "Größe",
    pick: "bitte wählen",
    ship: "Übergabe",
    shipL: { pickup: "Abholung", delivery: "Lieferung", shipping: "Versand inkl. Rückversand" } as Record<Ship, string>,
    days: (n: number) => (n === 1 ? "1 Tag" : `${n} Tage`),
    needDates: "Bitte Mietzeitraum wählen (höchstens 30 Tage).",
    depositL: "Kaution",
    depositP: "wird nach der Rückgabe erstattet",
    stockL: (n: number) => `${n} Stück verfügbar`,
    bufferL: (n: number) => `danach ${n} ${n === 1 ? "Tag" : "Tage"} Reinigung`,
    busy: "In diesem Zeitraum ist der Artikel schon vergeben. Bitte einen anderen Zeitraum wählen.",
    perDay: "pro Tag",
  },
  en: {
    h: "Rental",
    stock: "Units available",
    buffer: "Days blocked after return",
    bufferHint: "Time for cleaning, checking and repairs",
    deposit: "Deposit per unit",
    depositHint: "Refunded after return, minus damage or late fees.",
    sizes: "Sizes (comma separated)",
    sizesPh: "e.g. S, M, L or 116, 128, 140",
    hygiene: "Hygiene note",
    hygienePh: "e.g. dry-cleaned after every rental",
    pickup: "Pickup possible",
    delivery: "Delivery and collection (price)",
    shipping: "Shipping incl. return (price)",
    emptyNo: "empty = not offered",
    from: "First rental day",
    to: "Last rental day",
    size: "Size",
    pick: "please choose",
    ship: "Handover",
    shipL: { pickup: "Pickup", delivery: "Delivery", shipping: "Shipping incl. return" } as Record<Ship, string>,
    days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    needDates: "Please choose the rental period (max. 30 days).",
    depositL: "Deposit",
    depositP: "refunded after return",
    stockL: (n: number) => `${n} available`,
    bufferL: (n: number) => `then ${n} ${n === 1 ? "day" : "days"} cleaning`,
    busy: "This item is already taken for that period. Please choose another period.",
    perDay: "per day",
  },
  es: {
    h: "Alquiler",
    stock: "Unidades disponibles",
    buffer: "Días bloqueados tras la devolución",
    bufferHint: "Tiempo para limpiar, revisar y reparar",
    deposit: "Fianza por unidad",
    depositHint: "Se devuelve tras la devolución, menos daños o retrasos.",
    sizes: "Tallas (separadas por comas)",
    sizesPh: "p. ej. S, M, L o 116, 128, 140",
    hygiene: "Nota de higiene",
    hygienePh: "p. ej. limpieza en seco tras cada alquiler",
    pickup: "Recogida posible",
    delivery: "Entrega y recogida (precio)",
    shipping: "Envío con devolución (precio)",
    emptyNo: "vacío = no se ofrece",
    from: "Primer día",
    to: "Último día",
    size: "Talla",
    pick: "elige",
    ship: "Entrega",
    shipL: { pickup: "Recogida", delivery: "Entrega", shipping: "Envío con devolución" } as Record<Ship, string>,
    days: (n: number) => (n === 1 ? "1 día" : `${n} días`),
    needDates: "Elige el periodo de alquiler (máx. 30 días).",
    depositL: "Fianza",
    depositP: "se devuelve tras la devolución",
    stockL: (n: number) => `${n} disponibles`,
    bufferL: (n: number) => `después ${n} ${n === 1 ? "día" : "días"} de limpieza`,
    busy: "Este artículo ya está reservado en ese periodo. Elige otro.",
    perDay: "por día",
  },
} as const;

export function useRentCopy() {
  const { lang } = useShowly();
  return COPY[(lang as Lang) ?? "de"] ?? COPY.de;
}

export interface RentDraft {
  stock: string;
  bufferDays: string;
  deposit: string;
  sizes: string;
  hygiene: string;
  pickup: boolean;
  deliveryFee: string;
  shippingFee: string;
}

export const emptyRentDraft = (): RentDraft => ({
  stock: "1",
  bufferDays: "1",
  deposit: "",
  sizes: "",
  hygiene: "",
  pickup: true,
  deliveryFee: "",
  shippingFee: "",
});

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/** Formularwerte → Angaben für den Server (dort noch einmal geprüft) */
export function rentTermsFromDraft(d: RentDraft): RentTerms {
  return {
    stock: num(d.stock) ?? 1,
    bufferDays: num(d.bufferDays) ?? 1,
    deposit: num(d.deposit) ?? 0,
    sizes: d.sizes
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    hygiene: d.hygiene.trim(),
    pickup: d.pickup,
    deliveryFee: num(d.deliveryFee),
    shippingFee: num(d.shippingFee),
  };
}

export function RentTermsFields({ d, onChange }: { d: RentDraft; onChange: (d: RentDraft) => void }) {
  const C = useRentCopy();
  const up = <K extends keyof RentDraft>(k: K, v: RentDraft[K]) => onChange({ ...d, [k]: v });
  return (
    <fieldset className="food-fields">
      <legend className="pe-label">{C.h}</legend>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">{C.stock}</span>
          <input type="number" min={1} max={999} value={d.stock} onChange={(e) => up("stock", e.target.value)} />
        </label>
        <label className="pe-field">
          <span className="pe-label">{C.buffer}</span>
          <input type="number" min={0} max={14} value={d.bufferDays} onChange={(e) => up("bufferDays", e.target.value)} />
          <span className="pe-hint">{C.bufferHint}</span>
        </label>
      </div>
      <label className="pe-field">
        <span className="pe-label">{C.deposit}</span>
        <span className="pe-money">
          <input inputMode="decimal" value={d.deposit} onChange={(e) => up("deposit", e.target.value)} />
          <span>€</span>
        </span>
        <span className="pe-hint">{C.depositHint}</span>
      </label>
      <label className="pe-field">
        <span className="pe-label">{C.sizes}</span>
        <input value={d.sizes} maxLength={120} placeholder={C.sizesPh} onChange={(e) => up("sizes", e.target.value)} />
      </label>
      <label className="pe-field">
        <span className="pe-label">{C.hygiene}</span>
        <input value={d.hygiene} maxLength={300} placeholder={C.hygienePh} onChange={(e) => up("hygiene", e.target.value)} />
      </label>
      <label className="food-none">
        <input type="checkbox" checked={d.pickup} onChange={(e) => up("pickup", e.target.checked)} />
        {C.pickup}
      </label>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">{C.delivery}</span>
          <span className="pe-money">
            <input inputMode="decimal" value={d.deliveryFee} placeholder="–" onChange={(e) => up("deliveryFee", e.target.value)} />
            <span>€</span>
          </span>
          <span className="pe-hint">{C.emptyNo}</span>
        </label>
        <label className="pe-field">
          <span className="pe-label">{C.shipping}</span>
          <span className="pe-money">
            <input inputMode="decimal" value={d.shippingFee} placeholder="–" onChange={(e) => up("shippingFee", e.target.value)} />
            <span>€</span>
          </span>
          <span className="pe-hint">{C.emptyNo}</span>
        </label>
      </div>
    </fieldset>
  );
}

/** Mietzeitraum, Größe und Übergabe einer Warenkorb-Zeile */
export function RentLineEditor({ i, l, idx }: { i: ShopItem; l: CartShopLine; idx: number }) {
  const C = useRentCopy();
  const { updateCartLine, fmt } = useShowly();
  const opts = shipOptions(i);
  const days = rentDays(l.from, l.to);
  const [busy, setBusy] = useState(false);
  /* Mit Datenbank: frei im gewählten Zeitraum? (endgültig prüft die Kasse) */
  useEffect(() => {
    setBusy(false);
    if (!days || i.demo) return;
    let gone = false;
    void import("@/utils/rental.functions")
      .then(({ rentalCheck }) => rentalCheck({ data: { itemId: i.id, from: l.from!, to: l.to!, qty: l.qty } }))
      .then((r) => !gone && "free" in r && setBusy(!r.free))
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [i.id, i.demo, l.from, l.to, l.qty, days]);
  return (
    <div className="rent-line">
      <div className="pe-grid2">
        <div className="pe-field">
          <span className="pe-label">{C.from}</span>
          <DateField value={l.from ?? ""} onChange={(v) => updateCartLine(idx, { from: v, ...(l.to && l.to < v ? { to: v } : {}) })} label={C.from} />
        </div>
        <div className="pe-field">
          <span className="pe-label">{C.to}</span>
          <DateField value={l.to ?? ""} onChange={(v) => updateCartLine(idx, { to: v })} label={C.to} />
        </div>
      </div>
      <div className="pe-grid2">
        {i.sizes?.length ? (
          <label className="pe-field">
            <span className="pe-label">{C.size}</span>
            <select value={l.size ?? ""} onChange={(e) => updateCartLine(idx, { size: e.target.value || undefined })}>
              <option value="">{C.pick}</option>
              {i.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="pe-field">
          <span className="pe-label">{C.ship}</span>
          <select value={l.ship ?? "pickup"} onChange={(e) => updateCartLine(idx, { ship: e.target.value as Ship })}>
            {opts.map((s) => (
              <option key={s} value={s}>
                {C.shipL[s]}
                {s !== "pickup" ? ` · ${fmt(shipFee(i, s) ?? 0)}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={"rent-sum" + (!days || busy ? " warn" : "")} role={!days || busy ? "alert" : undefined}>
        {!days ? C.needDates : busy ? C.busy : `${C.days(days)} · ${C.bufferL(bufferOf(i))}`}
      </p>
      <RentFacts i={i} />
    </div>
  );
}

/** Kaution, Stückzahl und Hygiene, vor dem Kauf sichtbar */
export function RentFacts({ i }: { i: ShopItem }) {
  const C = useRentCopy();
  const { fmt } = useShowly();
  const dep = depositOf(i);
  return (
    <ul className="rent-facts">
      {dep > 0 && (
        <li>
          <b>
            {C.depositL} {fmt(dep)}
          </b>{" "}
          {C.depositP}
        </li>
      )}
      <li>{C.stockL(stockOf(i))}</li>
      {i.hygiene && <li>{i.hygiene}</li>}
    </ul>
  );
}

/** Alle Mietzeilen vollständig (Zeitraum, Größe, Übergabe)? */
export function rentLinesReady(lines: CartShopLine[], find: (id: number) => ShopItem | undefined): boolean {
  return lines.every((l) => {
    const i = find(l.shopId);
    if (!i || l.mode !== "rent" || !(i.rent > 0)) return true;
    return rentDays(l.from, l.to) > 0 && (l.from ?? "") >= todayISO() && (!i.sizes?.length || !!l.size) && shipFee(i, l.ship) !== null;
  });
}
