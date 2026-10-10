/* Katalog der Locations: Beispiele (als solche gekennzeichnet), im Browser
 * angelegte eigene Locations und freigeschaltete Locations aus der
 * Datenbank (providers, kind = 'location'). Rechnen und Prüfen: locations.ts. */
import { loadJSON, saveJSON } from "./persist";
import { cleanVenue, publicVenue, type Venue, type WeekHours } from "./locations";

const open = (from: string, to: string) => ({ from, to });
/** Mo–So, gleiche Zeiten; `closed` = Wochentage ohne Öffnung (0 = Mo) */
const week = (from: string, to: string, closed: number[] = []): WeekHours =>
  Array.from({ length: 7 }, (_, i) => (closed.includes(i) ? null : open(from, to)));

const demo = (id: number, raw: Record<string, unknown>): Venue => ({ ...cleanVenue(raw, id), demo: true, verified: false });

export const VENUES: Venue[] = [
  demo(1, {
    kind: "indoorspielplatz",
    name: "Kletterwald Kids Indoor",
    city: "Stuttgart",
    district: "Bad Cannstatt",
    tagline: "Rutschen, Trampolin und eigener Partyraum fürs Geburtstagskind",
    about:
      "2.000 m² zum Toben: Kletterlabyrinth, Riesenrutsche, Trampoline und ein Kleinkindbereich. Für Geburtstage gibt es eigene Partytische, Essen und auf Wunsch eine Betreuerin, die Spiele anleitet.",
    occasions: ["kindergeburtstag", "geburtstag"],
    seated: 120,
    standing: 200,
    areaM2: 2000,
    rooms: 3,
    amenities: ["stuehle", "tische", "wc", "wickeltisch", "spielecke", "parken", "stufenlos", "garderobe", "klima"],
    rules: { eigenesEssen: false, eigeneGetraenke: false, eigeneDeko: true, konfetti: false, kerzen: true, haustiere: false },
    minAge: 1,
    notes: "Rutschsocken sind Pflicht (vor Ort für 2 € erhältlich).",
    mode: "person",
    price: 14,
    minGuests: 6,
    packages: [
      { id: "basic", name: "Geburtstag Basic", includes: ["Eintritt", "Partytisch für 2 Std.", "Getränke-Flatrate", "Geschenk fürs Geburtstagskind"], price: 16.9, per: "person", minGuests: 6, maxGuests: 20, hours: 3 },
      { id: "premium", name: "Geburtstag Premium", includes: ["Eintritt", "Eigener Partyraum für 2,5 Std.", "Pommes & Nuggets", "Getränke-Flatrate", "Geburtstagskuchen", "Betreuerin für Spiele"], price: 24.9, per: "person", minGuests: 8, maxGuests: 25, hours: 3 },
    ],
    extras: [
      { id: "torte", name: "Motivtorte (bis 20 Stück)", price: 45, per: "event" },
      { id: "einladung", name: "Einladungskarten (10 Stück)", price: 6, per: "event" },
      { id: "erwachsene", name: "Kaffee & Kuchen für Eltern", price: 5.5, per: "person" },
    ],
    deposit: 0,
    week: week("10:00", "19:00", [0]),
    slots: ["10:00", "13:00", "15:30"],
    parallel: 4,
    bufferMin: 30,
    leadDays: 2,
    rating: 4.8,
    reviews: 0,
    hue: 330,
  }),
  demo(2, {
    kind: "wasserpark",
    name: "AquaFun Erlebnisbad",
    city: "München",
    district: "Riem",
    tagline: "Kindergeburtstag mit Wildwasserrutsche und Wellenbecken",
    about:
      "Erlebnisbad mit fünf Rutschen, Wellenbecken und Kinderlagune. Die Geburtstagsgruppe bekommt eine reservierte Ecke im Bistro und einen Bademeister als Ansprechpartner.",
    occasions: ["kindergeburtstag", "geburtstag", "jga"],
    seated: 60,
    standing: 80,
    areaM2: 5000,
    amenities: ["stuehle", "tische", "wc", "wickeltisch", "garderobe", "parken", "oepnv", "stufenlos", "aufzug", "rollstuhl_wc"],
    rules: { eigenesEssen: false, eigeneGetraenke: false, eigeneDeko: false, konfetti: false, kerzen: false, haustiere: false },
    minAge: 4,
    notes: "Kinder unter 10 Jahren nur mit Schwimmabzeichen oder Begleitung.",
    mode: "person",
    price: 19,
    minGuests: 6,
    packages: [
      { id: "splash", name: "Splash-Party", includes: ["Tageseintritt", "Reservierter Bistrotisch 1,5 Std.", "Pizza & Getränk", "Rutschen-Challenge mit Urkunde"], price: 27, per: "person", minGuests: 6, maxGuests: 20, hours: 4 },
    ],
    extras: [{ id: "eltern", name: "Eintritt Begleitperson", price: 15, per: "event" }],
    deposit: 0,
    week: week("09:00", "21:00"),
    slots: ["10:00", "14:00"],
    parallel: 3,
    bufferMin: 0,
    leadDays: 3,
    rating: 4.6,
    reviews: 0,
    hue: 200,
  }),
  demo(3, {
    kind: "hochzeitssaal",
    name: "Gut Sonnenhof Festsaal",
    city: "Backnang",
    district: "Umgebung",
    tagline: "Heller Festsaal mit Gartenterrasse für bis zu 160 Gäste",
    about:
      "Der ehemalige Pferdestall ist heute ein heller Saal mit Holzbalken, Kronleuchtern und direktem Zugang zum Garten. Freie Trauung im Garten möglich. Catering wählt ihr selbst oder über unsere Partner.",
    occasions: ["hochzeit", "geburtstag", "firmenfeier", "jubilaeum", "taufe", "weihnachtsfeier"],
    seated: 160,
    standing: 220,
    areaM2: 380,
    rooms: 2,
    outdoor: true,
    amenities: ["stuehle", "tische", "stehtische", "tischdecken", "geschirr", "theke", "kueche", "kuehlschrank", "musik", "mikrofon", "beamer", "tanzflaeche", "licht", "wlan", "garderobe", "heizung", "wc", "aussenbereich", "parken", "stufenlos", "rollstuhl_wc"],
    rules: { eigenesEssen: true, eigeneGetraenke: true, eigeneDeko: true, konfetti: false, kerzen: true, nebel: false, liveMusik: true, haustiere: true, rauchen: true },
    musicUntil: "01:00",
    mode: "flat",
    price: 1200,
    priceFull: 2400,
    minHours: 4,
    surcharges: { weekend: 15, seasons: [{ from: "05-01", to: "09-30", pct: 10, label: "Hochzeitssaison" }] },
    extras: [
      { id: "reinigung", name: "Endreinigung", price: 250, per: "event" },
      { id: "service", name: "Servicekraft", price: 35, per: "hour" },
      { id: "trauung", name: "Freie Trauung im Garten (Bestuhlung)", price: 300, per: "event" },
      { id: "getraenke", name: "Getränkepauschale", price: 29, per: "person" },
    ],
    deposit: 500,
    week: week("10:00", "02:00"),
    bufferMin: 180,
    leadDays: 14,
    maxMonths: 24,
    instant: false,
    cancelTier: "streng",
    rating: 4.9,
    reviews: 0,
    hue: 30,
  }),
  demo(4, {
    kind: "loft",
    name: "Spreeloft Kreuzberg",
    city: "Berlin",
    district: "Kreuzberg",
    tagline: "Industrie-Loft mit Blick aufs Wasser für Firmen- und Privatfeiern",
    about: "Rohe Backsteinwände, 4 Meter Deckenhöhe und große Fenster zur Spree. Mit Bar, Küche zum Anrichten und eigener Lichttechnik.",
    occasions: ["firmenfeier", "geburtstag", "weihnachtsfeier", "workshop", "jga"],
    seated: 80,
    standing: 150,
    areaM2: 240,
    amenities: ["stuehle", "tische", "stehtische", "theke", "kueche", "kuehlschrank", "musik", "mikrofon", "beamer", "licht", "wlan", "garderobe", "heizung", "klima", "wc", "oepnv", "aufzug"],
    rules: { eigenesEssen: true, eigeneGetraenke: false, eigeneDeko: true, konfetti: false, kerzen: true, nebel: true, liveMusik: true, haustiere: false, rauchen: true },
    musicUntil: "00:00",
    mode: "hour",
    price: 140,
    minHours: 4,
    surcharges: { weekend: 20, seasons: [{ from: "11-15", to: "12-23", pct: 15, label: "Weihnachtsfeiern" }] },
    extras: [
      { id: "reinigung", name: "Endreinigung", price: 180, per: "event" },
      { id: "barkeeper", name: "Barkeeper", price: 40, per: "hour" },
      { id: "technik", name: "Techniker vor Ort", price: 45, per: "hour" },
    ],
    deposit: 300,
    week: week("09:00", "01:00"),
    bufferMin: 120,
    leadDays: 5,
    rating: 4.7,
    reviews: 0,
    hue: 262,
  }),
  demo(5, {
    kind: "restaurant",
    name: "Trattoria Da Lucia – Nebenraum",
    city: "Köln",
    district: "Ehrenfeld",
    tagline: "Eigener Nebenraum mit Menü für Geburtstage und Taufen",
    about: "Separater Raum für bis zu 45 Gäste mit eigenem Eingang. Ihr wählt vorab ein Menü; Getränke werden vor Ort abgerechnet.",
    occasions: ["geburtstag", "taufe", "jubilaeum", "firmenfeier", "weihnachtsfeier", "babyparty"],
    seated: 45,
    standing: 60,
    areaM2: 70,
    amenities: ["stuehle", "tische", "tischdecken", "geschirr", "musik", "wlan", "garderobe", "heizung", "wc", "wickeltisch", "oepnv"],
    rules: { eigenesEssen: false, eigeneGetraenke: false, eigeneDeko: true, konfetti: false, kerzen: true, liveMusik: false, haustiere: true },
    minSpend: 600,
    mode: "person",
    price: 39,
    minGuests: 12,
    extras: [
      { id: "aperitivo", name: "Aperitivo zum Empfang", price: 6.5, per: "person" },
      { id: "torte", name: "Torte vom Haus", price: 4.5, per: "person" },
    ],
    deposit: 0,
    week: week("12:00", "23:00", [0]),
    bufferMin: 60,
    leadDays: 3,
    minHours: 3,
    rating: 4.5,
    reviews: 0,
    hue: 12,
  }),
  demo(6, {
    kind: "trampolinhalle",
    name: "JumpArena",
    city: "Hamburg",
    district: "Wandsbek",
    tagline: "Trampolin-Party mit Ninja-Parcours und Partyraum",
    about: "Über 60 Trampoline, Ninja-Parcours, Schaumstoffgrube und Dodgeball-Feld. Partyräume für Gruppen mit Essen und Trainer.",
    occasions: ["kindergeburtstag", "geburtstag", "firmenfeier", "jga"],
    seated: 80,
    standing: 150,
    areaM2: 3000,
    rooms: 4,
    amenities: ["stuehle", "tische", "wc", "garderobe", "parken", "klima", "stufenlos"],
    rules: { eigenesEssen: false, eigeneGetraenke: false, eigeneDeko: true, konfetti: false, kerzen: true },
    minAge: 5,
    notes: "Sprungsocken Pflicht. Unter 14 Jahren Einverständnis der Eltern.",
    mode: "person",
    price: 17,
    minGuests: 8,
    packages: [
      { id: "jump", name: "Jump-Party", includes: ["90 Min. springen", "Partyraum 1 Std.", "Pizza & Getränk", "Sprungsocken"], price: 22.5, per: "person", minGuests: 8, maxGuests: 24, hours: 3 },
      { id: "ninja", name: "Ninja-Party", includes: ["2 Std. springen", "Ninja-Parcours mit Trainer", "Partyraum 1 Std.", "Burger & Getränke-Flatrate", "Medaille für alle"], price: 29.5, per: "person", minGuests: 8, maxGuests: 24, hours: 3 },
    ],
    extras: [{ id: "torte", name: "Geburtstagskuchen", price: 35, per: "event" }],
    week: week("12:00", "20:00", [0, 1]),
    slots: ["12:00", "14:30", "17:00"],
    parallel: 4,
    bufferMin: 0,
    leadDays: 2,
    rating: 4.7,
    reviews: 0,
    hue: 290,
  }),
  demo(7, {
    kind: "garten",
    business: false,
    name: "Gartenhaus mit Obstwiese",
    city: "Leipzig",
    district: "Stadtrand",
    tagline: "Ruhiges Gartengrundstück mit Hütte – privat vermietet",
    about: "1.200 m² Wiese mit Obstbäumen, Holzhütte (30 Plätze), Grill und Feuerschale. Ideal für Sommerfeste und Kindergeburtstage im Grünen.",
    occasions: ["geburtstag", "kindergeburtstag", "babyparty", "firmenfeier", "jga"],
    seated: 30,
    standing: 60,
    areaM2: 1200,
    indoor: true,
    outdoor: true,
    amenities: ["baenke", "tische", "kuehlschrank", "aussenbereich", "wc", "parken"],
    rules: { eigenesEssen: true, eigeneGetraenke: true, eigeneDeko: true, konfetti: false, kerzen: true, liveMusik: true, haustiere: true, rauchen: true },
    musicUntil: "22:00",
    mode: "flat",
    price: 180,
    priceFull: 290,
    surcharges: { weekend: 0, seasons: [] },
    extras: [
      { id: "grill", name: "Grill mit Kohle", price: 25, per: "event" },
      { id: "reinigung", name: "Endreinigung", price: 60, per: "event" },
    ],
    deposit: 150,
    week: week("10:00", "22:00"),
    bufferMin: 600,
    leadDays: 4,
    rating: 4.9,
    reviews: 0,
    hue: 140,
  }),
  demo(8, {
    kind: "escaperoom",
    name: "Mystery Rooms",
    city: "Frankfurt am Main",
    district: "Sachsenhausen",
    tagline: "Drei Rätselräume plus Lounge – für Teamevents und Geburtstage",
    about: "Drei Räume mit Story (Piraten, Labor, Bankraub) für je 2–8 Personen. Danach Lounge mit Snacks und Getränken.",
    occasions: ["firmenfeier", "geburtstag", "jga", "kindergeburtstag"],
    seated: 24,
    standing: 30,
    areaM2: 200,
    rooms: 3,
    amenities: ["stuehle", "tische", "musik", "wlan", "wc", "garderobe", "oepnv", "klima"],
    rules: { eigenesEssen: true, eigeneGetraenke: false, eigeneDeko: true },
    minAge: 10,
    mode: "person",
    price: 29,
    minGuests: 4,
    packages: [
      { id: "team", name: "Team-Challenge", includes: ["2 Räume im Wettkampf", "Lounge 1 Std.", "Snacks & Softdrinks", "Siegerfoto"], price: 39, per: "person", minGuests: 6, maxGuests: 16, hours: 3 },
    ],
    extras: [{ id: "sekt", name: "Sektempfang", price: 6, per: "person" }],
    week: week("12:00", "23:00"),
    slots: ["12:00", "15:00", "18:00", "20:30"],
    parallel: 1,
    bufferMin: 30,
    leadDays: 1,
    rating: 4.8,
    reviews: 0,
    hue: 240,
  }),
];

