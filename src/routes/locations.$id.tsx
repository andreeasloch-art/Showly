import { seoHeadDe } from "@/showly/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, todayISO } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { DateField } from "@/components/showly/DateField";
import { DemoBadge } from "@/components/showly/DemoBadge";
import { CancelPolicyNote } from "@/components/showly/Fair";
import { ProductGallery, type Slide } from "@/components/showly/ProductSheet";
import { VenueCard, hasPhoto, label, useVenueCopy, venueBg } from "@/components/showly/Venue";
import {
  AMENITIES,
  OCCASIONS,
  RULES,
  capacityOf,
  dayOpen,
  kindOf,
  slotsFor,
  venueQuote,
  type Venue,
} from "@/showly/locations";
import { VENUES, findVenue } from "@/showly/venues";
import { FEE_RATE } from "@/showly/pricing";
import { useHydrated } from "@/showly/useHydrated";

export const Route = createFileRoute("/locations/$id")({
  head: ({ params }) => {
    const v = VENUES.find((x) => String(x.id) === params.id);
    return v
      ? seoHeadDe(`/locations/${v.id}`, `${v.name} – ${label(kindOf(v.kind), "de")} in ${v.city} mieten | Showly`, `${v.tagline}. ${v.city}${v.district ? `, ${v.district}` : ""}: freie Termine, Preis sofort berechnen und sicher buchen.`, { noindex: !!v.demo })
      : seoHeadDe(`/locations/${params.id}`, "Location | Showly", "Location auf Showly", { noindex: true });
  },
  component: VenuePage,
});

