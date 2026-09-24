/* Warenkorb: Künstlerbuchungen, Artikel aus dem Shop und Torten-Anfragen
   an einem Ort. Von hier geht es zur Kasse, wo alles zusammen bezahlt wird. */
import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { SHOP_ITEMS } from "@/showly/data";
import { Icon, bgOf, shopBg } from "@/showly/ui";
import { CartAddOns } from "@/components/showly/AddOns";
import { bookingPrice, findArtist } from "@/showly/pricing";
import { bakerOf, sweetBg, SWEETS } from "@/showly/sweets";

const TEXT = {
  de: {
    acts: "Künstler",
    items: "Artikel",
    requests: "Torten-Anfragen",
    requestsP: "Preis bestätigt der Anbieter. Jetzt wird dafür nichts berechnet.",
    hours: (n: number) => `${n} Std.`,
    fee: "inkl. Servicegebühr",
    approx: "ca.",
    remove: "Entfernen",
    toCheckout: "Zur Kasse",
    sendOnly: "Anfragen abschicken",
    now: "Jetzt zu zahlen",
    later: "Anfragen, Preis folgt",
    empty: "Dein Warenkorb ist leer",
    emptyP: "Leg einen Künstler, Deko oder eine Torte hinein.",
    browseActs: "Künstler finden",
    browseShop: "Zum Shop",
  },
  en: {
    acts: "Artists",
    items: "Items",
    requests: "Cake requests",
    requestsP: "The baker confirms the price. Nothing is charged for these now.",
    hours: (n: number) => `${n} hrs`,
    fee: "incl. service fee",
    approx: "approx.",
    remove: "Remove",
    toCheckout: "Checkout",
    sendOnly: "Send requests",
    now: "To pay now",
    later: "Requests, price follows",
    empty: "Your cart is empty",
    emptyP: "Add an artist, decor or a cake.",
    browseActs: "Find artists",
    browseShop: "Go to shop",
  },
  es: {
    acts: "Artistas",
    items: "Artículos",
    requests: "Solicitudes de tartas",
    requestsP: "El repostero confirma el precio. Ahora no se cobra nada por ellas.",
    hours: (n: number) => `${n} h`,
    fee: "incl. tarifa de servicio",
    approx: "aprox.",
    remove: "Quitar",
    toCheckout: "Ir a pagar",
    sendOnly: "Enviar solicitudes",
    now: "A pagar ahora",
    later: "Solicitudes, precio a confirmar",
    empty: "Tu carrito está vacío",
    emptyP: "Añade un artista, decoración o una tarta.",
    browseActs: "Buscar artistas",
    browseShop: "Ir a la tienda",
  },
};

export function CartDrawer() {
  const {
    t,
    L,
    fmt,
    fmtDate,
    lang,
    cart,
    cartOpen,
    setCartOpen,
    cartPrice,
    changeQty,
    removeFromCart,
    cartTotal,
    cartBookings,
    removeCartBooking,
    cartRequests,
    removeCartRequest,
  } = useShowly();
  const X = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const navigate = useNavigate();
  const empty = !cart.length && !cartBookings.length && !cartRequests.length;
  const requestSum = cartRequests.reduce((s, r) => s + r.estimate, 0);

  function go(to: "/checkout" | "/" | "/shop") {
    setCartOpen(false);
    navigate({ to });
  }

  return (
    <>
      <div className={"drawer-overlay" + (cartOpen ? " open" : "")} onClick={() => setCartOpen(false)} />
      <aside className={"drawer" + (cartOpen ? " open" : "")} aria-label={t("cart.h")}>
        <div className="drawer-head">
          <h3>{t("cart.h")}</h3>
          <button className="modal-close" onClick={() => setCartOpen(false)} aria-label="✕">
            ✕
          </button>
        </div>
        <div className="drawer-body">
          {empty ? (
            <div className="empty-state">
              <div className="ic">
                <Icon name="cart" />
              </div>
              <h3>{X.empty}</h3>
              <p>{X.emptyP}</p>
              <div className="cart-empty-btns">
                <button className="btn-primary" onClick={() => go("/")}>
                  {X.browseActs}
                </button>
                <button className="btn-secondary" onClick={() => go("/shop")}>
                  {X.browseShop}
                </button>
              </div>
            </div>
          ) : (
            <>
              {cartBookings.length > 0 && <div className="cart-sec">{X.acts}</div>}
              {cartBookings.map((b) => {
                const a = findArtist(b.artistId);
                if (!a) return null;
                const p = bookingPrice(a, b.hours, b.pkg);
                return (
                  <div className="cart-item" key={b.key}>
                    <div className="cart-img" style={bgOf(a)} />
                    <div className="cart-info">
                      <div className="cart-name">{L(a.name)}</div>
                      <div className="cart-mode">
                        {fmtDate(b.dateISO)} · {b.slot} · {p.pkg ? String(L(p.pkg.name)) : X.hours(p.hours)}
                      </div>
                      <div className="cart-price">
                        {fmt(p.total)} <small>{X.fee}</small>
                      </div>
                      <div className="qty-row">
                        <button className="cart-remove" onClick={() => removeCartBooking(b.key)}>
                          {X.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cart.length > 0 && <div className="cart-sec">{X.items}</div>}
              {cart.map((c, idx) => {
                const item = SHOP_ITEMS.find((s) => s.id === c.shopId);
                if (!item) return null;
                return (
                  <div className="cart-item" key={`${c.shopId}-${c.mode}`}>
                    <div className="cart-img" style={shopBg(item)} />
                    <div className="cart-info">
                      <div className="cart-name">{L(item.name)}</div>
                      <div className="cart-mode">{c.mode === "rent" ? t("shop.addRent") : t("shop.addBuy")}</div>
                      <div className="cart-price">{fmt(cartPrice(c))}</div>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => changeQty(idx, -1)} aria-label="−">
                          −
                        </button>
                        <span>{c.qty}</span>
                        <button className="qty-btn" onClick={() => changeQty(idx, 1)} aria-label="+">
                          +
                        </button>
                        <button className="cart-remove" onClick={() => removeFromCart(idx)}>
                          {X.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cartRequests.length > 0 && (
                <>
                  <div className="cart-sec">{X.requests}</div>
                  <p className="cart-sec-p">{X.requestsP}</p>
                </>
              )}
              {cartRequests.map((r) => {
                const s = SWEETS.find((x) => x.id === r.sweetId);
                const b = bakerOf(r.bakerId);
                return (
                  <div className="cart-item" key={r.key}>
                    <div className="cart-img" style={s ? sweetBg(s) : undefined} />
                    <div className="cart-info">
                      <div className="cart-name">{s ? L(s.name) : "—"}</div>
                      <div className="cart-mode">
                        {b ? String(L(b.name)) : ""} · {fmtDate(r.dateISO)} · {r.qty}×
                      </div>
                      <div className="cart-price">
                        <small>{X.approx}</small> {fmt(r.estimate)}
                      </div>
                      <div className="qty-row">
                        <button className="cart-remove" onClick={() => removeCartRequest(r.key)}>
                          {X.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <CartAddOns onLeave={() => setCartOpen(false)} />
        </div>
        {!empty && (
          <div className="drawer-foot">
            <div className="cart-total">
              <span>{X.now}</span>
              <strong>{fmt(cartTotal)}</strong>
            </div>
            {cartRequests.length > 0 && (
              <div className="cart-total later">
                <span>{X.later}</span>
                <span>
                  {X.approx} {fmt(requestSum)}
                </span>
              </div>
            )}
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => go("/checkout")}>
              {cartTotal > 0 ? X.toCheckout : X.sendOnly}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