/* ------------------------------------------------- im Browser gespeichert */

const K_VENUES = "venues.user";
const K_MINE = "venues.mine";
let hydrated = false;

export function hydrateVenues() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  for (const v of loadJSON<Venue[]>(K_VENUES, [])) {
    if (v && typeof v.id === "number" && !VENUES.some((x) => x.id === v.id)) VENUES.push({ ...cleanVenue(v as never, v.id), own: true });
  }
}

let cloudOwn: number[] = [];
export function setCloudOwnVenues(list: number[]) {
  cloudOwn = list;
}
export function myVenueIds(): number[] {
  return [...loadJSON<number[]>(K_MINE, []), ...cloudOwn];
}

export function findVenue(id: number, extra?: (id: number) => Venue | undefined): Venue | undefined {
  return extra?.(id) ?? VENUES.find((v) => v.id === id);
}

/** Neue Location nur in diesem Browser (ohne Datenbank, Vorschau) */
export function createVenue(raw: Record<string, unknown>): Venue {
  const id = Math.max(1000, ...VENUES.map((v) => v.id)) + 1;
  const v: Venue = { ...cleanVenue(raw, id), rating: 0, reviews: 0, verified: false, own: true };
  VENUES.push(v);
  saveJSON(K_VENUES, [...loadJSON<Venue[]>(K_VENUES, []), v]);
  saveJSON(K_MINE, [...loadJSON<number[]>(K_MINE, []), id]);
  return v;
}

