/* Locations: Räume, Säle, Restaurants und Freizeitanbieter für Feiern.
 *
 * Eine Location gehört einem Anbieter (gewerblich oder privat). Sie hat
 * Eckdaten (Plätze, Fläche, Ausstattung, Hausregeln), einen Wochenplan mit
 * buchbaren Zeiten und ein Preismodell:
 *
 *  - hour:    Preis je Stunde, mit Mindestdauer
 *  - flat:    Halbtag (bis 5 Std.) oder Ganztag als Pauschale
 *  - person:  Preis je Gast, mit Mindestzahl
 *  - Pakete:  für Freizeitanbieter (Indoor-Spielplatz, Wasserpark …), etwa
 *             „Kindergeburtstag Premium: 3 Std., Partytisch, Essen“, je Kind
 *             oder als Festpreis, in festen Zeitfenstern
 *
 * Dazu kommen Extras (je Event, je Gast oder je Stunde), Wochenend- und
 * Saisonzuschläge (surcharges.ts) und eine Kaution, die Showly hält und nach
 * dem Event zurückzahlt.
 *
 * Zeitfenster: Entweder feste Startzeiten (Freizeit: „10:00, 14:00“) mit
 * mehreren Plätzen gleichzeitig (Partytische), oder frei wählbar innerhalb
 * der Öffnungszeiten; zwischen zwei Buchungen liegt ein Reinigungspuffer.
 *
 * Die genaue Adresse steht nur beim Anbieter und geht dem Kunden erst nach
 * der Zahlung zu; öffentlich sind Stadt und Stadtteil.
 *
 * Rein und getestet (locations.test.ts); Browser und Server rechnen gleich. */
import { cleanSurcharges, withSurcharge, type Surcharges } from "./surcharges";

type Lang = "de" | "en" | "es";
type Txt = Record<Lang, string>;
const t = (de: string, en: string, es: string): Txt => ({ de, en, es });

/* ---------------------------------------------------------------- Arten */

export type VenueGroup = "raum" | "gastro" | "freizeit" | "draussen";

export const VENUE_GROUPS: { id: VenueGroup; icon: string; label: Txt }[] = [
  { id: "raum", icon: "hall", label: t("Säle & Räume", "Halls & rooms", "Salones y salas") },
  { id: "gastro", icon: "fork", label: t("Restaurants & Bars", "Restaurants & bars", "Restaurantes y bares") },
  { id: "freizeit", icon: "slide", label: t("Freizeit & Erlebnis", "Leisure & fun", "Ocio y aventura") },
  { id: "draussen", icon: "sun", label: t("Draußen", "Outdoors", "Al aire libre") },
];

