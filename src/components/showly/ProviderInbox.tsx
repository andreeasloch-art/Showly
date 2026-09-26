/* Posteingang für Torten- und Deko-Anbieter (nur mit Datenbank).
 *
 * Torten-Anfragen: annehmen mit Endpreis oder ablehnen (AGB § 17 Abs. 2),
 * Direktbuchungen sind schon bezahlt. Zu jeder Anfrage gibt es den Chat mit
 * dem Kunden. Deko: eingegangene Bestellungen mit eigenen Artikeln. */
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { SWEETS, bakerOf } from "@/showly/sweets";
import { SHOP_ITEMS } from "@/showly/data";
import type { ShopOrderRow, SweetRequestRow } from "@/lib/database.types";
import { providerInbox, respondSweet } from "@/utils/provider.functions";
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
                  </small>
                );
              })}
              {o.ship_to && <small>{o.ship_to}</small>}
            </div>
            <div className="prov-side">
              <span className={"my-req-st " + (o.status === "paid" ? "booked" : "sent")}>{C.ost[o.status]}</span>
            </div>
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
