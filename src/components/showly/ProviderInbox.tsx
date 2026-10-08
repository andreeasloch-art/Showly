/* Posteingang für Torten- und Deko-Anbieter (nur mit Datenbank).
 *
 * Torten-Anfragen: annehmen mit Endpreis oder ablehnen (AGB § 17 Abs. 2),
 * Direktbuchungen sind schon bezahlt. Zu jeder Anfrage gibt es den Chat mit
 * dem Kunden. Deko: eingegangene Bestellungen mit eigenen Artikeln. */
import { ComplaintList, HandoverTools } from "./Fair";
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { SWEETS, bakerOf } from "@/showly/sweets";
import { SHOP_ITEMS } from "@/showly/data";
import type { ShopOrderRow, SweetRequestRow } from "@/lib/database.types";
import { providerInbox, respondSweet, shopOrderAction } from "@/utils/provider.functions";
import { useRentCopy } from "./Rental";
import { Chat } from "./Chat";
import { parsePrice } from "./BakerEditor";

const COPY = {
  de: {
    h: "Eingang als Anbieter",
    p: "Anfragen und Bestellungen für dein Torten- oder Deko-Angebot.",
    pending: "Dein Profil wird geprüft. Kunden sehen es, sobald wir es freigeschaltet haben.",
    none: "Noch keine Anfragen oder Bestellungen.",
    sweets: "Torten-Anfragen",
    orders: "Deko-Bestellungen",
    qty: (n: number) => `${n}×`,
    est: "Richtpreis",
    fixed: "Festpreis, bezahlt",
    final: "Endpreis in €",
    accept: "Annehmen",
    decline: "Ablehnen",
    msgs: "Nachrichten",
    st: { sent: "offen", confirmed: "angenommen", declined: "abgelehnt", booked: "gebucht", cancelled: "storniert" },
    ost: { pending: "offen", paid: "bezahlt", shipped: "versendet", returned: "zurück", cancelled: "storniert" },
    done: "Gespeichert",
    wishes: "Wünsche",
    rent: "Miete",
    buy: "Kauf",
  },
  en: {
    h: "Provider inbox",
    p: "Requests and orders for your cake or decor offers.",
    pending: "Your profile is under review. Customers will see it once we approve it.",
    none: "No requests or orders yet.",
    sweets: "Cake requests",
    orders: "Decor orders",
    qty: (n: number) => `${n}×`,
    est: "Estimate",
    fixed: "Fixed price, paid",
    final: "Final price in €",
    accept: "Accept",
    decline: "Decline",
    msgs: "Messages",
    st: { sent: "open", confirmed: "accepted", declined: "declined", booked: "booked", cancelled: "cancelled" },
    ost: { pending: "open", paid: "paid", shipped: "shipped", returned: "returned", cancelled: "cancelled" },
    done: "Saved",
    wishes: "Wishes",
    rent: "rental",
    buy: "purchase",
  },
  es: {
    h: "Bandeja de proveedor",
    p: "Solicitudes y pedidos de tus tartas o decoración.",
    pending: "Estamos revisando tu perfil. Los clientes lo verán cuando lo aprobemos.",
    none: "Aún no hay solicitudes ni pedidos.",
    sweets: "Solicitudes de tartas",
    orders: "Pedidos de decoración",
    qty: (n: number) => `${n}×`,
    est: "Precio orientativo",
    fixed: "Precio fijo, pagado",
    final: "Precio final en €",
    accept: "Aceptar",
    decline: "Rechazar",
    msgs: "Mensajes",
    st: { sent: "abierta", confirmed: "aceptada", declined: "rechazada", booked: "reservada", cancelled: "cancelada" },
    ost: { pending: "abierto", paid: "pagado", shipped: "enviado", returned: "devuelto", cancelled: "cancelado" },
    done: "Guardado",
    wishes: "Deseos",
    rent: "alquiler",
    buy: "compra",
  },
} as const;

/* Versand und Rückgabe von Mietartikeln mit Zustandsprotokoll und Kaution */
const RET = {
  de: {
    shipped: "Als versendet markieren",
    returned: "Rückgabe bestätigen",
    retP: (d: string) => `Kaution: ${d}. Sie wird erstattet, abzüglich eines Einbehalts für Schäden, Reinigung oder Verspätung.`,
    keep: "Einbehalt (€)",
    note: "Zustand bei Rückgabe",
    notePh: "z. B. vollständig und sauber zurück · oder: Riss am Ärmel, Reparatur 15 €",
    cancel: "Abbrechen",
    confirm: "Rückgabe speichern",
    doneShip: "Als versendet markiert.",
    doneRet: (d: string) => `Rückgabe gespeichert, ${d} Kaution erstattet.`,
  },
  en: {
    shipped: "Mark as shipped",
    returned: "Confirm return",
    retP: (d: string) => `Deposit: ${d}. It is refunded minus any amount kept for damage, cleaning or late return.`,
    keep: "Amount kept (€)",
    note: "Condition on return",
    notePh: "e.g. complete and clean · or: tear on sleeve, repair €15",
    cancel: "Cancel",
    confirm: "Save return",
    doneShip: "Marked as shipped.",
    doneRet: (d: string) => `Return saved, ${d} deposit refunded.`,
  },
  es: {
    shipped: "Marcar como enviado",
    returned: "Confirmar devolución",
    retP: (d: string) => `Fianza: ${d}. Se devuelve menos lo retenido por daños, limpieza o retraso.`,
    keep: "Importe retenido (€)",
    note: "Estado en la devolución",
    notePh: "p. ej. completo y limpio · o: roto en la manga, reparación 15 €",
    cancel: "Cancelar",
    confirm: "Guardar devolución",
    doneShip: "Marcado como enviado.",
    doneRet: (d: string) => `Devolución guardada, ${d} de fianza devueltos.`,
  },
} as const;

