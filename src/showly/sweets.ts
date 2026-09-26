/* Torten & Süßes: Anbieterprofile, Angebote und Anfragen.
 *
 * Anbieter können Konditoreien sein oder Privatpersonen, die zu Hause
 * backen. Beide haben ein vollständiges Profil wie die Künstler: Bilder,
 * Beschreibung, Spezialitäten, Angebote mit Preisen.
 *
 * Torten werden angefragt, nicht sofort bezahlt: Termin, Menge und Wünsche
 * muss der Anbieter erst bestätigen. Bezahlt wird nach der Zusage.
 *
 * Neu angelegte Profile, Angebote und Anfragen liegen vorerst im Browser
 * (localStorage, Bilder in IndexedDB), bis die Datenbank angebunden ist. */
import type { CSSProperties } from "react";
import { SHOP_ITEMS, type Lang, type LText, type ShopItem } from "./data";
import type { MediaRef } from "./media";
import { mediaUrlSync, preloadMedia } from "./media";
import { loadJSON, saveJSON } from "./persist";

export type SweetCat =
  | "wedding"
  | "birthday"
  | "motif"
  | "cupcakes"
  | "candybar"
  | "cakes"
  | "patisserie";

export const SWEET_CATS: SweetCat[] = [
  "wedding",
  "birthday",
  "motif",
  "cupcakes",
  "candybar",
  "cakes",
  "patisserie",
];

export const SWEET_CAT_LABEL: Record<SweetCat, Record<Lang, string>> = {
  wedding: { de: "Hochzeitstorten", en: "Wedding cakes", es: "Tartas de boda" },
  birthday: { de: "Geburtstagstorten", en: "Birthday cakes", es: "Tartas de cumpleaños" },
  motif: { de: "Motivtorten", en: "Themed cakes", es: "Tartas temáticas" },
  cupcakes: { de: "Cupcakes & Cake Pops", en: "Cupcakes & cake pops", es: "Cupcakes y cake pops" },
  candybar: { de: "Candy Bar & Donut-Wand", en: "Candy bar & donut wall", es: "Candy bar y muro de dónuts" },
  cakes: { de: "Kuchen & Blechkuchen", en: "Cakes & traybakes", es: "Bizcochos y tartas de bandeja" },
  patisserie: { de: "Macarons & Petit Fours", en: "Macarons & petits fours", es: "Macarons y petit fours" },
};

export const SWEET_CAT_ICON: Record<SweetCat, string> = {
  wedding: "gift",
  birthday: "party",
  motif: "sparkle",
  cupcakes: "heart",
  candybar: "star",
  cakes: "clipboard",
  patisserie: "crown",
};

export type Unit = "person" | "piece" | "set";

export interface Baker {
  id: number;
  /** Konditorei/Betrieb oder Privatperson */
  kind: "business" | "private";
  name: LText;
  city: string;
  rating: number;
  reviews: number;
  /** Seit wann dabei (Jahr) */
  since: number;
  tagline: LText;
  about: LText;
  specialties: SweetCat[];
  /** Vorlauf in Tagen */
  leadDays: number;
  /** Liefergebiet in Kilometern, 0 = nur Abholung */
  radiusKm: number;
  verified: boolean;
  /** Bild aus public/sweets als Titelbild, solange keine Fotos da sind */
  coverImg: number;
  photos?: MediaRef[] | undefined;
  diets?: string[];
  contact?: { email?: string; phone?: string; website?: string; instagram?: string };
  /** Pflichtbestätigung bei Privatpersonen: Lebensmittelbetrieb registriert */
  foodRegistered?: boolean;
  /** Steuerhinweis bestätigt (AGB § 18 Abs. 5) */
  taxAckAt?: string;
  own?: boolean;
}

