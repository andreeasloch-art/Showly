/* Bausteine der Sparte Locations: Texte, Kartenbild, Karte und die
 * Vorschläge im Suchfeld. Rechnen und Prüfen: showly/locations.ts. */
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { DemoBadge } from "@/components/showly/DemoBadge";
import {
  OCCASIONS,
  capacityOf,
  fromPriceOf,
  kindOf,
  suggestVenues,
  type Suggestion,
  type Venue,
} from "@/showly/locations";
import { VENUES } from "@/showly/venues";

type Lang = "de" | "en" | "es";

export const VENUE_COPY = {
  de: {
    tab: "Locations",
    eyebrow: "Locations",
    h1a: "Der richtige Ort",
    h1b: "für deine Feier",
    lead: "Indoor-Spielplätze, Wasserparks, Säle, Restaurants und Gärten. Freie Termine sehen, Preis sofort berechnen, sicher buchen.",
    what: "Was suchst du?",
    whatPh: "z. B. Indoor-Spielplatz, Hochzeitssaal",
    when: "Wann?",
    where: "Wo?",
    wherePh: "Stadt",
    guests: "Gäste",
    search: "Locations finden",
    all: "Alle",
    occasions: "Anlass",
    results: (n: number) => (n === 1 ? "1 Location" : `${n} Locations`),
    none: "Keine Location passt zu deiner Suche. Probier eine andere Stadt oder weniger Filter.",
    reset: "Filter zurücksetzen",
    upTo: (n: number) => `bis ${n} Gäste`,
    from: "ab",
    unit: { hour: "/ Std.", flat: "Halbtag", person: "p. P.", event: "pauschal" } as Record<string, string>,
    rating: "Bewertung",
    isNew: "Neu",
    private: "Privat vermietet",
    offerH: "Du hast eine Location?",
    offerP: "Stell deinen Saal, dein Restaurant oder deinen Freizeitpark auf Showly ein. Die ersten 3 Monate ohne Provision.",
    offerBtn: "Location anbieten",
    weekBtn: "Location der Woche buchen",
    kinds: "Arten",
    places: "Locations",
    occ: "Anlässe",
    pick: "Wählen",
    noSug: "Keine passenden Vorschläge. Probier z. B. Spielplatz, Saal oder Restaurant.",
    hint: "Pfeiltasten zum Wechseln, Enter zum Auswählen.",
    count: (n: number) => (n === 1 ? "1 Location" : `${n} Locations`),
  },
  en: {
    tab: "Venues",
    eyebrow: "Venues",
    h1a: "The right place",
    h1b: "for your party",
    lead: "Indoor playgrounds, water parks, halls, restaurants and gardens. See free dates, get the price instantly, book safely.",
    what: "What are you looking for?",
    whatPh: "e.g. indoor playground, wedding venue",
    when: "When?",
    where: "Where?",
    wherePh: "City",
    guests: "Guests",
    search: "Find venues",
    all: "All",
    occasions: "Occasion",
    results: (n: number) => (n === 1 ? "1 venue" : `${n} venues`),
    none: "No venue matches your search. Try another city or fewer filters.",
    reset: "Reset filters",
    upTo: (n: number) => `up to ${n} guests`,
    from: "from",
    unit: { hour: "/ hr", flat: "half day", person: "pp", event: "flat" } as Record<string, string>,
    rating: "Rating",
    isNew: "New",
    private: "Private host",
    offerH: "Do you have a venue?",
    offerP: "List your hall, restaurant or leisure park on Showly. No commission for the first 3 months.",
    offerBtn: "List your venue",
    weekBtn: "Book venue of the week",
    kinds: "Types",
    places: "Venues",
    occ: "Occasions",
    pick: "Select",
    noSug: "No suggestions. Try playground, hall or restaurant.",
    hint: "Arrow keys to move, Enter to select.",
    count: (n: number) => (n === 1 ? "1 venue" : `${n} venues`),
  },
  es: {
    tab: "Lugares",
    eyebrow: "Lugares",
    h1a: "El sitio perfecto",
    h1b: "para tu fiesta",
    lead: "Parques infantiles, parques acuáticos, salones, restaurantes y jardines. Fechas libres, precio al instante, reserva segura.",
    what: "¿Qué buscas?",
    whatPh: "p. ej. parque infantil, salón de bodas",
    when: "¿Cuándo?",
    where: "¿Dónde?",
    wherePh: "Ciudad",
    guests: "Invitados",
    search: "Buscar lugares",
    all: "Todos",
    occasions: "Ocasión",
    results: (n: number) => (n === 1 ? "1 lugar" : `${n} lugares`),
    none: "Ningún lugar coincide. Prueba otra ciudad o menos filtros.",
    reset: "Quitar filtros",
    upTo: (n: number) => `hasta ${n} invitados`,
    from: "desde",
    unit: { hour: "/ h", flat: "medio día", person: "p. p.", event: "fijo" } as Record<string, string>,
    rating: "Valoración",
    isNew: "Nuevo",
    private: "Particular",
    offerH: "¿Tienes un local?",
    offerP: "Publica tu salón, restaurante o parque de ocio en Showly. Sin comisión los 3 primeros meses.",
    offerBtn: "Ofrecer mi local",
    weekBtn: "Reservar lugar de la semana",
    kinds: "Tipos",
    places: "Lugares",
    occ: "Ocasiones",
    pick: "Elegir",
    noSug: "Sin sugerencias. Prueba parque infantil, salón o restaurante.",
    hint: "Flechas para moverte, Enter para elegir.",
    count: (n: number) => (n === 1 ? "1 lugar" : `${n} lugares`),
  },
};