const D = {
  de: {
    back: "Alle Locations",
    seated: "Sitzplätze",
    standing: "Stehplätze",
    area: "Fläche",
    rooms: "Räume",
    book: "Termin & Preis",
    pkgs: "Pakete",
    perPerson: "p. P.",
    perEvent: "pauschal",
    hrs: (n: number) => `${n} Std.`,
    guests: "Gäste",
    date: "Datum",
    pickDate: "Bitte zuerst ein Datum wählen.",
    closed: "An diesem Tag ist die Location nicht buchbar.",
    noSlots: "An diesem Tag ist leider nichts mehr frei.",
    start: "Beginn",
    left: (n: number) => (n === 1 ? "noch 1 Platz" : `noch ${n} Plätze`),
    duration: "Dauer",
    extras: "Extras",
    occasion: "Anlass",
    notes: "Wünsche an die Location (ohne Kontaktdaten)",
    base: "Location",
    surcharge: (p: number) => `inkl. ${p > 0 ? "+" : ""}${p} % Wochenende/Saison`,
    total: "Gesamt",
    deposit: "Kaution (kommt nach dem Event zurück)",
    payNow: "Jetzt zu zahlen",
    add: "In den Warenkorb",
    ask: "Anfragen & reservieren",
    askNote: "Die Location bestätigt innerhalb von 48 Stunden. Sagt sie ab, bekommst du alles zurück.",
    tooMany: (n: number) => `Höchstens ${n} Gäste.`,
    minG: (n: number) => `Berechnet ab ${n} Gästen.`,
    about: "Über die Location",
    included: "Inklusive",
    rules: "Hausregeln",
    allowed: "Erlaubt",
    notAllowed: "Nicht erlaubt",
    musicUntil: (t: string) => `Musik bis ${t} Uhr`,
    minAge: (n: number) => `ab ${n} Jahren`,
    minSpend: (s: string) => `Mindestumsatz vor Ort: ${s} (Essen und Getränke)`,
    location: "Lage",
    address: "Die genaue Adresse, Anfahrt und den Ansprechpartner bekommst du nach der Buchung.",
    occasions: "Passt für",
    similar: "Ähnliche Locations",
    more: "Alles für deine Feier",
    moreP: "Künstler, Torte und Deko passend zum Termin dazubuchen.",
    acts: "Künstler finden",
    cakes: "Torten",
    deco: "Deko",
    safe: "Sicher über Showly",
    safeP: "Sagt die Location ab, bekommst du sofort dein Geld zurück und 3 freie Ersatz-Locations für denselben Tag vorgeschlagen. Die Kaution hält Showly und zahlt sie nach dem Event zurück.",
    privateHost: "Privat vermietet: keine gewerbliche Anbieterin, es gilt das gesetzliche Mietrecht.",
    request: "Mit Anfrage: erst nach Zusage verbindlich.",
    instant: "Sofort buchbar",
    notFound: "Diese Location gibt es nicht (mehr).",
    edit: "Location bearbeiten",
  },
  en: {
    back: "All venues",
    seated: "Seated",
    standing: "Standing",
    area: "Area",
    rooms: "Rooms",
    book: "Date & price",
    pkgs: "Packages",
    perPerson: "pp",
    perEvent: "flat",
    hrs: (n: number) => `${n} hrs`,
    guests: "Guests",
    date: "Date",
    pickDate: "Please pick a date first.",
    closed: "The venue can't be booked on this day.",
    noSlots: "Sorry, nothing left on this day.",
    start: "Start",
    left: (n: number) => (n === 1 ? "1 spot left" : `${n} spots left`),
    duration: "Duration",
    extras: "Extras",
    occasion: "Occasion",
    notes: "Wishes for the venue (no contact details)",
    base: "Venue",
    surcharge: (p: number) => `incl. ${p > 0 ? "+" : ""}${p}% weekend/season`,
    total: "Total",
    deposit: "Deposit (refunded after the event)",
    payNow: "To pay now",
    add: "Add to cart",
    ask: "Request & reserve",
    askNote: "The venue confirms within 48 hours. If it declines, you get everything back.",
    tooMany: (n: number) => `At most ${n} guests.`,
    minG: (n: number) => `Charged from ${n} guests.`,
    about: "About the venue",
    included: "Included",
    rules: "House rules",
    allowed: "Allowed",
    notAllowed: "Not allowed",
    musicUntil: (t: string) => `Music until ${t}`,
    minAge: (n: number) => `from age ${n}`,
    minSpend: (s: string) => `Minimum spend on site: ${s} (food and drinks)`,
    location: "Location",
    address: "You get the exact address, directions and contact person after booking.",
    occasions: "Great for",
    similar: "Similar venues",
    more: "Everything for your party",
    moreP: "Add artists, cake and decor for the same date.",
    acts: "Find artists",
    cakes: "Cakes",
    deco: "Decor",
    safe: "Safe with Showly",
    safeP: "If the venue cancels, you get your money back right away plus 3 free alternative venues for the same day. Showly holds the deposit and refunds it after the event.",
    privateHost: "Private host: not a business, statutory rental law applies.",
    request: "On request: binding only after confirmation.",
    instant: "Instant booking",
    notFound: "This venue doesn't exist (anymore).",
    edit: "Edit venue",
  },
  es: {
    back: "Todos los lugares",
    seated: "Sentados",
    standing: "De pie",
    area: "Superficie",
    rooms: "Salas",
    book: "Fecha y precio",
    pkgs: "Paquetes",
    perPerson: "p. p.",
    perEvent: "fijo",
    hrs: (n: number) => `${n} h`,
    guests: "Invitados",
    date: "Fecha",
    pickDate: "Elige primero una fecha.",
    closed: "Ese día no se puede reservar.",
    noSlots: "Ese día ya no queda nada libre.",
    start: "Inicio",
    left: (n: number) => (n === 1 ? "queda 1 plaza" : `quedan ${n} plazas`),
    duration: "Duración",
    extras: "Extras",
    occasion: "Ocasión",
    notes: "Deseos para el local (sin datos de contacto)",
    base: "Local",
    surcharge: (p: number) => `incl. ${p > 0 ? "+" : ""}${p} % fin de semana/temporada`,
    total: "Total",
    deposit: "Fianza (se devuelve tras el evento)",
    payNow: "A pagar ahora",
    add: "Añadir al carrito",
    ask: "Solicitar y reservar",
    askNote: "El local confirma en 48 horas. Si lo rechaza, te devolvemos todo.",
    tooMany: (n: number) => `Máximo ${n} invitados.`,
    minG: (n: number) => `Se cobra desde ${n} invitados.`,
    about: "Sobre el local",
    included: "Incluido",
    rules: "Normas",
    allowed: "Permitido",
    notAllowed: "No permitido",
    musicUntil: (t: string) => `Música hasta las ${t}`,
    minAge: (n: number) => `desde ${n} años`,
    minSpend: (s: string) => `Consumo mínimo en el local: ${s} (comida y bebida)`,
    location: "Ubicación",
    address: "Recibes la dirección exacta, cómo llegar y la persona de contacto tras reservar.",
    occasions: "Ideal para",
    similar: "Lugares similares",
    more: "Todo para tu fiesta",
    moreP: "Añade artistas, tarta y decoración para la misma fecha.",
    acts: "Buscar artistas",
    cakes: "Tartas",
    deco: "Decoración",
    safe: "Seguro con Showly",
    safeP: "Si el local cancela, te devolvemos el dinero al instante y te proponemos 3 lugares alternativos libres para el mismo día. Showly guarda la fianza y la devuelve tras el evento.",
    privateHost: "Particular: no es empresa, rige la ley de arrendamiento.",
    request: "Bajo solicitud: vinculante tras la confirmación.",
    instant: "Reserva inmediata",
    notFound: "Este lugar no existe.",
    edit: "Editar local",
  },
};

