/* Bausteine für Torten & Süßes: Texte, Anbieterkarte, Angebotskarte,
   Anfrage-Fenster und die Liste eigener Anfragen. */
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { DateField } from "@/components/showly/DateField";
import {
  SWEET_CAT_LABEL,
  addRequest,
  bakerBg,
  bakerOf,
  estimate,
  fromPrice,
  listRequests,
  sweetBg,
  type Baker,
  type Sweet,
  type SweetCat,
  type SweetRequest,
  type Unit,
} from "@/showly/sweets";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";

export const SWEETS_COPY = {
  de: {
    eyebrow: "Torten, Kuchen & Candy Bars",
    h1: "Süßes für dein Event",
    sub: "Hochzeitstorte, Motivtorte oder Candy Bar: Frag direkt bei Konditoreien und privaten Bäckerinnen und Bäckern in deiner Nähe an.",
    ph: "Torte, Anbieter oder Stadt …",
    trust1: "Anfragen kostet nichts",
    trust2: "Konditoreien und Privatpersonen",
    trust3: "Bezahlt wird erst nach Zusage",
    all: "Alles",
    kindAll: "Alle Anbieter",
    business: "Konditorei",
    businessP: "Konditoreien",
    private: "Privat",
    privateP: "Privatpersonen",
    bakers: "Anbieter",
    bakersCount: (n: number) => (n === 1 ? "1 Anbieter" : `${n} Anbieter`),
    offers: "Angebote",
    offersCount: (n: number) => (n === 1 ? "1 Angebot" : `${n} Angebote`),
    from: "ab",
    unit: { person: "/ Person", piece: "/ Stück", set: "" } as Record<Unit, string>,
    min: (n: number, u: Unit) => (u === "person" ? `ab ${n} Personen` : u === "piece" ? `ab ${n} Stück` : ""),
    ask: "Anfragen",
    lead: (d: number) => `${d} Tage Vorlauf`,
    delivery: (km: number) => (km > 0 ? `Lieferung bis ${km} km` : "Nur Abholung"),
    newP: "Neu",
    verified: "Geprüft",
    reset: "Filter zurücksetzen",
    emptyH: "Nichts gefunden",
    emptyP: "Versuch einen anderen Begriff oder wähle eine andere Kategorie.",
    joinEyebrow: "Für Bäckerinnen und Bäcker",
    joinH2: "Du backst gern? Biete deine Torten an.",
    joinP: "Ob Konditorei oder Hobbyküche: Leg ein Profil mit Fotos an, stell deine Torten, Kuchen und Candy Bars ein und bekomm Anfragen aus deiner Stadt.",
    joinBtn: "Jetzt anbieten",
    decoBtn: "Deko für dein Event",
    moreForEvent: "Dazu für dein Event",
    moreForEventP: "Künstler und Deko, die zu dieser Feier passen",
    mine: "Deine Anfragen",
    status: { sent: "Gesendet", confirmed: "Zugesagt", declined: "Abgesagt" } as Record<SweetRequest["status"], string>,
    req: {
      h: "Anfrage senden",
      needDate: "Bitte ein Datum wählen.",
      toCart: "In den Warenkorb",
      direct: "Nur anfragen, ohne Warenkorb",
      directP: "Die Anfrage geht sofort an den Anbieter. Deine Kontaktdaten:",
      inCart: "Liegt im Warenkorb. Die Anfrage geht beim Abschluss raus.",
      date: "Datum",
      qty: (u: Unit) => (u === "person" ? "Personen" : u === "piece" ? "Stück" : "Anzahl"),
      city: "Ort der Feier",
      wishes: "Wünsche",
      wishesPh: "Geschmack, Farben, Allergien, Text auf der Torte …",
      name: "Dein Name",
      email: "E-Mail",
      estimate: "Richtpreis",
      estimateP: "Der Anbieter bestätigt den Endpreis. Bezahlt wird erst nach der Zusage.",
      send: "Anfrage senden",
      need: "Bitte Datum, Name und E-Mail angeben.",
      tooSoon: (d: number) => `Dieser Anbieter braucht mindestens ${d} Tage Vorlauf.`,
      mail: "Bitte eine gültige E-Mail-Adresse angeben.",
      done: "Anfrage gesendet. Du findest sie in deinem Konto unter Torten-Anfragen.",
    },
  },
  en: {
    eyebrow: "Cakes, bakes & candy bars",
    h1: "Sweets for your event",
    sub: "Wedding cake, themed cake or candy bar: request directly from patisseries and home bakers near you.",
    ph: "Cake, baker or city …",
    trust1: "Requests are free",
    trust2: "Patisseries and home bakers",
    trust3: "Pay only after confirmation",
    all: "All",
    kindAll: "All providers",
    business: "Patisserie",
    businessP: "Patisseries",
    private: "Home baker",
    privateP: "Home bakers",
    bakers: "Bakers",
    bakersCount: (n: number) => (n === 1 ? "1 baker" : `${n} bakers`),
    offers: "Offers",
    offersCount: (n: number) => (n === 1 ? "1 offer" : `${n} offers`),
    from: "from",
    unit: { person: "/ person", piece: "/ piece", set: "" } as Record<Unit, string>,
    min: (n: number, u: Unit) => (u === "person" ? `min. ${n} guests` : u === "piece" ? `min. ${n} pieces` : ""),
    ask: "Request",
    lead: (d: number) => `${d} days notice`,
    delivery: (km: number) => (km > 0 ? `Delivery up to ${km} km` : "Pickup only"),
    newP: "New",
    verified: "Verified",
    reset: "Reset filters",
    emptyH: "Nothing found",
    emptyP: "Try another term or pick a different category.",
    joinEyebrow: "For bakers",
    joinH2: "Love baking? Offer your cakes.",
    joinP: "Patisserie or home kitchen: create a profile with photos, list your cakes, bakes and candy bars and get requests from your city.",
    joinBtn: "Start offering",
    decoBtn: "Decor for your event",
    moreForEvent: "More for your event",
    moreForEventP: "Artists and decor that suit this celebration",
    mine: "Your requests",
    status: { sent: "Sent", confirmed: "Confirmed", declined: "Declined" } as Record<SweetRequest["status"], string>,
    req: {
      h: "Send request",
      needDate: "Please pick a date.",
      toCart: "Add to cart",
      direct: "Just send a request",
      directP: "The request goes straight to the baker. Your contact details:",
      inCart: "Added to your cart. The request is sent when you check out.",
      date: "Date",
      qty: (u: Unit) => (u === "person" ? "Guests" : u === "piece" ? "Pieces" : "Quantity"),
      city: "Party location",
      wishes: "Wishes",
      wishesPh: "Flavour, colours, allergies, text on the cake …",
      name: "Your name",
      email: "Email",
      estimate: "Estimate",
      estimateP: "The baker confirms the final price. You pay only after confirmation.",
      send: "Send request",
      need: "Please add a date, your name and email.",
      tooSoon: (d: number) => `This baker needs at least ${d} days notice.`,
      mail: "Please enter a valid email address.",
      done: "Request sent. You'll find it in your account under cake requests.",
    },
  },
  es: {
    eyebrow: "Tartas, bizcochos y candy bars",
    h1: "Dulces para tu evento",
    sub: "Tarta de boda, tarta temática o candy bar: pide directamente a pastelerías y reposteros particulares cerca de ti.",
    ph: "Tarta, repostero o ciudad …",
    trust1: "Solicitar es gratis",
    trust2: "Pastelerías y particulares",
    trust3: "Pagas tras la confirmación",
    all: "Todo",
    kindAll: "Todos",
    business: "Pastelería",
    businessP: "Pastelerías",
    private: "Particular",
    privateP: "Particulares",
    bakers: "Reposteros",
    bakersCount: (n: number) => (n === 1 ? "1 repostero" : `${n} reposteros`),
    offers: "Ofertas",
    offersCount: (n: number) => (n === 1 ? "1 oferta" : `${n} ofertas`),
    from: "desde",
    unit: { person: "/ persona", piece: "/ unidad", set: "" } as Record<Unit, string>,
    min: (n: number, u: Unit) => (u === "person" ? `mín. ${n} personas` : u === "piece" ? `mín. ${n} unidades` : ""),
    ask: "Solicitar",
    lead: (d: number) => `${d} días de antelación`,
    delivery: (km: number) => (km > 0 ? `Entrega hasta ${km} km` : "Solo recogida"),
    newP: "Nuevo",
    verified: "Verificado",
    reset: "Quitar filtros",
    emptyH: "Sin resultados",
    emptyP: "Prueba otro término o elige otra categoría.",
    joinEyebrow: "Para reposteros",
    joinH2: "¿Te encanta hornear? Ofrece tus tartas.",
    joinP: "Pastelería o cocina casera: crea un perfil con fotos, publica tus tartas y candy bars y recibe solicitudes de tu ciudad.",
    joinBtn: "Empezar",
    decoBtn: "Decoración para tu evento",
    moreForEvent: "Más para tu evento",
    moreForEventP: "Artistas y decoración para esta celebración",
    mine: "Tus solicitudes",
    status: { sent: "Enviada", confirmed: "Confirmada", declined: "Rechazada" } as Record<SweetRequest["status"], string>,
    req: {
      h: "Enviar solicitud",
      needDate: "Elige una fecha.",
      toCart: "Añadir al carrito",
      direct: "Solo solicitar",
      directP: "La solicitud va directamente al repostero. Tus datos:",
      inCart: "Añadido al carrito. La solicitud se envía al finalizar.",
      date: "Fecha",
      qty: (u: Unit) => (u === "person" ? "Personas" : u === "piece" ? "Unidades" : "Cantidad"),
      city: "Lugar de la fiesta",
      wishes: "Deseos",
      wishesPh: "Sabor, colores, alergias, texto en la tarta …",
      name: "Tu nombre",
      email: "Correo",
      estimate: "Precio orientativo",
      estimateP: "El repostero confirma el precio final. Pagas tras la confirmación.",
      send: "Enviar solicitud",
      need: "Indica fecha, nombre y correo.",
      tooSoon: (d: number) => `Este repostero necesita al menos ${d} días de antelación.`,
      mail: "Introduce un correo válido.",
      done: "Solicitud enviada. La encontrarás en tu cuenta, en solicitudes de tartas.",
    },
  },
};
export type SweetsCopy = (typeof SWEETS_COPY)["de"];