export interface Sweet {
  id: number;
  bakerId: number;
  cat: SweetCat;
  name: LText;
  desc: LText;
  price: number;
  unit: Unit;
  minQty: number;
  img?: number | undefined;
  photo?: MediaRef | undefined;
  own?: boolean;
  /** Festpreis-Paket, direkt buchbar (z. B. 20 Macarons). Ohne Angabe gilt
   *  die Regel in isDirectSweet: Spezial- und Motivtorten nur auf Anfrage. */
  direct?: boolean;
}

/* Individuelle Torten brauchen Absprache (Motiv, Etagen, Text), feste
   Pakete wie Cupcakes, Macarons oder eine Candy Bar lassen sich sofort
   buchen. Der Anbieter kann das je Angebot umstellen. */
const REQUEST_CATS = ["wedding", "birthday", "motif"];
export function isDirectSweet(s: Pick<Sweet, "cat" | "direct">): boolean {
  return s.direct ?? !REQUEST_CATS.includes(s.cat);
}

export interface SweetRequest {
  id: string;
  sweetId: number;
  bakerId: number;
  dateISO: string;
  qty: number;
  city: string;
  wishes: string;
  name: string;
  email: string;
  estimate: number;
  createdISO: string;
  /** booked: direkt zum Festpreis gebucht */
  status: "sent" | "confirmed" | "declined" | "booked";
  direct?: boolean;
}

const L = (de: string, en: string, es: string) => ({ de, en, es });

