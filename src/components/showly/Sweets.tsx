/* Bausteine für Torten & Süßes: Texte, Anbieterkarte, Angebotskarte,
   Anfrage-Fenster und die Liste eigener Anfragen. */
import { QuoteDecision } from "./QuoteDecision";
import { CancelPolicyNote, ComplaintForm } from "./Fair";
import { complaintOpen, policySnapshot } from "@/showly/policies";
import { DemoBadge } from "@/components/showly/DemoBadge";
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
  foodOf,
  isDirectSweet,
  leadOf,
} from "@/showly/sweets";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";
import { FoodFacts, useFoodCopy } from "@/components/showly/FoodInfo";
import { ALLERGEN_LABEL, foodInfoComplete } from "@/showly/cakeRules";
import { Chat } from "@/components/showly/Chat";

export const SWEETS_COPY = {
  de: {
    eyebrow: "Torten, Kuchen & Candy Bars",
    h1: "Süßes für dein Event",
    sub: "Feste Pakete wie Macarons oder Cupcakes direkt buchen, Hochzeits- und Motivtorten bei Konditoreien und privaten Bäckerinnen und Bäckern anfragen.",
    ph: "Torte, Anbieter oder Stadt …",
    trust1: "Pakete zum Festpreis direkt buchen",
    trust2: "Konditoreien und Privatpersonen",
    trust3: "Wunschtorten: Absage oder günstiger = Geld zurück",
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
    ask: "Bestellen",
    book: "Direkt buchen",
    badgeDirect: "Sofort buchbar",
    bookH: "Direkt buchen",
    fixed: "Festpreis",
    fixedP:
      "Fester Preis. Bezahlt wird an der Kasse, zusammen mit allem anderen im Warenkorb.",
    inCartDirect: "Liegt im Warenkorb. Bezahlt wird an der Kasse.",
    msgs: "Nachrichten",
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
    status: {
      sent: "Wartet auf Zusage",
      quoted: "Neuer Preis – bitte bestätigen",
      confirmed: "Zugesagt",
      declined: "Abgesagt",
      booked: "Gebucht",
    } as Record<SweetRequest["status"], string>,
    req: {
      h: "Wunschtorte bestellen",
      needDate: "Bitte ein Datum wählen.",
      toCart: "In den Warenkorb",
      direct: "Nur anfragen, ohne Warenkorb",
      directP: "Die Anfrage geht sofort an den Anbieter. Deine Kontaktdaten:",
      inCart: "Liegt im Warenkorb. Du bezahlst den Richtpreis an der Kasse.",
      date: "Datum",
      qty: (u: Unit) => (u === "person" ? "Personen" : u === "piece" ? "Stück" : "Anzahl"),
      city: "Ort der Feier",
      wishes: "Wünsche",
      wishesPh: "Geschmack, Farben, Allergien, Text auf der Torte …",
      name: "Dein Name",
      email: "E-Mail",
      estimate: "Richtpreis",
      estimateP: "Du bezahlst den Richtpreis sofort. Die Konditorei bestätigt den Endpreis: günstiger = Differenz zurück, teurer = du bestätigst und zahlst nach, Absage = alles zurück.",
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
    sub: "Book fixed packages like macarons or cupcakes directly, request wedding and themed cakes from patisseries and home bakers near you.",
    ph: "Cake, baker or city …",
    trust1: "Book packages at a fixed price",
    trust2: "Patisseries and home bakers",
    trust3: "Custom cakes: declined or cheaper = money back",
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
    ask: "Order",
    book: "Book now",
    badgeDirect: "Instant booking",
    bookH: "Book now",
    fixed: "Fixed price",
    fixedP:
      "Fixed price. You pay at checkout together with everything else in your cart.",
    inCartDirect: "Added to your cart. You pay at checkout.",
    msgs: "Messages",
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
    status: {
      sent: "Awaiting confirmation",
      quoted: "New price – please confirm",
      confirmed: "Confirmed",
      declined: "Declined",
      booked: "Booked",
    } as Record<SweetRequest["status"], string>,
    req: {
      h: "Order a custom cake",
      needDate: "Please pick a date.",
      toCart: "Add to cart",
      direct: "Just send a request",
      directP: "The request goes straight to the baker. Your contact details:",
      inCart: "Added to your cart. You pay the estimate at checkout.",
      date: "Date",
      qty: (u: Unit) => (u === "person" ? "Guests" : u === "piece" ? "Pieces" : "Quantity"),
      city: "Party location",
      wishes: "Wishes",
      wishesPh: "Flavour, colours, allergies, text on the cake …",
      name: "Your name",
      email: "Email",
      estimate: "Estimate",
      estimateP: "You pay the estimate now. The baker confirms the final price: lower = difference refunded, higher = you confirm and pay the rest, declined = full refund.",
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
    sub: "Reserva al momento paquetes como macarons o cupcakes y pide tartas de boda o temáticas a pastelerías y reposteros cerca de ti.",
    ph: "Tarta, repostero o ciudad …",
    trust1: "Paquetes a precio fijo, al momento",
    trust2: "Pastelerías y particulares",
    trust3: "Tartas a medida: si rechaza o baja el precio, te devolvemos",
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
    ask: "Pedir",
    book: "Reservar ya",
    badgeDirect: "Reserva inmediata",
    bookH: "Reservar ya",
    fixed: "Precio fijo",
    fixedP:
      "Precio fijo. Pagas en la caja junto con todo lo demás del carrito.",
    inCartDirect: "Está en el carrito. Pagas en la caja.",
    msgs: "Mensajes",
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
    status: {
      sent: "Espera confirmación",
      quoted: "Nuevo precio: confírmalo",
      confirmed: "Confirmada",
      declined: "Rechazada",
      booked: "Reservada",
    } as Record<SweetRequest["status"], string>,
    req: {
      h: "Pedir tarta a medida",
      needDate: "Elige una fecha.",
      toCart: "Añadir al carrito",
      direct: "Solo solicitar",
      directP: "La solicitud va directamente al repostero. Tus datos:",
      inCart: "Añadido al carrito. Pagas el precio orientativo al finalizar.",
      date: "Fecha",
      qty: (u: Unit) => (u === "person" ? "Personas" : u === "piece" ? "Unidades" : "Cantidad"),
      city: "Lugar de la fiesta",
      wishes: "Deseos",
      wishesPh: "Sabor, colores, alergias, texto en la tarta …",
      name: "Tu nombre",
      email: "Correo",
      estimate: "Precio orientativo",
      estimateP: "Pagas ahora el precio orientativo. El repostero confirma el precio final: menor = te devolvemos la diferencia, mayor = lo confirmas y pagas el resto, rechazo = te devolvemos todo.",
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
        {b.demo && <DemoBadge className="on-card" />}
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
        <span className="act-card-badge prod-badge">
          {catName(s.cat, lang)}
        </span>
        {isDirectSweet(s) && (
          <span className="sweet-direct">{C.badgeDirect}</span>
        )}
      </div>
      <div className="act-card-body">
        <h3 className="act-card-name prod-name">
          {/* Die ganze Karte führt zum Profil des Anbieters, auch bei Angeboten
              zum Direktbuchen: dort sieht man, wer es anbietet, alle Infos und
              die übrigen Angebote. Das Angebot selbst wird dort angesteuert.
              Der Verweis spannt sich per ::after über die Karte; Anbieterzeile
              und Knopf liegen darüber. Im Profil selbst bleibt es Text. */}
          {showBaker && b ? (
            <Link
              className="act-card-link sweet-card-link"
              to="/torten/$id"
              params={{ id: String(b.id) }}
              search={{ angebot: s.id }}
            >
              {L(s.name)}
            </Link>
          ) : (
            L(s.name)
          )}
        </h3>
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
        <AllergenLine s={s} />
        <div className="prod-price">
          <span>
            <b>{fmt(s.price)}</b> {C.unit[s.unit]}
          </span>
          {min && <span className="sweet-min">{min}</span>}
        </div>
        {actions ?? (
          <div className="prod-btns one">
            <button className="prod-btn solid" onClick={() => onAsk?.(s)}>
              <Icon name={isDirectSweet(s) ? "cart" : "mail"} />
              {isDirectSweet(s) ? C.book : C.ask}
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

/* Torten nach Wunsch: Größe (Personen), Etagen, Geschmack, Füllung, Aufschrift */
const CUSTOM_CATS: SweetCat[] = ["wedding", "birthday", "motif"];
/* Übergabe der Torte: Abholung oder Lieferung, Zeitfenster, Kühlkette */
const HANDOVER = {
  de: {
    label: "Übergabe",
    pickup: "Abholung",
    delivery: "Lieferung",
    upTo: (km: number) => `bis ${km} km`,
    window: "Lieferfenster",
    pickupTime: "Abholzeit",
    any: "nach Absprache",
    clock: "Uhr",
    cool: "Kühlkette: Bei Abholung bitte gekühlt transportieren; bei Lieferung ist der Anbieter bis zur Übergabe verantwortlich.",
  },
  en: {
    label: "Handover",
    pickup: "Pickup",
    delivery: "Delivery",
    upTo: (km: number) => `up to ${km} km`,
    window: "Delivery window",
    pickupTime: "Pickup time",
    any: "to be agreed",
    clock: "",
    cool: "Cold chain: please keep it chilled when you pick it up; for delivery the baker is responsible until handover.",
  },
  es: {
    label: "Entrega",
    pickup: "Recogida",
    delivery: "Envío",
    upTo: (km: number) => `hasta ${km} km`,
    window: "Franja de entrega",
    pickupTime: "Hora de recogida",
    any: "a convenir",
    clock: "h",
    cool: "Cadena de frío: si la recoges, transpórtala refrigerada; con envío, el proveedor responde hasta la entrega.",
  },
};

const CFG = {
  de: {
    h: "Deine Torte",
    tiers: "Etagen",
    flavor: "Geschmack",
    flavorPh: "z. B. Schokolade, Vanille",
    filling: "Füllung",
    fillingPh: "z. B. Himbeer-Sahne",
    text: "Aufschrift",
    textPh: "z. B. Alles Gute, Mia!",
    photo: "Eine Bildvorlage für das Motiv kannst du nach der Zusage mit dem Anbieter im Chat abstimmen.",
  },
  en: {
    h: "Your cake",
    tiers: "Tiers",
    flavor: "Flavour",
    flavorPh: "e.g. chocolate, vanilla",
    filling: "Filling",
    fillingPh: "e.g. raspberry cream",
    text: "Inscription",
    textPh: "e.g. Happy birthday, Mia!",
    photo: "You can agree on a picture template for the design with the baker in the chat after confirmation.",
  },
  es: {
    h: "Tu tarta",
    tiers: "Pisos",
    flavor: "Sabor",
    flavorPh: "p. ej. chocolate, vainilla",
    filling: "Relleno",
    fillingPh: "p. ej. nata con frambuesa",
    text: "Texto",
    textPh: "p. ej. ¡Feliz cumple, Mia!",
    photo: "La plantilla de imagen para el motivo la acuerdas con el proveedor en el chat después de la confirmación.",
  },
} as const;

/** Kurzzeile auf der Karte: enthaltene Hauptallergene */
function AllergenLine({ s }: { s: Sweet }) {
  const { lang } = useShowly();
  const f = foodOf(s);
  if (!foodInfoComplete(f)) return null;
  const l = (lang as "de" | "en" | "es") ?? "de";
  const label = l === "en" ? "Allergens" : l === "es" ? "Alérgenos" : "Allergene";
  return (
    <p className="sweet-allergens">
      {label}: {f.noAllergens ? "–" : f.allergens.map((a) => ALLERGEN_LABEL[a][l].split(" (")[0]).join(", ")}
    </p>
  );
}

export function RequestModal({ s, onClose }: { s: Sweet; onClose: () => void }) {
  const okText = useContactCheck();
  const F = useFoodCopy();
  const { L, fmt, toast, session, addCartRequest, setCartOpen, lang } = useShowly();
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
  /* Torten-Konfigurator (nur Torten nach Wunsch) */
  const custom = CUSTOM_CATS.includes(s.cat);
  const [cfg, setCfg] = useState({ tiers: "1", flavor: "", filling: "", text: "" });
  /* Übergabe: Abholung oder Lieferung (nur im Liefergebiet) und Zeitfenster */
  const canDeliver = (b?.radiusKm ?? 0) > 0;
  const [handover, setHandover] = useState<"pickup" | "delivery">("pickup");
  const [slot, setSlot] = useState("");
  const H = HANDOVER[(lang as "de" | "en" | "es") ?? "de"] ?? HANDOVER.de;
  const K = CFG[(lang as "de" | "en" | "es") ?? "de"] ?? CFG.de;
  const food = foodOf(s);
  /* Lebensmittelrecht: ohne Allergen- und Zutatenangaben kein Verkauf */
  const foodOk = foodInfoComplete(food);
  const lead = leadOf(s);
  /* Festpreis-Paket: kommt als Buchung in den Warenkorb und wird bezahlt */
  const fixed = isDirectSweet(s);
  const allWishes = () =>
    `${H.label}: ${handover === "delivery" ? H.delivery : H.pickup}${slot ? `, ${slot} ${H.clock}` : ""}\n` +
    (custom
      ? [
          `${K.tiers}: ${cfg.tiers}`,
          cfg.flavor.trim() && `${K.flavor}: ${cfg.flavor.trim()}`,
          cfg.filling.trim() && `${K.filling}: ${cfg.filling.trim()}`,
          cfg.text.trim() && `${K.text}: „${cfg.text.trim()}“`,
        ]
          .filter(Boolean)
          .join(" · ") + (wishes.trim() ? "\n" : "")
      : "") + wishes.trim();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const minQty = s.unit === "set" ? 1 : s.minQty;
  const est = estimate(s, qty);

  /* In den Warenkorb: Name und E-Mail kommen dann an der Kasse dazu */
  function toCart() {
    if (!foodOk && !b?.demo) return toast(F.missing);
    if (!date) return toast(R.needDate);
    if (!okText(wishes, cfg.flavor, cfg.filling, cfg.text)) return;
    if (date < addDays(lead)) return toast(R.tooSoon(lead));
    addCartRequest({
      sweetId: s.id,
      bakerId: s.bakerId,
      dateISO: date,
      qty: Math.max(minQty, qty),
      city: city.trim().slice(0, 80),
      wishes: allWishes().slice(0, 800),
      estimate: estimate(s, Math.max(minQty, qty)),
      ...(fixed ? { direct: true } : {}),
    });
    toast(fixed ? C.inCartDirect : R.inCart);
    onClose();
    setCartOpen(true);
  }

  function send() {
    if (!foodOk && !b?.demo) return toast(F.missing);
    if (!date || !name.trim() || !email.trim()) return toast(R.need);
    if (!okText(wishes, cfg.flavor, cfg.filling, cfg.text)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast(R.mail);
    if (date < addDays(lead)) return toast(R.tooSoon(lead));
    addRequest({
      sweetId: s.id,
      bakerId: s.bakerId,
      dateISO: date,
      qty: Math.max(minQty, qty),
      city: city.trim().slice(0, 80),
      wishes: allWishes().slice(0, 800),
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
          <h2 id="req-h">{fixed ? C.bookH : R.h}</h2>
          <span />
        </header>
        <div className="feed26-sheet-body">
          <div className="req-item">
            <span className="req-img" style={sweetBg(s)} />
            <span>
              <b>{L(s.name)}</b>
              {b && (
                <em>
                  {L(b.name)} · {b.city} · {C.lead(lead)}
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
          <div className="pe-grid2">
            <label className="pe-field">
              <span className="pe-label">{H.label}</span>
              <select value={handover} onChange={(e) => setHandover(e.target.value as "pickup" | "delivery")}>
                <option value="pickup">{H.pickup}</option>
                {canDeliver && (
                  <option value="delivery">
                    {H.delivery} ({H.upTo(b?.radiusKm ?? 0)})
                  </option>
                )}
              </select>
            </label>
            <label className="pe-field">
              <span className="pe-label">{handover === "delivery" ? H.window : H.pickupTime}</span>
              <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                <option value="">{H.any}</option>
                {["09–12", "12–15", "15–18", "18–20"].map((w) => (
                  <option key={w} value={w}>
                    {w} {H.clock}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="pe-hint">{H.cool}</p>
          {custom && (
            <fieldset className="cake-cfg">
              <legend className="pe-label">{K.h}</legend>
              <div className="pe-grid2">
                <label className="pe-field">
                  <span className="pe-label">{K.tiers}</span>
                  <select value={cfg.tiers} onChange={(e) => setCfg({ ...cfg, tiers: e.target.value })}>
                    {["1", "2", "3", "4", "5"].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pe-field">
                  <span className="pe-label">{K.flavor}</span>
                  <input value={cfg.flavor} maxLength={60} placeholder={K.flavorPh} onChange={(e) => setCfg({ ...cfg, flavor: e.target.value })} />
                </label>
                <label className="pe-field">
                  <span className="pe-label">{K.filling}</span>
                  <input value={cfg.filling} maxLength={60} placeholder={K.fillingPh} onChange={(e) => setCfg({ ...cfg, filling: e.target.value })} />
                </label>
                <label className="pe-field">
                  <span className="pe-label">{K.text}</span>
                  <input value={cfg.text} maxLength={60} placeholder={K.textPh} onChange={(e) => setCfg({ ...cfg, text: e.target.value })} />
                </label>
              </div>
              <ContactHint text={[cfg.flavor, cfg.filling, cfg.text].join("\n")} />
              {s.cat === "motif" && <p className="pe-hint">{K.photo}</p>}
            </fieldset>
          )}
          <label className="pe-field">
            <span className="pe-label">{R.wishes}</span>
            <textarea value={wishes} maxLength={800} placeholder={R.wishesPh} onChange={(e) => setWishes(e.target.value)} />
            <ContactHint text={wishes} />
          </label>
          <FoodFacts f={food} demo={b?.demo} />
          <CancelPolicyNote policy={policySnapshot("cake", "moderat", lead)} compact />
          <div className="req-sum">
            <span>
              <b>{fixed ? C.fixed : R.estimate}</b>
              <em>{fixed ? C.fixedP : R.estimateP}</em>
            </span>
            <strong>{fmt(est)}</strong>
          </div>
          <div className="req-actions">
            <button className="home-btn primary" onClick={toCart}>
              <Icon name="cart" />
              {R.toCart}
            </button>
          </div>
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
  /* Nachrichten an den Anbieter */
  const [chatFor, setChatFor] = useState<SweetRequest | null>(null);
  /* Reklamation bis 48 Stunden nach dem Liefertag (Foto Pflicht) */
  const [complain, setComplain] = useState<string | null>(null);
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
              {r.status === "quoted" && <QuoteDecision r={r} />}
              {r.status !== "declined" && (
                <button type="button" className="dash26-mini outline chat26-open" onClick={() => setChatFor(r)}>
                  <Icon name="comment" /> {C.msgs}
                </button>
              )}
              {r.id.startsWith("db-") &&
                (r.status === "confirmed" || r.status === "booked") &&
                complaintOpen(new Date(r.dateISO + "T23:59:00").getTime(), Date.now()) &&
                (complain === r.id ? (
                  <ComplaintForm refTo={{ kind: "sweet", id: Number(r.id.slice(3)) }} onDone={() => setComplain(null)} />
                ) : (
                  <button type="button" className="dash26-mini outline" onClick={() => setComplain(r.id)}>
                    Reklamieren
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      {chatFor && (
        <Chat
          sweetId={chatFor.id}
          as="customer"
          heading={`${(() => {
            const b = bakerOf(chatFor.bakerId);
            return b ? String(L(b.name)) : "";
          })()} · ${new Date(chatFor.dateISO + "T12:00:00").toLocaleDateString(locale)}`}
          onClose={() => setChatFor(null)}
        />
      )}
    </section>
  );
}