export function updateVenue(id: number, raw: Record<string, unknown>): Venue | null {
  if (!myVenueIds().includes(id)) return null;
  const prev = VENUES.find((v) => v.id === id);
  const next: Venue = { ...cleanVenue(raw, id), rating: prev?.rating ?? 0, reviews: prev?.reviews ?? 0, verified: prev?.verified ?? false, own: true };
  if (prev) Object.assign(prev, next);
  else VENUES.push(next);
  saveJSON(
    K_VENUES,
    loadJSON<Venue[]>(K_VENUES, []).map((v) => (v.id === id ? next : v)),
  );
  return next;
}

/* --------------------------------------------------------- Datenbank */

/** Location aus einer Zeile von providers (kind = 'location') */
export function venueFromRow(r: { id: number; data: unknown }, own: boolean, published: boolean): Venue {
  const d = (r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>;
  const v = cleanVenue({ ...d, photos: Array.isArray(d["photos"]) ? (d["photos"] as { id: string }[]).map((m) => ({ ...m, id: "c:" + m.id })) : [] }, r.id);
  return { ...(own ? v : publicVenue(v)), verified: published, rating: 0, reviews: 0, ...(own ? { own: true } : {}) };
}

export function upsertVenue(v: Venue) {
  const i = VENUES.findIndex((x) => x.id === v.id);
  if (i >= 0) VENUES[i] = v;
  else VENUES.push(v);
}