export const BAKERS: Baker[] = [
  {
    id: 1,
    kind: "business",
    name: L("Konditorei Zuckerblüte", "Zuckerblüte Patisserie", "Pastelería Zuckerblüte"),
    city: "Berlin",
    rating: 4.97,
    reviews: 184,
    since: 2019,
    tagline: L(
      "Hochzeitstorten mit echten Blüten",
      "Wedding cakes with real flowers",
      "Tartas de boda con flores naturales",
    ),
    about: L(
      "Meisterkonditorei in Prenzlauer Berg. Wir backen jede Torte am Vortag und dekorieren mit essbaren Blüten aus der Region. Probestücke vorab möglich.",
      "Master patisserie in Prenzlauer Berg. Every cake is baked the day before and decorated with local edible flowers. Tasting available beforehand.",
      "Pastelería artesanal en Prenzlauer Berg. Horneamos cada tarta el día anterior y la decoramos con flores comestibles locales. Degustación previa posible.",
    ),
    specialties: ["wedding", "motif", "cakes"],
    leadDays: 21,
    radiusKm: 40,
    verified: true,
    coverImg: 1,
    diets: ["vegetarisch", "glutenfrei auf Anfrage"],
  },
  {
    id: 2,
    kind: "business",
    name: L("Tortenatelier Sahnehäubchen", "Sahnehäubchen Cake Studio", "Taller de tartas Sahnehäubchen"),
    city: "München",
    rating: 4.92,
    reviews: 131,
    since: 2020,
    tagline: L(
      "Drip Cakes und Zahlentorten für jede Party",
      "Drip cakes and number cakes for every party",
      "Drip cakes y tartas de números para cada fiesta",
    ),
    about: L(
      "Bunt, fröhlich, nie langweilig: Geburtstagstorten nach euren Wünschen, von der Einhorn-Torte bis zum Fußballfeld.",
      "Colourful, cheerful, never boring: birthday cakes made to your wishes, from unicorns to football pitches.",
      "Coloridas, alegres y nunca aburridas: tartas de cumpleaños a tu gusto, de unicornios a campos de fútbol.",
    ),
    specialties: ["birthday", "motif"],
    leadDays: 7,
    radiusKm: 25,
    verified: true,
    coverImg: 3,
  },
  {
    id: 3,
    kind: "business",
    name: L("Candy Bar Company", "Candy Bar Company", "Candy Bar Company"),
    city: "Köln",
    rating: 4.95,
    reviews: 96,
    since: 2021,
    tagline: L(
      "Candy Bars und Donut-Wände mit Aufbau",
      "Candy bars and donut walls with setup",
      "Candy bars y muros de dónuts con montaje",
    ),
    about: L(
      "Wir bringen die süße Ecke zu eurem Event: Gläser, Schaufeln, Tütchen und Deko inklusive, Aufbau und Abbau übernehmen wir.",
      "We bring the sweet corner to your event: jars, scoops, bags and decor included, we handle setup and teardown.",
      "Llevamos el rincón dulce a tu evento: tarros, cucharas, bolsitas y decoración incluidos; montamos y desmontamos.",
    ),
    specialties: ["candybar", "cupcakes"],
    leadDays: 10,
    radiusKm: 80,
    verified: true,
    coverImg: 8,
  },
  {
    id: 4,
    kind: "private",
    name: L("Mia backt", "Mia bakes", "Mia hornea"),
    city: "Leipzig",
    rating: 4.99,
    reviews: 47,
    since: 2023,
    tagline: L(
      "Cupcakes und Cake Pops aus der Hobbyküche",
      "Cupcakes and cake pops from a home kitchen",
      "Cupcakes y cake pops de cocina casera",
    ),
    about: L(
      "Ich bin Mia, Erzieherin und Hobbybäckerin. Am Wochenende backe ich Cupcakes, Cake Pops und kleine Torten für Kindergeburtstage in Leipzig und Umgebung. Abholung oder Lieferung bis 15 km.",
      "I'm Mia, a nursery teacher and hobby baker. At weekends I bake cupcakes, cake pops and small cakes for kids' parties in and around Leipzig. Pickup or delivery within 15 km.",
      "Soy Mia, educadora y repostera aficionada. Los fines de semana hago cupcakes, cake pops y tartas pequeñas para cumpleaños infantiles en Leipzig. Recogida o entrega hasta 15 km.",
    ),
    specialties: ["cupcakes", "birthday"],
    leadDays: 5,
    radiusKm: 15,
    verified: true,
    coverImg: 6,
    foodRegistered: true,
  },
  {
    id: 5,
    kind: "business",
    name: L("Patisserie Petit Four", "Petit Four Patisserie", "Pastelería Petit Four"),
    city: "Frankfurt",
    rating: 4.9,
    reviews: 78,
    since: 2018,
    tagline: L(
      "Macarons, Petit Fours und Logo-Torten für Firmen",
      "Macarons, petits fours and logo cakes for companies",
      "Macarons, petit fours y tartas con logo para empresas",
    ),
    about: L(
      "Französische Patisserie für Empfänge, Jubiläen und Messen. Auf Wunsch mit Firmenlogo und Rechnung für die Buchhaltung.",
      "French patisserie for receptions, anniversaries and trade fairs. Company logo on request, invoice for accounting.",
      "Pastelería francesa para recepciones, aniversarios y ferias. Con logo de empresa si lo deseas y factura.",
    ),
    specialties: ["patisserie", "motif", "wedding"],
    leadDays: 7,
    radiusKm: 60,
    verified: true,
    coverImg: 10,
  },
  {
    id: 6,
    kind: "private",
    name: L("Omas Kuchenküche – Helga", "Grandma's cake kitchen – Helga", "La cocina de la abuela – Helga"),
    city: "Stuttgart",
    rating: 4.96,
    reviews: 39,
    since: 2024,
    tagline: L(
      "Blechkuchen wie früher, auch vegan",
      "Traybakes like in the old days, vegan too",
      "Tartas de bandeja como antes, también veganas",
    ),
    about: L(
      "Rentnerin mit 40 Jahren Backerfahrung. Streuselkuchen, Kirschkuchen und Schokotorte für Familienfeiern und Vereinsfeste, alles nach Omas Rezepten.",
      "Retiree with 40 years of baking. Crumble cake, cherry cake and chocolate cake for family parties and club events, all from grandma's recipes.",
      "Jubilada con 40 años horneando. Bizcocho de migas, de cerezas y tarta de chocolate para fiestas familiares, con recetas de la abuela.",
    ),
    specialties: ["cakes"],
    leadDays: 3,
    radiusKm: 10,
    verified: true,
    coverImg: 12,
    diets: ["vegan"],
    foodRegistered: true,
  },
];