export const VENUE_KINDS: { id: string; group: VenueGroup; icon: string; label: Txt; words?: string }[] = [
  { id: "saal", group: "raum", icon: "hall", label: t("Eventsaal", "Event hall", "Salón de eventos"), words: "festsaal veranstaltungsraum partyraum" },
  { id: "hochzeitssaal", group: "raum", icon: "heart", label: t("Hochzeitssaal", "Wedding venue", "Salón de bodas"), words: "hochzeit trauung" },
  { id: "halle", group: "raum", icon: "hall", label: t("Halle", "Hall", "Nave"), words: "eventhalle fabrikhalle" },
  { id: "loft", group: "raum", icon: "venue", label: t("Loft", "Loft", "Loft"), words: "industrie studio" },
  { id: "scheune", group: "raum", icon: "venue", label: t("Scheune", "Barn", "Granero"), words: "landhaus gut hof" },
  { id: "vereinsheim", group: "raum", icon: "users", label: t("Vereinsheim", "Club house", "Local social"), words: "gemeindesaal bürgerhaus" },
  { id: "seminarraum", group: "raum", icon: "chair", label: t("Seminarraum", "Meeting room", "Sala de reuniones"), words: "tagung workshop konferenz" },
  { id: "dachterrasse", group: "raum", icon: "sun", label: t("Dachterrasse", "Rooftop", "Azotea"), words: "rooftop terrasse" },
  { id: "restaurant", group: "gastro", icon: "fork", label: t("Restaurant", "Restaurant", "Restaurante"), words: "essen lokal gasthaus wirtshaus" },
  { id: "cafe", group: "gastro", icon: "cake", label: t("Café", "Café", "Cafetería"), words: "kaffee" },
  { id: "bar", group: "gastro", icon: "party", label: t("Bar & Club", "Bar & club", "Bar y club"), words: "club disco lounge" },
  { id: "biergarten", group: "gastro", icon: "sun", label: t("Biergarten", "Beer garden", "Cervecería al aire libre"), words: "brauerei" },
  { id: "weingut", group: "gastro", icon: "tree", label: t("Weingut", "Winery", "Bodega"), words: "wein vinothek" },
  { id: "schiff", group: "gastro", icon: "water", label: t("Schiff & Boot", "Boat", "Barco"), words: "boot yacht ausflugsschiff" },
  { id: "indoorspielplatz", group: "freizeit", icon: "slide", label: t("Indoor-Spielplatz", "Indoor playground", "Parque infantil cubierto"), words: "spielplatz kinder spielhalle" },
  { id: "trampolinhalle", group: "freizeit", icon: "slide", label: t("Trampolinhalle", "Trampoline park", "Parque de trampolines"), words: "trampolin jump" },
  { id: "kletterhalle", group: "freizeit", icon: "trophy", label: t("Kletterhalle", "Climbing gym", "Rocódromo"), words: "klettern bouldern" },
  { id: "wasserpark", group: "freizeit", icon: "water", label: t("Wasserpark", "Water park", "Parque acuático"), words: "erlebnisbad rutschen spaßbad" },
  { id: "schwimmbad", group: "freizeit", icon: "water", label: t("Schwimmbad & Therme", "Pool & spa", "Piscina y termas"), words: "bad therme hallenbad" },
  { id: "bowling", group: "freizeit", icon: "trophy", label: t("Bowling", "Bowling", "Bolera"), words: "kegeln" },
  { id: "lasertag", group: "freizeit", icon: "sparkle", label: t("Lasertag", "Laser tag", "Laser tag"), words: "laser" },
  { id: "escaperoom", group: "freizeit", icon: "key", label: t("Escape Room", "Escape room", "Escape room"), words: "rätsel exit" },
  { id: "minigolf", group: "freizeit", icon: "trophy", label: t("Minigolf", "Mini golf", "Minigolf"), words: "golf schwarzlicht" },
  { id: "kartbahn", group: "freizeit", icon: "trophy", label: t("Kartbahn", "Go-kart track", "Karting"), words: "kart" },
  { id: "zoo", group: "freizeit", icon: "bunny", label: t("Zoo & Tierpark", "Zoo", "Zoo"), words: "tiere wildpark" },
  { id: "bauernhof", group: "freizeit", icon: "tree", label: t("Bauernhof & Reiterhof", "Farm & riding", "Granja y equitación"), words: "pony reiten hof" },
  { id: "kino", group: "freizeit", icon: "play", label: t("Kino", "Cinema", "Cine"), words: "film" },
  { id: "museum", group: "freizeit", icon: "image", label: t("Museum", "Museum", "Museo"), words: "ausstellung" },
  { id: "kochschule", group: "freizeit", icon: "fork", label: t("Koch- & Backschule", "Cooking school", "Escuela de cocina"), words: "kochen backen kochkurs" },
  { id: "werkstatt", group: "freizeit", icon: "wand", label: t("Bastel- & Töpferwerkstatt", "Craft studio", "Taller creativo"), words: "basteln töpfern malen" },
  { id: "garten", group: "draussen", icon: "tree", label: t("Garten & Wiese", "Garden", "Jardín"), words: "park wiese" },
  { id: "grillplatz", group: "draussen", icon: "sun", label: t("Grillplatz & Hütte", "BBQ area & hut", "Zona de barbacoa"), words: "grillhütte hütte" },
  { id: "sonstiges", group: "raum", icon: "venue", label: t("Sonstiges", "Other", "Otro") },
];

export const kindOf = (id: string) => VENUE_KINDS.find((k) => k.id === id) ?? VENUE_KINDS[VENUE_KINDS.length - 1]!;

/* -------------------------------------------------------------- Anlässe */