export function useVenueCopy() {
  const { lang } = useShowly();
  return VENUE_COPY[(lang as Lang) ?? "de"] ?? VENUE_COPY.de;
}

export const label = (x: { label: Record<Lang, string> }, lang: string) => x.label[(lang as Lang) ?? "de"] || x.label.de;

/** Bild einer Location: erstes eigenes Foto, sonst ein Farbverlauf in der
 *  Farbe der Location (das Symbol der Art liegt darüber) */
export function venueBg(v: Venue): CSSProperties {
  const first = v.photos?.find((m) => m.kind !== "video");
  const photo = first ? mediaBg(first.id) : null;
  if (photo) return photo;
  if (v.img)
    return {
      backgroundColor: "#2A1A6E",
      backgroundImage: `url("${v.img}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  const h = v.hue;
  return {
    background: `radial-gradient(120% 90% at 20% 10%, hsl(${(h + 30) % 360} 90% 72% / .95), transparent 60%), linear-gradient(135deg, hsl(${h} 78% 58%), hsl(${(h + 300) % 360} 70% 42%))`,
  };
}

export function hasPhoto(v: Venue) {
  return !!v.img || !!v.photos?.some((m) => m.kind !== "video");
}

/** Kartenbild mit Symbol, falls es noch kein Foto gibt */
export function VenueVisual({ v, className = "" }: { v: Venue; className?: string }) {
  return (
    <span className={"vn-visual " + className} style={venueBg(v)}>
      {!hasPhoto(v) && (
        <span className="vn-visual-ic" aria-hidden="true">
          <Icon name={kindOf(v.kind).icon} />
        </span>
      )}
    </span>
  );
}

export function priceText(v: Venue, fmt: (n: number) => string, C: (typeof VENUE_COPY)["de"]) {
  const p = fromPriceOf(v);
  return { from: C.from, price: fmt(p.price), unit: C.unit[p.unit] ?? "" };
}

export function VenueCard({ v }: { v: Venue }) {
  const { lang, fmt, num } = useShowly();
  const C = useVenueCopy();
  const k = kindOf(v.kind);
  const p = priceText(v, fmt, C);
  const cap = Math.max(capacityOf(v), ...v.packages.map((x) => x.maxGuests));
  return (
    <Link to="/locations/$id" params={{ id: String(v.id) }} className="vn-card">
      <span className="vn-card-img">
        <VenueVisual v={v} />
        <span className="vn-chip">
          <Icon name={k.icon} /> {label(k, lang)}
        </span>
        {v.demo && <DemoBadge className="on-card" />}
      </span>
      <span className="vn-card-body">
        <span className="vn-row">
          <b className="vn-name">{v.name}</b>
          {v.reviews > 0 ? (
            <span className="vn-rating">
              <span className="star">★</span> {num(v.rating)}
            </span>
          ) : (
            <span className="vn-rating">{C.isNew}</span>
          )}
        </span>
        <span className="vn-meta">
          <Icon name="pin" /> {[v.district, v.city].filter(Boolean).join(", ")}
          {cap > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <Icon name="users" /> {C.upTo(cap)}
            </>
          )}
        </span>
        <span className="vn-tag">{v.tagline}</span>
        <span className="vn-foot">
          <span className="vn-occ">
            {v.occasions.slice(0, 2).map((o) => {
              const x = OCCASIONS.find((y) => y.id === o);
              return x ? <span key={o}>{label(x, lang)}</span> : null;
            })}
          </span>
          <span className="vn-price">
            <small>{p.from}</small> <b>{p.price}</b> <small>{p.unit}</small>
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Suchfeld mit Vorschlägen: Arten, Anlässe und einzelne Locations */
export function VenueAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  list = VENUES,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  placeholder?: string;
  list?: Venue[];
}) {
  const { lang } = useShowly();
  const C = useVenueCopy();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rows = useMemo(() => suggestVenues(list, value, (lang as Lang) ?? "de", 8), [list, value, lang]);
  useEffect(() => setActive(0), [value]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function choose(s: Suggestion) {
    setOpen(false);
    onChange(s.type === "venue" ? "" : s.label);
    onPick(s);
  }
  function keys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) return setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const r = rows[active];
      if (open && r) {
        e.preventDefault();
        choose(r);
      }
    } else if (e.key === "Escape") setOpen(false);
  }
  const head = (t: Suggestion["type"]) => (t === "kind" ? C.kinds : t === "occasion" ? C.occ : C.places);

  return (
    <div className="ac-wrap aa-wrap" ref={wrap}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={keys}
        role="combobox"
        aria-expanded={open}
        aria-controls="vn-ac-list"
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && (
        <div className="ac-list aa-list" id="vn-ac-list" role="listbox" aria-label={C.what}>
          {rows.length === 0 && <div className="ac-empty">{C.noSug}</div>}
          {rows.map((r, i) => (
            <div key={r.type + r.id}>
              {(i === 0 || rows[i - 1]!.type !== r.type) && <div className="aa-head">{head(r.type)}</div>}
              <button
                type="button"
                className="aa-item aa-cat"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                <span className="aa-cat-icon">
                  <Icon name={r.icon} />
                </span>
                <span className="aa-text">
                  <span className="aa-name">{r.label}</span>
                  {r.type !== "venue" && <span className="aa-meta">{C.count(r.count)}</span>}
                </span>
                <span className="aa-price">{C.pick} →</span>
              </button>
            </div>
          ))}
          <div className="aa-hint">{C.hint}</div>
        </div>
      )}
    </div>
  );
}