export const SWEETS: Sweet[] = [
  { id: 1, bakerId: 1, cat: "wedding", img: 1, price: 7.5, unit: "person", minQty: 40,
    name: L("Hochzeitstorte „Weiße Rose“, 3 Etagen", "“White Rose” wedding cake, 3 tiers", "Tarta de boda “Rosa Blanca”, 3 pisos"),
    desc: L("Vanille-Himbeer, Buttercreme, frische Blüten. Lieferung und Aufbau inklusive.", "Vanilla raspberry, buttercream, fresh flowers. Delivery and setup included.", "Vainilla y frambuesa, crema de mantequilla, flores frescas. Entrega y montaje incluidos.") },
  { id: 2, bakerId: 1, cat: "wedding", img: 2, price: 6.9, unit: "person", minQty: 20,
    name: L("Naked Cake mit Beeren", "Naked cake with berries", "Naked cake con frutos rojos"),
    desc: L("Drei Böden mit Mascarpone und Saisonbeeren, locker eingestrichen.", "Three layers with mascarpone and seasonal berries, lightly frosted.", "Tres capas con mascarpone y frutos de temporada.") },
  { id: 3, bakerId: 2, cat: "birthday", img: 3, price: 69, unit: "set", minQty: 1,
    name: L("Drip Cake Geburtstag, 16 Stücke", "Birthday drip cake, 16 slices", "Drip cake de cumpleaños, 16 porciones"),
    desc: L("Schoko-Drip, Streusel, Kerzen und Wunschfarbe.", "Chocolate drip, sprinkles, candles and colour of choice.", "Drip de chocolate, fideos, velas y color a elegir.") },
  { id: 4, bakerId: 2, cat: "birthday", img: 4, price: 79, unit: "set", minQty: 1,
    name: L("Zahlentorte nach Wunsch", "Custom number cake", "Tarta de número a medida"),
    desc: L("Mürbeteig, Mascarpone-Creme, Beeren und Macarons. Zahl frei wählbar.", "Shortcrust, mascarpone cream, berries and macarons. Any number.", "Masa quebrada, crema de mascarpone, frutos rojos y macarons. Número a elegir.") },
  { id: 5, bakerId: 2, cat: "motif", img: 5, price: 95, unit: "set", minQty: 1,
    name: L("Motivtorte Einhorn oder Superheld", "Unicorn or superhero cake", "Tarta de unicornio o superhéroe"),
    desc: L("Mit Fondant-Figur, für etwa 20 Gäste.", "With fondant figure, serves about 20.", "Con figura de fondant, para unas 20 personas.") },
  { id: 6, bakerId: 4, cat: "cupcakes", img: 6, price: 36, unit: "set", minQty: 1,
    name: L("Cupcake-Box, 12 Stück", "Cupcake box, 12 pieces", "Caja de cupcakes, 12 unidades"),
    desc: L("Vier Sorten, Farben passend zur Party. Abholung in Leipzig-Gohlis.", "Four flavours, colours to match your party. Pickup in Leipzig-Gohlis.", "Cuatro sabores, colores a juego. Recogida en Leipzig-Gohlis.") },
  { id: 7, bakerId: 4, cat: "cupcakes", img: 7, price: 44, unit: "set", minQty: 1,
    name: L("Cake Pops, 20 Stück", "Cake pops, 20 pieces", "Cake pops, 20 unidades"),
    desc: L("Schoko und Vanille, im Ständer geliefert.", "Chocolate and vanilla, delivered in a stand.", "Chocolate y vainilla, entregados en soporte.") },
  { id: 8, bakerId: 3, cat: "candybar", img: 8, price: 6, unit: "person", minQty: 50,
    name: L("Candy Bar komplett mit Aufbau", "Complete candy bar with setup", "Candy bar completo con montaje"),
    desc: L("Zwölf Sorten Süßigkeiten, Gläser, Tütchen, Tischdeko. Auf- und Abbau inklusive.", "Twelve kinds of sweets, jars, bags, table decor. Setup and teardown included.", "Doce tipos de dulces, tarros, bolsitas y decoración. Montaje incluido.") },
  { id: 9, bakerId: 3, cat: "candybar", img: 9, price: 149, unit: "set", minQty: 1,
    name: L("Donut-Wand mit 40 Donuts", "Donut wall with 40 donuts", "Muro de dónuts con 40 dónuts"),
    desc: L("Holzwand zum Leihen, frische Donuts in vier Sorten.", "Rental wooden wall, fresh donuts in four flavours.", "Muro de madera en alquiler, dónuts frescos de cuatro sabores.") },
  { id: 10, bakerId: 5, cat: "patisserie", img: 10, price: 129, unit: "set", minQty: 1,
    name: L("Macaron-Turm, 60 Stück", "Macaron tower, 60 pieces", "Torre de macarons, 60 unidades"),
    desc: L("Fünf Sorten auf goldenem Ständer.", "Five flavours on a gold stand.", "Cinco sabores sobre soporte dorado.") },
  { id: 11, bakerId: 5, cat: "patisserie", img: 11, price: 89, unit: "set", minQty: 1,
    name: L("Petit-Fours-Platte, 40 Stück", "Petits fours platter, 40 pieces", "Bandeja de petit fours, 40 unidades"),
    desc: L("Für Empfänge und Kaffeepausen.", "For receptions and coffee breaks.", "Para recepciones y pausas de café.") },
  { id: 14, bakerId: 5, cat: "motif", img: 14, price: 8, unit: "person", minQty: 30,
    name: L("Torte mit Firmenlogo", "Cake with company logo", "Tarta con logo de empresa"),
    desc: L("Logo als essbarer Druck oder aus Fondant, Rechnung für Firmen.", "Logo as edible print or fondant, invoice for companies.", "Logo impreso comestible o de fondant, con factura.") },
  { id: 12, bakerId: 6, cat: "cakes", img: 12, price: 59, unit: "set", minQty: 1,
    name: L("Blechkuchen-Paket, 3 Bleche", "Traybake bundle, 3 trays", "Pack de 3 tartas de bandeja"),
    desc: L("Streusel, Kirsch und Butterkuchen, etwa 60 Stücke.", "Crumble, cherry and butter cake, about 60 pieces.", "De migas, cerezas y mantequilla, unas 60 porciones.") },
  { id: 13, bakerId: 6, cat: "cakes", img: 13, price: 54, unit: "set", minQty: 1,
    name: L("Vegane Schokotorte", "Vegan chocolate cake", "Tarta de chocolate vegana"),
    desc: L("Saftig, mit Kirschen, für etwa 16 Personen.", "Moist, with cherries, serves about 16.", "Jugosa, con cerezas, para unas 16 personas.") },
];