function VenuePage() {
  const { id } = Route.useParams();
  const hydrated = useHydrated();
  const v = useMemo(() => findVenue(Number(id)), [id, hydrated]);
  const { lang } = useShowly();
  const T = D[(lang as "de" | "en" | "es") ?? "de"] ?? D.de;
  if (!v)
    return (
      <div className="page active ui26 bk-page">
        <div className="bk-wrap">
          <div className="empty-state">
            <p>{T.notFound}</p>
            <Link className="btn-secondary" to="/locations">
              {T.back}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  return <VenueDetail v={v} />;
}

function VenueDetail({ v }: { v: Venue }) {
  const { lang, fmt, num, cartVenues, venueBookings, addCartVenue } = useShowly();
  const T = D[(lang as "de" | "en" | "es") ?? "de"] ?? D.de;
  const C = useVenueCopy();
  const k = kindOf(v.kind);
  const today = todayISO();

  const [pkg, setPkg] = useState<string | undefined>(v.packages[0]?.id);
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState(String(v.packages[0]?.minGuests ?? Math.min(20, capacityOf(v) || 20)));
  const [hours, setHours] = useState(Math.max(v.minHours, v.mode === "flat" ? 5 : 3));
  const [start, setStart] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [occasion, setOccasion] = useState(v.occasions[0] ?? "");
  const [notes, setNotes] = useState("");

  const p = v.packages.find((x) => x.id === pkg) ?? null;
  const dur = p ? p.hours : hours;
  /* Schon belegt: eigene Buchungen und Warenkorb (im Browser), der Server
     prüft beim Bezahlen noch einmal gegen alle Buchungen */
  const taken = useMemo(
    () => [
      ...venueBookings.filter((b) => b.venueId === v.id && b.dateISO === date && b.status !== "cancelled").map((b) => ({ start: b.start, hours: b.hours })),
      ...cartVenues.filter((b) => b.venueId === v.id && b.dateISO === date).map((b) => ({ start: b.start, hours: b.hours })),
    ],
    [venueBookings, cartVenues, v.id, date],
  );
  const slots = useMemo(() => (date ? slotsFor(v, date, dur, taken, today) : []), [v, date, dur, taken, today]);
  useEffect(() => {
    if (start && !slots.some((s) => s.start === start)) setStart("");
  }, [slots, start]);

  const q = venueQuote(v, { dateISO: date || today, start: start || "12:00", hours: dur, guests: Number(guests) || 1, pkg, extras }, FEE_RATE);
  const cap = p ? p.maxGuests : capacityOf(v);
  const minG = p ? p.minGuests : v.mode === "person" ? v.minGuests : 0;
  const canAdd = !!date && !!start && q.ok && q.total > 0;

  const slides: Slide[] = (v.photos || []).filter((m) => m.kind !== "video").length
    ? (v.photos || []).filter((m) => m.kind !== "video").map((m) => ({ key: m.id, media: m }))
    : [{ key: "main", style: venueBg(v) }];
  const similar = VENUES.filter((x) => x.id !== v.id && (x.kind === v.kind || kindOf(x.kind).group === k.group)).slice(0, 3);

  function add() {
    if (!canAdd) return;
    addCartVenue({
      venueId: v.id,
      dateISO: date,
      start,
      hours: q.hours,
      guests: q.guests,
      ...(pkg ? { pkg } : {}),
      ...(extras.length ? { extras } : {}),
      ...(occasion ? { occasion: label(OCCASIONS.find((o) => o.id === occasion)!, "de") } : {}),
      ...(notes.trim() ? { notes: notes.trim().slice(0, 1000) } : {}),
    });
  }

  const ruleList = RULES.filter((r) => typeof v.rules[r.id] === "boolean");

  return (
    <div className="page active ui26 bk-page vn-detail">
      <div className="bk-wrap">
        <div className="bk-crumbs">
          <Link to="/locations">
            <Icon name="arrow" /> {T.back}
          </Link>
        </div>

        <div className="vn-gallery">
          <ProductGallery slides={slides} alt={v.name} />
          {!hasPhoto(v) && (
            <span className="vn-visual-ic big" aria-hidden="true">
              <Icon name={k.icon} />
            </span>
          )}
        </div>

        <div className="bk-layout vn-layout">
          <div className="bk-body">
            <header className="vn-head">
              <span className="vn-kind">
                <Icon name={k.icon} /> {label(k, lang)}
              </span>
              {v.demo && <DemoBadge />}
              <h1>{v.name}</h1>
              <p className="vn-sub">
                <Icon name="pin" /> {[v.district, v.city].filter(Boolean).join(", ")}
                {v.reviews > 0 && (
                  <>
                    {" "}
                    · <span className="star">★</span> {num(v.rating)} ({v.reviews})
                  </>
                )}
              </p>
              <p className="vn-tagline">{v.tagline}</p>
            </header>

            <ul className="vn-facts">
              {v.seated > 0 && (
                <li>
                  <Icon name="chair" />
                  <b>{v.seated}</b>
                  <span>{T.seated}</span>
                </li>
              )}
              {v.standing > 0 && (
                <li>
                  <Icon name="users" />
                  <b>{v.standing}</b>
                  <span>{T.standing}</span>
                </li>
              )}
              {v.areaM2 > 0 && (
                <li>
                  <Icon name="ruler" />
                  <b>{v.areaM2.toLocaleString("de-DE")} m²</b>
                  <span>{T.area}</span>
                </li>
              )}
              <li>
                <Icon name={v.instant ? "check" : "clock"} />
                <b>{v.instant ? T.instant : "48 h"}</b>
                <span>{v.instant ? "" : T.request}</span>
              </li>
            </ul>

            {v.packages.length > 0 && (
              <section className="vn-sec">
                <h2>{T.pkgs}</h2>
                <div className="vn-pkgs" role="radiogroup">
                  {v.packages.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      role="radio"
                      aria-checked={pkg === x.id}
                      className={"vn-pkg" + (pkg === x.id ? " on" : "")}
                      onClick={() => {
                        setPkg(x.id);
                        if (Number(guests) < x.minGuests) setGuests(String(x.minGuests));
                      }}
                    >
                      <span className="vn-pkg-top">
                        <b>{x.name}</b>
                        <span className="vn-pkg-price">
                          {fmt(x.price)} <small>{x.per === "person" ? T.perPerson : T.perEvent}</small>
                        </span>
                      </span>
                      <span className="vn-pkg-meta">
                        {T.hrs(x.hours)} · {x.minGuests}–{x.maxGuests} {T.guests}
                      </span>
                      <ul>
                        {x.includes.map((i) => (
                          <li key={i}>
                            <Icon name="check" /> {i}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="vn-sec">
              <h2>{T.about}</h2>
              <p className="vn-about">{v.about}</p>
              {(v.minAge || v.notes || v.musicUntil || v.minSpend) && (
                <ul className="vn-notes">
                  {v.minAge ? (
                    <li>
                      <Icon name="users" /> {T.minAge(v.minAge)}
                    </li>
                  ) : null}
                  {v.musicUntil && (
                    <li>
                      <Icon name="band" /> {T.musicUntil(v.musicUntil)}
                    </li>
                  )}
                  {v.minSpend ? (
                    <li>
                      <Icon name="fork" /> {T.minSpend(fmt(v.minSpend))}
                    </li>
                  ) : null}
                  {v.notes && (
                    <li>
                      <Icon name="clipboard" /> {v.notes}
                    </li>
                  )}
                </ul>
              )}
              {!v.business && <p className="vn-private">{T.privateHost}</p>}
            </section>

            {v.amenities.length > 0 && (
              <section className="vn-sec">
                <h2>{T.included}</h2>
                <ul className="vn-amen">
                  {AMENITIES.filter((a) => v.amenities.includes(a.id)).map((a) => (
                    <li key={a.id}>
                      <Icon name={a.icon} /> {label(a, lang)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ruleList.length > 0 && (
              <section className="vn-sec">
                <h2>{T.rules}</h2>
                <ul className="vn-rules">
                  {ruleList.map((r) => (
                    <li key={r.id} className={v.rules[r.id] ? "yes" : "no"}>
                      <span className="vn-rule-ic" aria-label={v.rules[r.id] ? T.allowed : T.notAllowed}>
                        <Icon name={v.rules[r.id] ? "check" : "close"} />
                      </span>
                      {label(r, lang)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="vn-sec">
              <h2>{T.occasions}</h2>
              <div className="vn-occ-list">
                {v.occasions.map((o) => {
                  const x = OCCASIONS.find((y) => y.id === o);
                  return x ? (
                    <Link key={o} to="/locations" search={{ anlass: o }} className="occ-chip">
                      {label(x, lang)}
                    </Link>
                  ) : null;
                })}
              </div>
            </section>

            <section className="vn-sec">
              <h2>{T.location}</h2>
              <p className="vn-where">
                <Icon name="pin" /> <b>{[v.district, v.city].filter(Boolean).join(", ")}</b>
              </p>
              <p className="vn-muted">
                <Icon name="lock" /> {T.address}
              </p>
            </section>

            <section className="vn-sec vn-safe">
              <span className="vn-safe-ic" aria-hidden="true">
                <Icon name="shield" />
              </span>
              <div>
                <h2>{T.safe}</h2>
                <p>{T.safeP}</p>
              </div>
            </section>
            <CancelPolicyNote tier={v.cancelTier} />
          </div>

          <aside className="bk-side vn-side">
            <div className="vn-book">
              <h2>{T.book}</h2>
              <div className="vn-field vn-date">
                <DateField value={date} onChange={setDate} label={T.date} />
              </div>
              {date && !dayOpen(v, date, today) && <p className="vn-warn">{T.closed}</p>}

              <label className="vn-field">
                <span>{T.guests}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={cap || 2000}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </label>
              {q.error === "guests" && <p className="vn-warn">{T.tooMany(cap)}</p>}
              {minG > 1 && Number(guests) < minG && <p className="vn-muted">{T.minG(minG)}</p>}

              {!p && (
                <label className="vn-field">
                  <span>{T.duration}</span>
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {Array.from({ length: 16 - v.minHours + 1 }, (_, i) => v.minHours + i).map((h) => (
                      <option key={h} value={h}>
                        {T.hrs(h)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="vn-field">
                <span>{T.start}</span>
                {!date ? (
                  <p className="vn-muted">{T.pickDate}</p>
                ) : slots.length === 0 ? (
                  dayOpen(v, date, today) && <p className="vn-warn">{T.noSlots}</p>
                ) : (
                  <div className="vn-slots">
                    {slots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        className={"vn-slot" + (start === s.start ? " on" : "")}
                        aria-pressed={start === s.start}
                        onClick={() => setStart(s.start)}
                      >
                        <b>{s.start}</b>
                        {v.parallel > 1 && <small>{T.left(s.free)}</small>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {v.extras.length > 0 && (
                <div className="vn-field">
                  <span>{T.extras}</span>
                  <div className="vn-extras">
                    {v.extras.map((x) => (
                      <label key={x.id} className="vn-extra">
                        <input
                          type="checkbox"
                          checked={extras.includes(x.id)}
                          onChange={(e) => setExtras((l) => (e.target.checked ? [...l, x.id] : l.filter((y) => y !== x.id)))}
                        />
                        <span>{x.name}</span>
                        <small>
                          {fmt(x.price)} {x.per === "person" ? T.perPerson : x.per === "hour" ? C.unit["hour"] : ""}
                        </small>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {v.occasions.length > 0 && (
                <label className="vn-field">
                  <span>{T.occasion}</span>
                  <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                    {OCCASIONS.filter((o) => v.occasions.includes(o.id)).map((o) => (
                      <option key={o.id} value={o.id}>
                        {label(o, lang)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="vn-field">
                <span>{T.notes}</span>
                <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>

              <div className="vn-sum">
                <div>
                  <span>
                    {T.base}
                    {p ? ` · ${p.name}` : ""} ({T.hrs(q.hours)}, {q.guests} {T.guests})
                    {q.surchargePct !== 0 && <small> {T.surcharge(q.surchargePct)}</small>}
                  </span>
                  <b>{fmt(q.base)}</b>
                </div>
                {q.extras.map((e) => (
                  <div key={e.id}>
                    <span>{e.name}</span>
                    <b>{fmt(e.amount)}</b>
                  </div>
                ))}
                {q.deposit > 0 && (
                  <div className="muted">
                    <span>{T.deposit}</span>
                    <b>{fmt(q.deposit)}</b>
                  </div>
                )}
                <div className="total">
                  <span>{T.payNow}</span>
                  <b>{fmt(q.total + q.deposit)}</b>
                </div>
              </div>
              <button className="btn-primary vn-add" disabled={!canAdd} onClick={add}>
                <Icon name="cart" /> {v.instant ? T.add : T.ask}
              </button>
              {!v.instant && <p className="vn-muted small">{T.askNote}</p>}
            </div>

            <div className="vn-more">
              <b>{T.more}</b>
              <p>{T.moreP}</p>
              <div className="vn-more-btns">
                <Link to="/" className="occ-chip">
                  <Icon name="mask" /> {T.acts}
                </Link>
                <Link to="/torten" className="occ-chip">
                  <Icon name="cake" /> {T.cakes}
                </Link>
                <Link to="/shop" search={{ bereich: "deko" } as never} className="occ-chip">
                  <Icon name="sparkle" /> {T.deco}
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="vn-similar">
            <h2>{T.similar}</h2>
            <div className="vn-grid">
              {similar.map((x) => (
                <VenueCard key={x.id} v={x} />
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}