export const OCCASIONS: { id: string; icon: string; label: Txt; words?: string }[] = [
  { id: "kindergeburtstag", icon: "bunny", label: t("Kindergeburtstag", "Kids' birthday", "Cumpleaños infantil"), words: "kinder party geburtstag" },
  { id: "geburtstag", icon: "cake", label: t("Geburtstag", "Birthday", "Cumpleaños"), words: "party" },
  { id: "hochzeit", icon: "heart", label: t("Hochzeit", "Wedding", "Boda"), words: "trauung heiraten" },
  { id: "firmenfeier", icon: "users", label: t("Firmenfeier", "Company party", "Fiesta de empresa"), words: "betriebsfeier teamevent sommerfest" },
  { id: "weihnachtsfeier", icon: "tree", label: t("Weihnachtsfeier", "Christmas party", "Cena de Navidad"), words: "advent" },
  { id: "jga", icon: "party", label: t("Junggesellenabschied", "Bachelor party", "Despedida de soltero"), words: "jga" },
  { id: "taufe", icon: "sparkle", label: t("Taufe & Kommunion", "Christening", "Bautizo y comunión"), words: "konfirmation kommunion" },
  { id: "babyparty", icon: "heart", label: t("Babyparty", "Baby shower", "Baby shower"), words: "babyshower" },
  { id: "jubilaeum", icon: "trophy", label: t("Jubiläum", "Anniversary", "Aniversario"), words: "jahrestag" },
  { id: "abschluss", icon: "crown", label: t("Abschlussfeier", "Graduation", "Graduación"), words: "abiball abschluss" },
  { id: "workshop", icon: "chair", label: t("Workshop & Tagung", "Workshop & meeting", "Taller y reunión"), words: "seminar meeting" },
];

/* ----------------------------------------------------------- Ausstattung */

export const AMENITIES: { id: string; icon: string; label: Txt }[] = [
  { id: "stuehle", icon: "chair", label: t("Stühle", "Chairs", "Sillas") },
  { id: "tische", icon: "chair", label: t("Tische", "Tables", "Mesas") },
  { id: "stehtische", icon: "chair", label: t("Stehtische", "Bar tables", "Mesas altas") },
  { id: "baenke", icon: "chair", label: t("Bierbänke", "Benches", "Bancos") },
  { id: "tischdecken", icon: "sparkle", label: t("Tischdecken", "Tablecloths", "Manteles") },
  { id: "geschirr", icon: "fork", label: t("Geschirr, Gläser, Besteck", "Tableware", "Vajilla y cubiertos") },
  { id: "theke", icon: "party", label: t("Bar / Theke", "Bar counter", "Barra") },
  { id: "kueche", icon: "fork", label: t("Küche", "Kitchen", "Cocina") },
  { id: "kuehlschrank", icon: "fork", label: t("Kühlschrank", "Fridge", "Nevera") },
  { id: "musik", icon: "band", label: t("Musikanlage", "Sound system", "Equipo de sonido") },
  { id: "mikrofon", icon: "mic", label: t("Mikrofon", "Microphone", "Micrófono") },
  { id: "beamer", icon: "play", label: t("Beamer & Leinwand", "Projector & screen", "Proyector y pantalla") },
  { id: "buehne", icon: "star", label: t("Bühne", "Stage", "Escenario") },
  { id: "tanzflaeche", icon: "dancer", label: t("Tanzfläche", "Dance floor", "Pista de baile") },
  { id: "licht", icon: "sparkle", label: t("Lichttechnik", "Lighting", "Iluminación") },
  { id: "wlan", icon: "globe", label: t("WLAN", "Wi-Fi", "Wifi") },
  { id: "garderobe", icon: "dress", label: t("Garderobe", "Cloakroom", "Guardarropa") },
  { id: "heizung", icon: "sun", label: t("Heizung", "Heating", "Calefacción") },
  { id: "klima", icon: "sun", label: t("Klimaanlage", "Air conditioning", "Aire acondicionado") },
  { id: "wc", icon: "venue", label: t("Toiletten", "Toilets", "Baños") },
  { id: "wickeltisch", icon: "heart", label: t("Wickeltisch", "Changing table", "Cambiador") },
  { id: "spielecke", icon: "slide", label: t("Spielecke", "Play corner", "Rincón de juegos") },
  { id: "aussenbereich", icon: "tree", label: t("Außenbereich", "Outdoor area", "Zona exterior") },
  { id: "parken", icon: "pin", label: t("Parkplätze", "Parking", "Aparcamiento") },
  { id: "oepnv", icon: "pin", label: t("Gute Bus-/Bahnanbindung", "Public transport", "Transporte público") },
  { id: "stufenlos", icon: "check", label: t("Stufenloser Zugang", "Step-free access", "Acceso sin escalones") },
  { id: "rollstuhl_wc", icon: "check", label: t("Rollstuhlgerechtes WC", "Accessible toilet", "Baño accesible") },
  { id: "aufzug", icon: "check", label: t("Aufzug", "Lift", "Ascensor") },
];