export function ProviderInbox() {
  const { lang, fmt, fmtDate, L, toast, myProviders } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [sweets, setSweets] = useState<SweetRequestRow[]>([]);
  const [orders, setOrders] = useState<ShopOrderRow[]>([]);
  const [price, setPrice] = useState<Record<number, string>>({});
  const [chat, setChat] = useState<SweetRequestRow | null>(null);

  const load = useCallback(() => {
    void providerInbox()
      .then((r) => {
        setSweets(r.sweets);
        setOrders(r.orders);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const iv = window.setInterval(load, 30000);
    return () => window.clearInterval(iv);
  }, [load]);

  const R = useRentCopy();
  const K = RET[(lang as "de" | "en" | "es") ?? "de"] ?? RET.de;
  const [ret, setRet] = useState<{ id: number; keep: string; note: string } | null>(null);

  async function orderAct(o: ShopOrderRow, action: "shipped" | "returned") {
    const keep = action === "returned" && ret ? Math.round((Number(ret.keep.replace(",", ".")) || 0) * 100) : 0;
    const res = await shopOrderAction({
      data: { orderId: o.id, action, ...(action === "returned" ? { keepCents: keep, note: ret?.note ?? "" } : {}) },
    });
    if ("error" in res) return toast(res.error);
    toast(action === "shipped" ? K.doneShip : K.doneRet(fmt(res.refunded / 100)));
    setRet(null);
    load();
  }

  async function answer(r: SweetRequestRow, accept: boolean) {
    const eur = parsePrice(price[r.id] ?? "");
    const res = await respondSweet({
      data: { requestId: r.id, accept, ...(accept && eur ? { priceCents: Math.round(eur * 100) } : {}) },
    });
    if ("error" in res) return toast(res.error);
    toast(C.done);
    load();
  }

  const baker = myProviders.baker ? bakerOf(myProviders.baker) : undefined;
  const unpublished = baker && !baker.verified;

  return (
    <section className="dash26-panel prov-inbox">
      <div className="dash26-panel-head">
        <h3>{C.h}</h3>
      </div>
      <p className="payout-info">{C.p}</p>
      {unpublished && <p className="prov-review">{C.pending}</p>}
      <ComplaintList role="provider" />
      {!sweets.length && !orders.length && <p className="dash26-none">{C.none}</p>}

      {sweets.length > 0 && <h4 className="inb-h">{C.sweets}</h4>}
      <ul className="prov-list">
        {sweets.map((r) => {
          const s = SWEETS.find((x) => x.id === r.sweet_ref);
          return (
            <li key={r.id}>
              <div>
                <b>{s ? String(L(s.name)) : "—"}</b>
                <small>
                  {fmtDate(r.day)} · {C.qty(r.qty)} · {r.city || ""} · {r.customer_name || ""}
                </small>
                {r.wishes && (
                  <small>
                    {C.wishes}: {r.wishes}
                  </small>
                )}
                <small>
                  {r.direct ? C.fixed : C.est}: {fmt(r.price_cents / 100)}
                </small>
              </div>
              <div className="prov-side">
                <span className={"my-req-st " + r.status}>{C.st[r.status]}</span>
                {r.status === "sent" && (
                  <>
                    <input
                      className="prov-price"
                      inputMode="decimal"
                      placeholder={C.final}
                      value={price[r.id] ?? ""}
                      onChange={(e) => setPrice((p) => ({ ...p, [r.id]: e.target.value }))}
                    />
                    <button type="button" className="dash26-mini inb-accept" onClick={() => void answer(r, true)}>
                      {C.accept}
                    </button>
                    <button type="button" className="dash26-mini outline inb-decline-ghost" onClick={() => void answer(r, false)}>
                      {C.decline}
                    </button>
                  </>
                )}
                <button type="button" className="dash26-mini outline chat26-open" onClick={() => setChat(r)}>
                  <Icon name="comment" /> {C.msgs}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {orders.length > 0 && <h4 className="inb-h">{C.orders}</h4>}
      <ul className="prov-list">
        {orders.map((o) => (
          <li key={o.id}>
            <div>
              <b>#{o.id}</b>
              <small>{fmtDate(o.created_at)}</small>
              {o.items.map((i, k) => {
                const it = SHOP_ITEMS.find((x) => x.id === i.shopId);
                return (
                  <small key={k}>
                    {i.qty}× {it ? String(L(it.name)) : "#" + i.shopId} ({i.mode === "rent" ? C.rent : C.buy})
                    {i.from && i.to ? ` · ${fmtDate(i.from)} – ${fmtDate(i.to)}` : ""}
                    {i.size ? ` · ${i.size}` : ""}
                    {i.ship ? ` · ${R.shipL[i.ship]}` : ""}
                  </small>
                );
              })}
              {o.ship_to && <small>{o.ship_to}</small>}
            </div>
            <div className="prov-side">
              <span className={"my-req-st " + (o.status === "paid" ? "booked" : "sent")}>{C.ost[o.status]}</span>
              {o.status === "paid" && (
                <button className="home-btn soft" onClick={() => void orderAct(o, "shipped")}>
                  {K.shipped}
                </button>
              )}
            </div>
            {o.items.some((i) => i.mode === "rent") && o.status !== "cancelled" && (
              <HandoverTools orderId={o.id} returned={!!o.returned_at} reported={!!o.damage_reported_at || !!o.deposit_released_at} />
            )}
          </li>
        ))}
      </ul>

      {chat && (
        <Chat
          sweetId={"db-" + chat.id}
          as="provider"
          heading={`${chat.customer_name || ""} · ${fmtDate(chat.day)}`}
          onClose={() => setChat(null)}
        />
      )}
    </section>
  );
}