/* ---------- Anzeige ---------- */

function bg(url: string, pos = "center"): CSSProperties {
  return {
    backgroundImage: `url('${url}')`,
    backgroundSize: "cover",
    backgroundPosition: pos,
    backgroundRepeat: "no-repeat",
  };
}

export function sweetBg(s: Sweet): CSSProperties {
  const u = s.photo ? mediaUrlSync(s.photo.id) : null;
  if (u) return bg(u);
  if (s.img) return bg(`/sweets/${s.img}.svg`);
  return { background: "linear-gradient(135deg,#FFF1F4,#F6EEFF)" };
}

export function bakerBg(b: Baker): CSSProperties {
  const first = b.photos?.[0];
  const u = first ? mediaUrlSync(first.id) : null;
  if (u) return bg(u);
  return bg(`/sweets/${b.coverImg || 1}.svg`);
}

export function sweetsOf(bakerId: number) {
  return SWEETS.filter((s) => s.bakerId === bakerId);
}

export function bakerOf(id: number) {
  return BAKERS.find((b) => b.id === id);
}

/** Ab-Preis eines Anbieters, für die Karte */
export function fromPrice(bakerId: number): Sweet | null {
  const list = sweetsOf(bakerId);
  if (!list.length) return null;
  return list.reduce((a, b) => (unitValue(b) < unitValue(a) ? b : a));
}
function unitValue(s: Sweet) {
  return s.unit === "person" ? s.price * 20 : s.price;
}