/* Hausregeln: ja/nein, angezeigt als Erlaubt / Nicht erlaubt */
export const RULES: { id: string; label: Txt }[] = [
  { id: "eigenesEssen", label: t("Eigenes Essen / Catering", "Own food / catering", "Comida / catering propio") },
  { id: "eigeneGetraenke", label: t("Eigene Getränke", "Own drinks", "Bebidas propias") },
  { id: "eigeneDeko", label: t("Eigene Deko", "Own decorations", "Decoración propia") },
  { id: "konfetti", label: t("Konfetti", "Confetti", "Confeti") },
  { id: "kerzen", label: t("Kerzen", "Candles", "Velas") },
  { id: "nebel", label: t("Nebelmaschine", "Fog machine", "Máquina de humo") },
  { id: "liveMusik", label: t("Live-Musik / DJ", "Live music / DJ", "Música en directo / DJ") },
  { id: "haustiere", label: t("Haustiere", "Pets", "Mascotas") },
  { id: "rauchen", label: t("Rauchen (draußen)", "Smoking (outside)", "Fumar (fuera)") },
];

/* ------------------------------------------------------------ Datentypen */

export type PriceMode = "hour" | "flat" | "person";
export type ExtraPer = "event" | "person" | "hour";

export interface VenueExtra {
  id: string;
  name: string;
  price: number;
  per: ExtraPer;
}

export interface VenuePackage {
  id: string;
  name: string;
  desc?: string | undefined;
  /** was drin ist, je Zeile ein Punkt */
  includes: string[];
  price: number;
  /** je Gast (Kind) oder Festpreis für die Feier */
  per: "person" | "event";
  minGuests: number;
  maxGuests: number;
  hours: number;
}

/** Wochenplan: Index 0 = Montag … 6 = Sonntag; null = geschlossen */
export type WeekHours = ({ from: string; to: string } | null)[];

export interface Venue {
  id: number;
  kind: string;
  /** gewerblich oder privat (Gartenhaus, Vereinsheim …) */
  business: boolean;
  name: string;
  city: string;
  /** öffentlich: Stadtteil oder Umgebung */
  district: string;
  /** nur Anbieter und Kunde nach der Zahlung */
  address?: string | undefined;
  tagline: string;
  about: string;
  occasions: string[];
  seated: number;
  standing: number;
  areaM2: number;
  rooms: number;
  indoor: boolean;
  outdoor: boolean;
  amenities: string[];
  /** Hausregeln: erlaubt (true) oder nicht (false) */
  rules: Record<string, boolean>;
  musicUntil?: string | undefined;
  /** Freizeit: Mindestalter, Hinweise (Socken, Badekleidung …) */
  minAge?: number | undefined;
  notes?: string | undefined;
  /** Restaurants: Mindestumsatz vor Ort (Info, wird nicht online bezahlt) */
  minSpend?: number | undefined;

  mode: PriceMode;
  /** hour: je Stunde · flat: Halbtag · person: je Gast */
  price: number;
  /** flat: Ganztag */
  priceFull?: number | undefined;
  minHours: number;
  minGuests: number;
  packages: VenuePackage[];
  extras: VenueExtra[];
  surcharges?: Surcharges | null | undefined;
  deposit: number;

  week: WeekHours;
  /** feste Startzeiten (Freizeit); leer = frei wählbar in den Öffnungszeiten */
  slots: string[];
  /** Feiern gleichzeitig je Zeitfenster (Partytische), Standard 1 */
  parallel: number;
  bufferMin: number;
  leadDays: number;
  maxMonths: number;
  blocked: string[];
  instant: boolean;
  cancelTier: "flexibel" | "moderat" | "streng";

