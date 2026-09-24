// Ortssuche-Logik (rein & testbar): lokale Städtelisten, Filterung, Photon-Query, Cache.

export const DE_CITIES = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf",
  "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg",
  "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg",
  "Wiesbaden", "Mönchengladbach", "Gelsenkirchen", "Braunschweig", "Kiel", "Aachen", "Chemnitz",
  "Halle (Saale)", "Magdeburg", "Freiburg im Breisgau", "Krefeld", "Mainz", "Lübeck", "Erfurt",
  "Rostock", "Kassel", "Potsdam", "Saarbrücken", "Heidelberg", "Regensburg", "Würzburg", "Ulm",
  "Ingolstadt", "Osnabrück", "Oldenburg", "Darmstadt", "Heilbronn", "Paderborn", "Wolfsburg",
  "Göttingen", "Koblenz", "Trier", "Jena", "Konstanz", "Flensburg", "Bamberg", "Passau",
  "Wien", "Salzburg", "Graz", "Linz", "Innsbruck", "Zürich", "Bern", "Basel", "Genf", "Luzern",
];

export const EN_CITIES = [
  "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow", "Edinburgh", "Bristol",
  "Sheffield", "Cardiff", "Belfast", "Newcastle upon Tyne", "Nottingham", "Brighton", "Oxford",
  "Cambridge", "Dublin", "Cork", "Galway",
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio",
  "San Diego", "Dallas", "Austin", "San Jose", "San Francisco", "Seattle", "Denver", "Boston",
  "Miami", "Atlanta", "Las Vegas", "Orlando", "Washington, D.C.", "Nashville", "New Orleans",
  "Portland", "Detroit", "Minneapolis",
  "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City", "Halifax",
  "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast", "Hobart",
  "Auckland", "Wellington", "Christchurch",
  "Singapore", "Cape Town", "Johannesburg", "Durban", "Valletta",
];

export const ES_CITIES = [
  // España
  "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Palma de Mallorca",
  "Las Palmas de Gran Canaria", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón",
  "Granada", "A Coruña", "Vitoria-Gasteiz", "Elche", "Santa Cruz de Tenerife", "Oviedo", "Pamplona",
  "Santander", "Salamanca", "San Sebastián", "Toledo", "Marbella", "Ibiza", "Cádiz", "Tarragona",
  // México
  "Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Querétaro",
  "Mérida", "Cancún", "Toluca", "Ciudad Juárez", "Acapulco", "Oaxaca", "Puerto Vallarta",
  // Argentina
  "Buenos Aires", "Córdoba (Argentina)", "Rosario", "Mendoza", "La Plata", "Mar del Plata",
  "San Miguel de Tucumán", "Salta", "Bariloche",
  // Colombia
  "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Santa Marta", "Pereira",
  // Chile
  "Santiago de Chile", "Valparaíso", "Viña del Mar", "Concepción", "Antofagasta", "La Serena",
  // Perú
  "Lima", "Arequipa", "Trujillo", "Cusco", "Chiclayo", "Piura",
  // Venezuela
  "Caracas", "Maracaibo", "Valencia (Venezuela)", "Barquisimeto", "Maracay",
  // Ecuador / Bolivia / Paraguay / Uruguay
  "Quito", "Guayaquil", "Cuenca", "La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre",
  "Asunción", "Ciudad del Este", "Montevideo", "Punta del Este",
  // Centroamérica y Caribe
  "Ciudad de Panamá", "San José (Costa Rica)", "Managua", "Tegucigalpa", "San Salvador",
  "Ciudad de Guatemala", "La Habana", "Santiago de Cuba", "Santo Domingo", "Punta Cana",
  "San Juan (Puerto Rico)", "Ponce",
  // Guinea Ecuatorial
  "Malabo", "Bata",
];

/** ISO-Codes aller Länder mit Spanisch als Amtssprache. */
export const ES_COUNTRY_CODES = [
  "es", "mx", "ar", "co", "cl", "pe", "ve", "ec", "bo", "py", "uy",
  "cr", "pa", "ni", "hn", "sv", "gt", "cu", "do", "pr", "gq",
];

/** Diakritika-unempfindliche Normalisierung. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type GeoScope = "world" | "es";

export function cityPool(scope: GeoScope, extra: string[] = []): string[] {
  const base = scope === "es" ? ES_CITIES : [...DE_CITIES, ...EN_CITIES, ...ES_CITIES];
  const set = new Set<string>([...base, ...(scope === "es" ? [] : extra)]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export function filterCities(pool: string[], query: string, limit = 6): string[] {
  const q = normalize(query);
  if (!q) return pool.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const c of pool) {
    const n = normalize(c);
    if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Relevanz eines Labels für eine Query (akzentunabhängig).
 * 0 = exakt, 1 = Präfix, 2 = Wortanfang, 3 = enthalten, -1 = kein Treffer.
 */