export function useSweetsCopy(): SweetsCopy {
  const { lang } = useShowly();
  return (SWEETS_COPY[(lang as "de" | "en" | "es") ?? "de"] ?? SWEETS_COPY.de) as SweetsCopy;
}

export function catName(c: SweetCat, lang: string) {
  const l = SWEET_CAT_LABEL[c];
  return l[(lang as "de" | "en" | "es") ?? "de"] ?? l.de;
}

export function KindBadge({ b }: { b: Baker }) {
  const C = useSweetsCopy();
  return (
    <span className={"baker-kind " + b.kind}>
      <Icon name={b.kind === "private" ? "heart" : "crown"} />
      {b.kind === "private" ? C.private : C.business}
    </span>
  );
}

/** Karte eines Anbieters, im Schnitt der Künstlerkarte */
export function BakerCard({ b }: { b: Baker }) {
  const { L, fmt, num, lang } = useShowly();
  const C = useSweetsCopy();
  const cheapest = fromPrice(b.id);
  return (
    <article className="act-card baker-card">
      <div className="act-card-media">
        <div className="act-card-img" style={bakerBg(b)} />
        <span className="act-card-badge">
          <KindBadge b={b} />
        </span>
      </div>
      <div className="act-card-body">
        <div className="act-card-row">
          <h3 className="act-card-name">
            <Link className="act-card-link" to="/torten/$id" params={{ id: String(b.id) }}>
              {L(b.name)}
            </Link>
          </h3>
          {b.reviews > 0 ? (
            <span className="act-card-rating">
              <span className="star" aria-hidden="true">
                ★
              </span>
              {num(b.rating)}
              <span className="act-card-count">({b.reviews})</span>
            </span>
          ) : (
            <span className="act-card-rating new">{C.newP}</span>
          )}
        </div>
        <p className="baker-tag">{L(b.tagline)}</p>
        <div className="act-card-meta">
          <Icon name="pin" />
          <span className="baker-city">{b.city}</span>
          <span aria-hidden="true">·</span>
          <span>{b.specialties.map((c) => catName(c, lang)).slice(0, 2).join(", ")}</span>
        </div>
        <div className="act-card-row act-card-foot">
          <span className="act-card-price">
            {cheapest ? (
              <>
                <small>{C.from} </small>
                <b>{fmt(cheapest.price)}</b> <small>{C.unit[cheapest.unit]}</small>
              </>
            ) : (
              <small>{C.lead(b.leadDays)}</small>
            )}
          </span>
          {b.verified && (
            <span className="act-card-ok">
              <Icon name="check" /> {C.verified}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Karte eines Angebots mit Anfrageknopf */
export function SweetCard({
  s,
  onAsk,
  showBaker = true,
  actions,
}: {
  s: Sweet;
  onAsk?: (s: Sweet) => void;
  showBaker?: boolean;
  actions?: React.ReactNode;
}) {
  const { L, fmt, lang } = useShowly();
  const C = useSweetsCopy();
  const b = bakerOf(s.bakerId);
  const min = C.min(s.minQty, s.unit);
  return (
    <article className="act-card prod-card sweet-card" id={"sweet-" + s.id}>
      <div className="act-card-media prod-media">
        <div className="act-card-img" style={sweetBg(s)} />
        <span className="act-card-badge prod-badge">{catName(s.cat, lang)}</span>
      </div>
      <div className="act-card-body">
        <h3 className="act-card-name prod-name">{L(s.name)}</h3>
        {showBaker && b && (
          <Link className="prod-for sweet-baker" to="/torten/$id" params={{ id: String(b.id) }}>
            <Icon name={b.kind === "private" ? "heart" : "crown"} />
            <span>
              {L(b.name)} · {b.city}
            </span>
            <Icon name="arrow" />
          </Link>
        )}
        <p className="sweet-desc">{L(s.desc)}</p>
        <div className="prod-price">
          <span>
            <b>{fmt(s.price)}</b> {C.unit[s.unit]}
          </span>
          {min && <span className="sweet-min">{min}</span>}
        </div>
        {actions ?? (
          <div className="prod-btns one">
            <button className="prod-btn solid" onClick={() => onAsk?.(s)}>
              <Icon name="mail" />
              {C.ask}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function RequestModal({ s, onClose }: { s: Sweet; onClose: () => void }) {
  const okText = useContactCheck();
  const { L, fmt, toast, session, addCartRequest, setCartOpen } = useShowly();
  const C = useSweetsCopy();
  const R = C.req;
  const b = bakerOf(s.bakerId);
  const [date, setDate] = useState("");
  const [qty, setQty] = useState(s.unit === "set" ? 1 : s.minQty);
  const [city, setCity] = useState(b?.city ?? "");
  const [wishes, setWishes] = useState("");
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [direct, setDirect] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const minQty = s.unit === "set" ? 1 : s.minQty;
  const est = estimate(s, qty);

  /* In den Warenkorb: Name und E-Mail kommen dann an der Kasse dazu */
  function toCart() {
    if (!date) return toast(R.needDate);
    if (!okText(wishes)) return;
    if (b && date < addDays(b.leadDays)) return toast(R.tooSoon(b.leadDays));
    addCartRequest({
      sweetId: s.id,
      bakerId: s.bakerId,
      dateISO: date,
      qty: Math.max(minQty, qty),
      city: city.trim().slice(0, 80),
      wishes: wishes.trim().slice(0, 800),
      estimate: estimate(s, Math.max(minQty, qty)),
    });
    toast(R.inCart);
    onClose();
    setCartOpen(true);
  }

  function send() {
    if (!date || !name.trim() || !email.trim()) return toast(R.need);
    if (!okText(wishes)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast(R.mail);
    if (b && date < addDays(b.leadDays)) return toast(R.tooSoon(b.leadDays));
    addRequest({
      sweetId: s.id,
      bakerId: s.bakerId,
      dateISO: date,
      qty: Math.max(minQty, qty),
      city: city.trim().slice(0, 80),
      wishes: wishes.trim().slice(0, 800),
      name: name.trim().slice(0, 80),
      email: email.trim().slice(0, 120),
      estimate: est,
    });
    toast(R.done);
    onClose();
  }

  return (
    <div className="feed26-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="feed26-sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="req-h">
        <header className="feed26-sheet-head">
          <button className="feed26-x" onClick={onClose} aria-label="✕">
            <Icon name="close" />
          </button>
          <h2 id="req-h">{R.h}</h2>
          <span />
        </header>
        <div className="feed26-sheet-body">
          <div className="req-item">
            <span className="req-img" style={sweetBg(s)} />
            <span>
              <b>{L(s.name)}</b>
              {b && (
                <em>
                  {L(b.name)} · {b.city} · {C.lead(b.leadDays)}
                </em>
              )}
            </span>
          </div>
          <div className="pe-grid2">
            <div className="pe-field req-date">
              <span className="pe-label">{R.date}</span>
              <DateField value={date} onChange={setDate} label={R.date} />
            </div>
            <label className="pe-field">
              <span className="pe-label">{R.qty(s.unit)}</span>
              <input
                type="number"
                min={minQty}
                max={s.unit === "set" ? 20 : 2000}
                value={qty}
                onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                onBlur={() => setQty((q) => Math.max(minQty, q))}
              />
            </label>
          </div>
          <label className="pe-field">
            <span className="pe-label">{R.city}</span>
            <input value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="pe-field">
            <span className="pe-label">{R.wishes}</span>
            <textarea value={wishes} maxLength={800} placeholder={R.wishesPh} onChange={(e) => setWishes(e.target.value)} />
            <ContactHint text={wishes} />
          </label>
          <div className="req-sum">
            <span>
              <b>{R.estimate}</b>
              <em>{R.estimateP}</em>
            </span>
            <strong>{fmt(est)}</strong>
          </div>
          <div className="req-actions">
            <button className="home-btn primary" onClick={toCart}>
              <Icon name="cart" />
              {R.toCart}
            </button>
            <button className={"home-btn soft" + (direct ? " on" : "")} onClick={() => setDirect((d) => !d)} aria-expanded={direct}>
              {R.direct}
            </button>
          </div>
          {direct && (
          <>
          <p className="pe-hint">{R.directP}</p>
          <div className="pe-grid2">
            <label className="pe-field">
              <span className="pe-label">{R.name}</span>
              <input value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{R.email}</span>
              <input type="email" value={email} maxLength={120} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <button className="home-btn primary req-send" onClick={send}>
            {R.send}
            <Icon name="send" />
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Eigene Anfragen aus diesem Browser */
export function MyRequests({ bakerId }: { bakerId?: number }) {
  const { L, fmt, lang } = useShowly();
  const C = useSweetsCopy();
  const [list, setList] = useState<SweetRequest[]>([]);
  useEffect(() => {
    const load = () => setList(listRequests().filter((r) => bakerId === undefined || r.bakerId === bakerId));
    load();
    window.addEventListener("focus", load);
    const iv = window.setInterval(load, 1500);
    return () => {
      window.removeEventListener("focus", load);
      window.clearInterval(iv);
    };
  }, [bakerId]);
  if (!list.length) return null;
  const locale = lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE";
  return (
    <section className="my-req" data-reveal>
      <h2>{C.mine}</h2>
      <ul>
        {list.slice(0, 6).map((r) => {
          const b = bakerOf(r.bakerId);
          return (
            <li key={r.id}>
              <span>
                <b>{b ? L(b.name) : "—"}</b>
                <em>
                  {new Date(r.dateISO + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {fmt(r.estimate)}
                </em>
              </span>
              <span className={"my-req-st " + r.status}>{C.status[r.status]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