  rating: number;
  reviews: number;
  verified: boolean;
  demo?: boolean | undefined;
  own?: boolean | undefined;
  /** Bildfarbe für Karten ohne Foto */
  hue: number;
  photos?: { id: string; kind: "image" | "video"; ratio: number }[] | undefined;
}

export const MAX_GUESTS = 2000;
export const MAX_VENUE_HOURS = 16;
export const HALF_DAY_HOURS = 5;

export const capacityOf = (v: Pick<Venue, "seated" | "standing">) => Math.max(v.seated || 0, v.standing || 0);

/* -------------------------------------------------------------- Rechnen */

export interface VenueLine {
  venueId: number;
  dateISO: string;
  start: string;
  hours: number;
  guests: number;
  pkg?: string | undefined;
  extras?: string[] | undefined;
}

export interface VenueQuote {
  ok: boolean;
  error?: "guests" | "hours" | "pkg" | undefined;
  hours: number;
  guests: number;
  base: number;
  extras: { id: string; name: string; amount: number }[];
  extrasTotal: number;
  surchargePct: number;
  /** was der Kunde für die Location zahlt (ohne Kaution) */
  total: number;
  deposit: number;
  fee: number;
  payout: number;
  pkg: VenuePackage | null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Preis einer Buchung. Gäste und Stunden werden auf die Grenzen der
 *  Location gesetzt; was nicht passt, meldet `error`. */
export function venueQuote(v: Venue, l: Omit<VenueLine, "venueId">, feeRate = 0.2): VenueQuote {
  const pkg = l.pkg ? (v.packages.find((p) => p.id === l.pkg) ?? null) : null;
  let error: VenueQuote["error"];
  if (l.pkg && !pkg) error = "pkg";
  const cap = pkg ? pkg.maxGuests : capacityOf(v) || MAX_GUESTS;
  const minG = pkg ? pkg.minGuests : v.mode === "person" ? v.minGuests : 1;
  let guests = Math.max(1, Math.round(Number(l.guests) || 0));
  if (guests > cap) error = error ?? "guests";
  guests = Math.min(cap, guests);
  const billedGuests = Math.max(minG, guests);
  let hours = pkg ? pkg.hours : Math.round(Number(l.hours) || 0);
  if (!pkg) {
    if (hours > MAX_VENUE_HOURS) error = error ?? "hours";
    hours = Math.min(MAX_VENUE_HOURS, Math.max(v.minHours || 1, hours || 1));
  }

  let raw: number;
  if (pkg) raw = pkg.per === "person" ? pkg.price * billedGuests : pkg.price;
  else if (v.mode === "hour") raw = v.price * hours;
  else if (v.mode === "flat") raw = hours <= HALF_DAY_HOURS ? v.price : (v.priceFull ?? v.price);
  else raw = v.price * billedGuests;

  const sc = cleanSurcharges(v.surcharges);
  const base = round2(withSurcharge(raw, sc, l.dateISO));
  const surchargePct = raw > 0 ? Math.round(((base - raw) / raw) * 100) : 0;

  const picked = new Set(l.extras || []);
  const extras = v.extras
    .filter((e) => picked.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      amount: round2(e.per === "event" ? e.price : e.per === "person" ? e.price * guests : e.price * hours),
    }));
  const extrasTotal = round2(extras.reduce((n, e) => n + e.amount, 0));
  const total = round2(base + extrasTotal);
  const fee = round2(total * feeRate);
  return {
    ok: !error,
    ...(error ? { error } : {}),
    hours,
    guests,
    base,
    extras,
    extrasTotal,
    surchargePct,
    total,
    deposit: Math.max(0, v.deposit || 0),
    fee,
    payout: round2(total - fee),
    pkg,
  };
}

/** Ab-Preis für die Karte */
export function fromPriceOf(v: Venue): { price: number; unit: "hour" | "flat" | "person" | "event" } {
  if (v.packages.length) {
    const p = v.packages.reduce((a, b) => (b.price < a.price ? b : a));
    return { price: p.price, unit: p.per === "person" ? "person" : "event" };
  }
  return { price: v.price, unit: v.mode };
}