export function rankScore(label: string, query: string): number {
  const q = normalize(query);
  if (!q) return 3;
  const n = normalize(label);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const idx = n.indexOf(q);
  if (idx === -1) return -1;
  const prev = n[idx - 1];
  if (prev && /[\s,.\-/(]/.test(prev)) return 2;
  return 3;
}

/** Sortiert Vorschläge: exakt > Präfix > Wortanfang > enthalten, dann kürzer, dann alphabetisch. */
export function rankMatches(items: string[], query: string, limit = 8): string[] {
  const unique = Array.from(new Set(items));
  const scored = unique
    .map((label, i) => ({ label, i, score: rankScore(label, query) }))
    .filter((e) => e.score >= 0);
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.label.length - b.label.length ||
      a.label.localeCompare(b.label, "es") ||
      a.i - b.i,
  );
  return scored.slice(0, limit).map((e) => e.label);
}

export function photonUrl(query: string, lang: "de" | "en" | "es", scope: GeoScope): string {
  const params = new URLSearchParams({ lang, limit: "8", q: query });
  const base = `https://photon.komoot.io/api/?${params.toString()}`;
  if (scope !== "es") return base;
  // Bias auf Spanien/Lateinamerika; Feinfilter erfolgt clientseitig über das Land.
  return `${base}&lat=19.43&lon=-99.13`;
}

const ES_COUNTRY_NAMES = new Set(
  [
    "spain", "espana", "mexico", "argentina", "colombia", "chile", "peru", "venezuela",
    "ecuador", "bolivia", "paraguay", "uruguay", "costa rica", "panama", "nicaragua",
    "honduras", "el salvador", "guatemala", "cuba", "dominican republic", "republica dominicana",
    "puerto rico", "equatorial guinea", "guinea ecuatorial", "mejico", "espagne",
  ].map(normalize),
);

export type PhotonFeature = { properties?: Record<string, string> };

export function isSpanishSpeaking(props: Record<string, string>): boolean {
  const code = (props["countrycode"] || "").toLowerCase();
  if (code) return ES_COUNTRY_CODES.includes(code);
  return ES_COUNTRY_NAMES.has(normalize(props["country"] || ""));
}

export function featureLabel(props: Record<string, string>): string {
  const street = [props["street"] || props["name"], props["housenumber"]].filter(Boolean).join(" ");
  const city = [props["postcode"], props["city"] || props["name"]].filter(Boolean).join(" ");
  const region = props["state"] || props["county"] || "";
  const label = [street, city, region, props["country"]]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
  return label || String(props["name"] || "");
}

export function parseFeatures(
  json: { features?: PhotonFeature[] } | null | undefined,
  scope: GeoScope,
): string[] {
  const feats = json?.features || [];
  const labels = feats
    .filter((f) => (scope === "es" ? isSpanishSpeaking(f.properties || {}) : true))
    .map((f) => featureLabel(f.properties || {}))
    .filter(Boolean);
  return Array.from(new Set(labels));
}

/** Kleiner LRU-Cache für Geocoding-Antworten. */
export function createGeoCache(max = 50) {
  const map = new Map<string, string[]>();
  return {
    get(key: string): string[] | undefined {
      if (!map.has(key)) return undefined;
      const v = map.get(key)!;
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key: string, value: string[]) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > max) map.delete(map.keys().next().value as string);
    },
    get size() {
      return map.size;
    },
  };
}

/** Zerlegt ein Label akzentunabhängig in Treffer-/Nicht-Treffer-Segmente. */
export type MatchSegment = { text: string; match: boolean };

export function highlightSegments(label: string, query: string): MatchSegment[] {
  const q = normalize(query);
  if (!q) return [{ text: label, match: false }];

  // Zeichenweise Normalisierung mit Index-Zuordnung auf das Original.
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < label.length; i++) {
    const n = normalize(label[i]!);
    for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
  }

  const ranges: [number, number][] = [];
  let from = 0;
  while (from <= norm.length - q.length) {
    const idx = norm.indexOf(q, from);
    if (idx === -1) break;
    const start = map[idx]!;
    const end = (map[idx + q.length - 1] ?? map[map.length - 1]!) + 1;
    ranges.push([start, end]);
    from = idx + q.length;
  }
  if (!ranges.length) return [{ text: label, match: false }];

  const out: MatchSegment[] = [];
  let cursor = 0;
  for (const [s, e] of ranges) {
    if (s > cursor) out.push({ text: label.slice(cursor, s), match: false });
    out.push({ text: label.slice(s, e), match: true });
    cursor = e;
  }
  if (cursor < label.length) out.push({ text: label.slice(cursor), match: false });
  return out;
}

/** Scope aus einem Query-String lesen (ungültige Werte -> "world"). */
export function scopeFromSearch(search: string): GeoScope {
  try {
    const v = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      .get("geo");
    return (v || "").toLowerCase() === "es" ? "es" : "world";
  } catch {
    return "world";
  }
}

/** Query-String mit gesetztem/entferntem geo-Parameter erzeugen. */
export function searchWithScope(search: string, scope: GeoScope): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (scope === "es") params.set("geo", "es");
  else params.delete("geo");
  const s = params.toString();
  return s ? `?${s}` : "";
}