/** Richtpreis für eine Menge */
export function estimate(s: Sweet, qty: number) {
  return s.unit === "set" ? s.price * Math.max(1, qty) : s.price * Math.max(s.minQty, qty);
}

/* ---------- Speichern im Browser ---------- */

const K_BAKERS = "bakers.user";
const K_SWEETS = "sweets.user";
const K_REQ = "sweets.requests";
const K_MINE = "bakers.mine";

let hydrated = false;

export function hydrateSweets() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  for (const b of loadJSON<Baker[]>(K_BAKERS, [])) {
    if (b && typeof b.id === "number" && !BAKERS.some((x) => x.id === b.id)) BAKERS.push(b);
  }
  for (const s of loadJSON<Sweet[]>(K_SWEETS, [])) {
    if (s && typeof s.id === "number" && !SWEETS.some((x) => x.id === s.id)) SWEETS.push(s);
  }
  for (const d of myDecoItems()) {
    if (d && typeof d.id === "number" && !SHOP_ITEMS.some((x) => x.id === d.id)) {
      SHOP_ITEMS.push(decoToItem(d));
    }
  }
  void preloadMedia([
    ...BAKERS.flatMap((b) => (b.photos || []).map((m) => m.id)),
    ...SWEETS.flatMap((s) => (s.photo ? [s.photo.id] : [])),
    ...SHOP_ITEMS.flatMap((i) => (i.photo ? [i.photo.id] : [])),
  ]);
}

/* Eigene Anbieterprofile aus der Datenbank (bei Anmeldung über Supabase) */
let cloudOwnBakers: number[] = [];
export function setCloudOwnBakers(ids: number[]) {
  cloudOwnBakers = ids;
}

/** Profile, die diese Person bearbeiten darf: im Browser angelegt oder
 *  eigene aus der Datenbank */
export function myBakerIds(): number[] {
  return [...loadJSON<number[]>(K_MINE, []), ...cloudOwnBakers];
}

export function createBaker(b: Omit<Baker, "id" | "rating" | "reviews" | "verified" | "own">): Baker {
  const id = Math.max(100, ...BAKERS.map((x) => x.id)) + 1;
  const full: Baker = { ...b, id, rating: 0, reviews: 0, verified: false, own: true };
  BAKERS.push(full);
  saveJSON(K_BAKERS, [...loadJSON<Baker[]>(K_BAKERS, []), full]);
  saveJSON(K_MINE, [...loadJSON<number[]>(K_MINE, []), id]);
  return full;
}

/* Name bei Privatpersonen, Bewertungen und Prüfsiegel ändert der Anbieter
   nicht selbst. */
const LOCKED_BAKER = ["id", "rating", "reviews", "verified", "kind", "own", "foodRegistered"];

export function updateBaker(id: number, patch: Partial<Baker>) {
  if (!myBakerIds().includes(id)) return;
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => !LOCKED_BAKER.includes(k)),
  ) as Partial<Baker>;
  const inList = BAKERS.find((b) => b.id === id);
  if (inList) Object.assign(inList, clean);
  saveJSON(
    K_BAKERS,
    loadJSON<Baker[]>(K_BAKERS, []).map((b) => (b.id === id ? { ...b, ...clean } : b)),
  );
}