/* ---------------------------------------------------------- Kalender */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;
export const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const toHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Wochentag 0 = Montag … 6 = Sonntag */
export function weekdayOf(dateISO: string): number {
  return (new Date(dateISO + "T12:00:00Z").getUTCDay() + 6) % 7;
}

export function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ist der Tag überhaupt buchbar (geöffnet, Vorlauf, nicht zu weit, nicht gesperrt)? */
export function dayOpen(v: Venue, dateISO: string, today: string): boolean {
  if (!ISO.test(dateISO)) return false;
  if (dateISO < addDays(today, Math.max(0, v.leadDays))) return false;
  if (dateISO > addDays(today, Math.max(1, v.maxMonths) * 31)) return false;
  if (v.blocked.includes(dateISO)) return false;
  return !!v.week[weekdayOf(dateISO)];
}

export interface Taken {
  start: string;
  hours: number;
}

export interface SlotInfo {
  start: string;
  /** freie Plätze (Partytische) für diese Startzeit */
  free: number;
}

/** Buchbare Startzeiten an einem Tag für eine Dauer. Bei festen Zeitfenstern
 *  zählen gleichzeitige Feiern gegen `parallel`; bei frei wählbaren Zeiten
 *  darf sich nichts überschneiden (mit Reinigungspuffer). */
export function slotsFor(v: Venue, dateISO: string, hours: number, taken: Taken[], today: string): SlotInfo[] {
  if (!dayOpen(v, dateISO, today)) return [];
  const day = v.week[weekdayOf(dateISO)]!;
  const open = toMin(day.from);
  let close = toMin(day.to);
  if (close <= open) close += 24 * 60; // bis nach Mitternacht
  const dur = Math.max(1, hours) * 60;
  const buf = Math.max(0, v.bufferMin);
  const parallel = Math.max(1, v.parallel || 1);
  const busy = taken.map((x) => ({ a: toMin(x.start), b: toMin(x.start) + Math.max(1, x.hours) * 60 }));
  const overlaps = (a: number, b: number) => busy.filter((x) => a < x.b + buf && x.a < b + buf).length;

  const starts = v.slots.length
    ? v.slots.filter((s) => HM.test(s)).map(toMin).sort((a, b) => a - b)
    : Array.from({ length: Math.max(0, Math.floor((close - dur - open) / 30) + 1) }, (_, i) => open + i * 30);
  const out: SlotInfo[] = [];
  for (const a of starts) {
    if (a < open || a + dur > close) continue;
    const free = parallel - overlaps(a, a + dur);
    if (free > 0) out.push({ start: toHM(a % (24 * 60)), free });
  }
  return out;
}

/* ------------------------------------------------------------ Prüfen */

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ids = (v: unknown, allowed: { id: string }[], max = 40) =>
  (Array.isArray(v) ? v : []).map(String).filter((x) => allowed.some((a) => a.id === x)).slice(0, max);

function cleanWeek(v: unknown): WeekHours {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = arr[i] as { from?: unknown; to?: unknown } | null | undefined;
    if (!d || !HM.test(String(d.from)) || !HM.test(String(d.to))) return null;
    return { from: String(d.from), to: String(d.to) };
  });
}

/** Angaben einer Location aus Formular oder Datenbank bereinigen (Server und Browser) */
export function cleanVenue(raw: Record<string, unknown>, id: number): Venue {
  const mode: PriceMode = raw["mode"] === "flat" || raw["mode"] === "person" ? (raw["mode"] as PriceMode) : "hour";
  const packages = (Array.isArray(raw["packages"]) ? raw["packages"] : [])
    .slice(0, 6)
    .map((p: Record<string, unknown>, i: number): VenuePackage => {
      const minGuests = num(p["minGuests"], 1, MAX_GUESTS, 1);
      return {
        id: str(p["id"], 20) || `p${i + 1}`,
        name: str(p["name"], 60),
        desc: str(p["desc"], 300) || undefined,
        includes: (Array.isArray(p["includes"]) ? p["includes"] : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 12),
        price: num(p["price"], 0, 100000, 0),
        per: p["per"] === "event" ? "event" : "person",
        minGuests,
        maxGuests: Math.max(minGuests, num(p["maxGuests"], 1, MAX_GUESTS, 30)),
        hours: num(Math.round(Number(p["hours"])), 1, MAX_VENUE_HOURS, 3),
      };
    })
    .filter((p) => p.name && p.price > 0);
  const extras = (Array.isArray(raw["extras"]) ? raw["extras"] : [])
    .slice(0, 20)
    .map((e: Record<string, unknown>, i: number): VenueExtra => ({
      id: str(e["id"], 20) || `x${i + 1}`,
      name: str(e["name"], 60),
      price: num(e["price"], 0, 50000, 0),
      per: e["per"] === "person" || e["per"] === "hour" ? (e["per"] as ExtraPer) : "event",
    }))
    .filter((e) => e.name && e.price > 0);
  const rulesRaw = (raw["rules"] && typeof raw["rules"] === "object" ? raw["rules"] : {}) as Record<string, unknown>;
  const rules: Record<string, boolean> = {};
  for (const r of RULES) if (typeof rulesRaw[r.id] === "boolean") rules[r.id] = rulesRaw[r.id] as boolean;
  const kind = VENUE_KINDS.some((k) => k.id === raw["kind"]) ? String(raw["kind"]) : "sonstiges";
  const seated = num(raw["seated"], 0, MAX_GUESTS, 0);
  const standing = num(raw["standing"], 0, MAX_GUESTS, 0);
  const tier = raw["cancelTier"] === "flexibel" || raw["cancelTier"] === "streng" ? raw["cancelTier"] : "moderat";
  return {
    id,
    kind,
    business: raw["business"] !== false,
    name: str(raw["name"], 80),
    city: str(raw["city"], 60),
    district: str(raw["district"], 60),
    ...(str(raw["address"], 200) ? { address: str(raw["address"], 200) } : {}),
    tagline: str(raw["tagline"], 120),
    about: str(raw["about"], 2000),
    occasions: ids(raw["occasions"], OCCASIONS),
    seated,
    standing,
    areaM2: num(raw["areaM2"], 0, 100000, 0),
    rooms: num(raw["rooms"], 1, 50, 1),
    indoor: raw["indoor"] !== false,
    outdoor: raw["outdoor"] === true,
    amenities: ids(raw["amenities"], AMENITIES, 60),
    rules,
    ...(HM.test(String(raw["musicUntil"])) ? { musicUntil: String(raw["musicUntil"]) } : {}),
    ...(raw["minAge"] != null && Number(raw["minAge"]) > 0 ? { minAge: num(raw["minAge"], 0, 99, 0) } : {}),
    ...(str(raw["notes"], 400) ? { notes: str(raw["notes"], 400) } : {}),
    ...(Number(raw["minSpend"]) > 0 ? { minSpend: num(raw["minSpend"], 0, 100000, 0) } : {}),
    mode,
    price: num(raw["price"], 0, 100000, 0),
    ...(Number(raw["priceFull"]) > 0 ? { priceFull: num(raw["priceFull"], 0, 100000, 0) } : {}),
    minHours: num(Math.round(Number(raw["minHours"])), 1, MAX_VENUE_HOURS, 1),
    minGuests: num(Math.round(Number(raw["minGuests"])), 1, MAX_GUESTS, 1),
    packages,
    extras,
    surcharges: cleanSurcharges(raw["surcharges"]),
    deposit: num(raw["deposit"], 0, 10000, 0),
    week: cleanWeek(raw["week"]),
    slots: (Array.isArray(raw["slots"]) ? raw["slots"] : []).map(String).filter((s) => HM.test(s)).slice(0, 12),
    parallel: num(Math.round(Number(raw["parallel"])), 1, 50, 1),
    bufferMin: num(Math.round(Number(raw["bufferMin"])), 0, 600, 60),
    leadDays: num(Math.round(Number(raw["leadDays"])), 0, 365, 2),
    maxMonths: num(Math.round(Number(raw["maxMonths"])), 1, 24, 12),
    blocked: (Array.isArray(raw["blocked"]) ? raw["blocked"] : []).map(String).filter((d) => ISO.test(d)).slice(0, 400),
    instant: raw["instant"] !== false,
    cancelTier: tier as Venue["cancelTier"],
    rating: num(raw["rating"], 0, 5, 0),
    reviews: num(raw["reviews"], 0, 100000, 0),
    verified: raw["verified"] === true,
    hue: num(raw["hue"], 0, 360, 262),
    ...(Array.isArray(raw["photos"])
      ? {
          photos: (raw["photos"] as { id?: unknown; kind?: unknown; ratio?: unknown }[])
            .filter((m) => m && typeof m.id === "string")
            .slice(0, 12)
            .map((m) => ({ id: String(m.id), kind: m.kind === "video" ? ("video" as const) : ("image" as const), ratio: Number(m.ratio) || 1.5 })),
        }
      : {}),
  };
}