export function saveSweet(s: Omit<Sweet, "id" | "own"> & { id?: number | undefined }): Sweet {
  if (!myBakerIds().includes(s.bakerId)) throw new Error("not owner");
  const list = loadJSON<Sweet[]>(K_SWEETS, []);
  if (s.id) {
    const next = { ...s, own: true } as Sweet;
    const inList = SWEETS.find((x) => x.id === s.id);
    if (inList) Object.assign(inList, next);
    saveJSON(K_SWEETS, list.map((x) => (x.id === s.id ? next : x)));
    return next;
  }
  const id = Math.max(100, ...SWEETS.map((x) => x.id)) + 1;
  const full = { ...s, id, own: true } as Sweet;
  SWEETS.push(full);
  saveJSON(K_SWEETS, [...list, full]);
  return full;
}

export function removeSweet(id: number) {
  const s = SWEETS.find((x) => x.id === id);
  if (!s || !myBakerIds().includes(s.bakerId)) return;
  SWEETS.splice(SWEETS.indexOf(s), 1);
  saveJSON(
    K_SWEETS,
    loadJSON<Sweet[]>(K_SWEETS, []).filter((x) => x.id !== id),
  );
}

/* Anfragen aus der Datenbank (bei Anmeldung über Supabase). Sie stehen vor
   den Anfragen, die nur in diesem Browser liegen. */
let cloudRequests: SweetRequest[] = [];

export function setCloudRequests(list: SweetRequest[]) {
  cloudRequests = list;
}

function localRequests(): SweetRequest[] {
  return loadJSON<SweetRequest[]>(K_REQ, []);
}

export function listRequests(): SweetRequest[] {
  return [...cloudRequests, ...localRequests()];
}

/** Lokale Einträge entfernen, sobald die Datenbank sie übernommen hat */
export function dropLocalRequests(ids: string[]) {
  const drop = new Set(ids);
  saveJSON(K_REQ, localRequests().filter((r) => !drop.has(r.id)));
}

export function addRequest(r: Omit<SweetRequest, "id" | "createdISO" | "status">): SweetRequest {
  const full: SweetRequest = {
    ...r,
    id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdISO: new Date().toISOString(),
    status: r.direct ? "booked" : "sent",
  };
  saveJSON(K_REQ, [full, ...localRequests()]);
  return full;
}

export function setRequestStatus(id: string, status: SweetRequest["status"]) {
  saveJSON(
    K_REQ,
    localRequests().map((r) => (r.id === id ? { ...r, status } : r)),
  );
}

/* Vom Anbieter eingestellte Deko-Artikel für den Shop. Sie landen in
   derselben Liste wie die übrigen Artikel, damit Warenkorb, Suche und
   Bestellungen sie ohne Sonderweg finden. */
const K_DECO = "deco.user";

export interface DecoInput {
  vendor: string;
  cat: string;
  occ: string[];
  name: string;
  desc: string;
  buy: number;
  rent: number;
  photo?: MediaRef | undefined;
}

function decoToItem(d: DecoInput & { id: number }): ShopItem {
  return {
    id: d.id,
    section: "deko",
    cat: d.cat,
    occ: d.occ,
    vendor: d.vendor,
    rent: d.rent,
    buy: d.buy,
    rating: 0,
    reviews: 0,
    name: d.name,
    desc: d.desc,
    photo: d.photo,
    own: true,
  };
}

export function myDecoItems() {
  return loadJSON<(DecoInput & { id: number })[]>(K_DECO, []);
}

export function saveDecoItem(d: DecoInput): ShopItem {
  const id = Math.max(1000, ...SHOP_ITEMS.map((x) => x.id)) + 1;
  const stored = { ...d, id };
  saveJSON(K_DECO, [...myDecoItems(), stored]);
  const item = decoToItem(stored);
  SHOP_ITEMS.push(item);
  return item;
}

export function removeDecoItem(id: number) {
  const list = myDecoItems();
  if (!list.some((x) => x.id === id)) return;
  saveJSON(K_DECO, list.filter((x) => x.id !== id));
  const k = SHOP_ITEMS.findIndex((x) => x.id === id);
  if (k >= 0) SHOP_ITEMS.splice(k, 1);
}