/** Ohne Adresse, für alle sichtbar */
export function publicVenue(v: Venue): Venue {
  const { address: _a, ...rest } = v;
  return rest;
}

/* ------------------------------------------------------------ Suche */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss");

export interface VenueFilter {
  q?: string | undefined;
  kind?: string | undefined;
  group?: string | undefined;
  occasion?: string | undefined;
  city?: string | undefined;
  guests?: number | undefined;
  date?: string | undefined;
}

export function matchVenue(v: Venue, f: VenueFilter, today: string): boolean {
  if (f.kind && v.kind !== f.kind) return false;
  if (f.group && kindOf(v.kind).group !== f.group) return false;
  if (f.occasion && !v.occasions.includes(f.occasion)) return false;
  if (f.city && !norm(v.city + " " + v.district).includes(norm(f.city))) return false;
  if (f.guests && f.guests > (v.packages.length ? Math.max(...v.packages.map((p) => p.maxGuests), capacityOf(v)) : capacityOf(v))) return false;
  if (f.date && !dayOpen(v, f.date, today)) return false;
  if (f.q) {
    const k = kindOf(v.kind);
    const hay = norm(
      [v.name, v.tagline, v.city, v.district, k.label.de, k.label.en, k.words ?? "", ...v.occasions.map((o) => OCCASIONS.find((x) => x.id === o)?.label.de ?? "")].join(" "),
    );
    if (!norm(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export interface Suggestion {
  type: "kind" | "occasion" | "venue";
  id: string;
  label: string;
  icon: string;
  count: number;
}

/** Vorschläge für das Suchfeld: Arten, Anlässe und einzelne Locations */
export function suggestVenues(list: Venue[], q: string, lang: Lang, max = 8): Suggestion[] {
  const n = norm(q.trim());
  const score = (label: string, words = "") => {
    if (!n) return 1;
    const l = norm(label);
    if (l.startsWith(n)) return 3;
    if (l.split(/[\s/&-]+/).some((w) => w.startsWith(n))) return 2.5;
    if (l.includes(n)) return 2;
    if (norm(words).split(/\s+/).some((w) => w.startsWith(n) || (n.length >= 4 && w.includes(n)))) return 1.5;
    return 0;
  };
  const out: (Suggestion & { s: number })[] = [];
  for (const k of VENUE_KINDS) {
    if (k.id === "sonstiges") continue;
    const count = list.filter((v) => v.kind === k.id).length;
    const s = score(k.label[lang] || k.label.de, (k.words ?? "") + " " + k.label.de);
    if (s > 0 && (count > 0 || n)) out.push({ type: "kind", id: k.id, label: k.label[lang] || k.label.de, icon: k.icon, count, s: s + (count ? 0.2 : 0) });
  }
  for (const o of OCCASIONS) {
    const count = list.filter((v) => v.occasions.includes(o.id)).length;
    const s = score(o.label[lang] || o.label.de, (o.words ?? "") + " " + o.label.de);
    if (s > 0 && count > 0) out.push({ type: "occasion", id: o.id, label: o.label[lang] || o.label.de, icon: o.icon, count, s: s + 0.1 });
  }
  if (n.length >= 2)
    for (const v of list) {
      const s = score(v.name);
      if (s > 0) out.push({ type: "venue", id: String(v.id), label: v.name, icon: kindOf(v.kind).icon, count: 0, s: s - 0.5 });
    }
  return out
    .sort((a, b) => b.s - a.s || b.count - a.count)
    .slice(0, max)
    .map(({ s: _s, ...x }) => x);
}
