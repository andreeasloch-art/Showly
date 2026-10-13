/* Stories im Browser: Laden, Beispiele, "schon gesehen", Übungsbetrieb.
 *
 * Mit Datenbank kommen die Stories vom Server (utils/story.functions.ts):
 * nur freigegebene, je 24 Stunden ab Freigabe. Solange es dort noch keine
 * gibt (oder ohne Datenbank), füllen Beispiele aus dem Katalog die Leiste;
 * sie tragen im Betrachter das Schild "Beispiel".
 *
 * Ohne Datenbank (Übungsbetrieb) bleibt eine selbst gepostete Story auf
 * diesem Gerät und ist nur hier zu sehen. */
import { ARTISTS } from "./data";
import { VENUES } from "./venues";
import { BAKERS, SWEETS } from "./sweets";
import { sizedSrc } from "./imgSize";

export type StoryKind = "artist" | "baker" | "deco" | "location";

export interface StoryItem {
  id: string;
  /** Adresse der Datei; leer bei örtlichen Dateien (dann ref) */
  url: string;
  /** Örtliche Datei aus media.ts (Übungsbetrieb) */
  ref?: string | undefined;
  kind: "image" | "video";
  caption: string;
  at: string;
}

export interface StoryGroup {
  key: string;
  kind: StoryKind;
  providerId: number;
  name: Record<string, string>;
  city: string;
  cat?: string | undefined;
  /** Kleines Rundbild; sonst das erste Bild der Story */
  avatar?: string | undefined;
  stories: StoryItem[];
  demo?: boolean;
  /** Eigene Story auf diesem Gerät (Übungsbetrieb) */
  local?: boolean;
}

/* ------------------------------------------------------------------ */
/* Beispiele aus dem Katalog                                            */

const T = (de: string, en: string, es: string) => ({ de, en, es });
const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

const ACT_CAPTIONS = [
  T(
    "Kleiner Einblick in meine Show ✨",
    "A little peek at my show ✨",
    "Un vistazo a mi show ✨",
  ),
  T(
    "Noch Termine im nächsten Monat frei",
    "Still free dates next month",
    "Aún quedan fechas el mes que viene",
  ),
  T(
    "Probe für das Wochenende",
    "Rehearsal for the weekend",
    "Ensayo para el fin de semana",
  ),
];
const VENUE_CAPTIONS = [
  T(
    "So sieht es bei uns aus",
    "This is what it looks like here",
    "Así es nuestro espacio",
  ),
  T(
    "Frisch dekoriert für die nächste Feier",
    "Freshly decorated for the next party",
    "Recién decorado para la próxima fiesta",
  ),
];
const SWEET_CAPTIONS = [
  T(
    "Heute aus der Backstube",
    "Fresh from the bakery today",
    "Hoy recién salido del horno",
  ),
  T(
    "Auf Wunsch mit eigenem Motiv",
    "Custom designs on request",
    "Con tu propio diseño si quieres",
  ),
];
const DECO_CAPTIONS = [
  T("Neu im Verleih", "New for rent", "Nuevo en alquiler"),
  T(
    "Deko für jeden Anlass",
    "Decor for every occasion",
    "Decoración para cada ocasión",
  ),
];

/** Bunt gemischt: Zauberer, Märchen, Akrobatik, Sänger, Bands … */
const ACT_ORDER = [
  2, 1, 8, 12, 23, 7, 16, 9, 3, 6, 14, 29, 13, 26, 25, 17, 4, 5, 10, 15, 24, 27,
  11,
];

let demoCache: StoryGroup[] | null = null;

export function demoGroups(): StoryGroup[] {
  if (demoCache) return demoCache;
  const acts: StoryGroup[] = ACT_ORDER.flatMap((id, i) => {
    const a = ARTISTS.find((x) => x.id === id);
    if (!a) return [];
    const img = `/acts/${id}.webp`;
    return [
      {
        key: `demo-artist:${id}`,
        kind: "artist" as const,
        providerId: id,
        name: a.name as Record<string, string>,
        city: String((a.loc as Record<string, string>)?.["de"] || ""),
        cat: a.cat,
        avatar: sizedSrc(img, "s"),
        demo: true,
        stories: [
          {
            id: `demo-a${id}`,
            url: img,
            kind: "image" as const,
            caption: JSON.stringify(ACT_CAPTIONS[i % ACT_CAPTIONS.length]),
            at: hoursAgo(1 + (i % 20)),
          },
        ],
      },
    ];
  });
  const venues: StoryGroup[] = VENUES.slice(0, 8).map((v, i) => ({
    key: `demo-location:${v.id}`,
    kind: "location" as const,
    providerId: v.id,
    name: { de: v.name },
    city: v.city,
    avatar: sizedSrc(v.img || `/venues/${v.id}.webp`, "s"),
    demo: true,
    stories: [
      {
        id: `demo-v${v.id}`,
        url: v.img || `/venues/${v.id}.webp`,
        kind: "image" as const,
        caption: JSON.stringify(VENUE_CAPTIONS[i % VENUE_CAPTIONS.length]),
        at: hoursAgo(2 + i * 2),
      },
    ],
  }));
  const bakers: StoryGroup[] = BAKERS.slice(0, 3).map((b, i) => {
    const imgs = SWEETS.filter((s) => s.bakerId === b.id && s.img)
      .slice(0, 2)
      .map((s) => `/sweets/${s.img}.webp`);
    if (!imgs.length) imgs.push(`/sweets/${b.coverImg || 1}.webp`);
    return {
      key: `demo-baker:${b.id}`,
      kind: "baker" as const,
      providerId: b.id,
      name: b.name as Record<string, string>,
      city: b.city,
      avatar: sizedSrc(imgs[0]!, "s"),
      demo: true,
      stories: imgs.map((u, k) => ({
        id: `demo-b${b.id}-${k}`,
        url: u,
        kind: "image" as const,
        caption: JSON.stringify(
          SWEET_CAPTIONS[(i + k) % SWEET_CAPTIONS.length],
        ),
        at: hoursAgo(3 + i * 3 + k),
      })),
    };
  });
  const deco: StoryGroup = {
    key: "demo-deco:1",
    kind: "deco",
    providerId: 0,
    name: T("Deko & Kostüme", "Decor & costumes", "Decoración y disfraces"),
    city: "",
    avatar: sizedSrc("/shop/3.webp", "s"),
    demo: true,
    stories: [3, 7, 1].map((n, k) => ({
      id: `demo-d${n}`,
      url: `/shop/${n}.webp`,
      kind: "image" as const,
      caption: JSON.stringify(DECO_CAPTIONS[k % DECO_CAPTIONS.length]),
      at: hoursAgo(5 + k),
    })),
  };
  /* Mischen: zwei Acts, dann abwechselnd Location, Torte, Deko */
  const rest: StoryGroup[] = [];
  const others = [
    venues[0],
    bakers[0],
    venues[1],
    deco,
    venues[2],
    bakers[1],
    venues[3],
    venues[4],
    bakers[2],
    venues[5],
    venues[6],
    venues[7],
  ].filter(Boolean) as StoryGroup[];
  let o = 0;
  acts.forEach((g, i) => {
    rest.push(g);
    if (i % 2 === 1 && o < others.length) rest.push(others[o++]!);
  });
  while (o < others.length) rest.push(others[o++]!);
  demoCache = rest;
  return rest;
}

/** Bildunterschrift: bei Beispielen mehrsprachig (JSON), sonst Text */
export function captionText(c: string, lang: string): string {
  if (c.startsWith("{")) {
    try {
      const o = JSON.parse(c) as Record<string, string>;
      return o[lang] || o["de"] || "";
    } catch {
      /* kein JSON */
    }
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Schon gesehen (nur auf diesem Gerät)                                 */

const SEEN_KEY = "showly.storiesSeen";
let seen: Set<string> | null = null;
const listeners = new Set<() => void>();

function loadSeen(): Set<string> {
  if (seen) return seen;
  try {
    seen = new Set(
      JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[],
    );
  } catch {
    seen = new Set();
  }
  return seen;
}

export function isSeen(id: string) {
  return loadSeen().has(id);
}
export function groupSeen(g: StoryGroup) {
  return g.stories.every((s) => isSeen(s.id));
}
export function markSeen(id: string) {
  const s = loadSeen();
  if (s.has(id)) return;
  s.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-500)));
  } catch {
    /* privates Fenster */
  }
  listeners.forEach((f) => f());
}
export function subscribeStories(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const notifyStories = () => listeners.forEach((f) => f());

/* ------------------------------------------------------------------ */
/* Übungsbetrieb: eigene Stories auf diesem Gerät                       */

const LOCAL_KEY = "showly.myLocalStories";
export interface LocalStory {
  id: string;
  ref: string;
  kind: "image" | "video";
  caption: string;
  at: string;
  providerKind: StoryKind;
}

export function localStories(): LocalStory[] {
  try {
    const list = JSON.parse(
      localStorage.getItem(LOCAL_KEY) || "[]",
    ) as LocalStory[];
    const cut = new Date(Date.now() - 86_400_000).toISOString();
    return list.filter((s) => s.at > cut);
  } catch {
    return [];
  }
}
export function saveLocalStories(list: LocalStory[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* privates Fenster */
  }
  notifyStories();
}

/* ------------------------------------------------------------------ */
/* Vom Server laden (einmal pro Seitenaufruf, 5 Minuten gemerkt)        */

let cloud: { at: number; groups: StoryGroup[] } | null = null;
let loading: Promise<StoryGroup[]> | null = null;

export async function loadCloudStories(): Promise<StoryGroup[]> {
  if (cloud && Date.now() - cloud.at < 5 * 60_000) return cloud.groups;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { isBackendConfigured } = await import("@/lib/supabase");
      if (!isBackendConfigured()) return [];
      const { storyFeed } = await import("@/utils/story.functions");
      const r = await storyFeed();
      const groups: StoryGroup[] = r.groups.map((g) => ({
        ...g,
        stories: g.stories.map((s) => ({ ...s })),
      }));
      cloud = { at: Date.now(), groups };
      return groups;
    } catch {
      return [];
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export function invalidateCloudStories() {
  cloud = null;
  notifyStories();
}

/** Wohin "Profil ansehen" führt */
export function profileLink(
  g: Pick<StoryGroup, "kind" | "providerId">,
):
  | {
      to: "/kuenstler/$id" | "/torten/$id" | "/locations/$id";
      params: { id: string };
    }
  | { to: "/shop"; search: { bereich: "deko" } } {
  if (g.kind === "artist")
    return { to: "/kuenstler/$id", params: { id: String(g.providerId) } };
  if (g.kind === "baker")
    return { to: "/torten/$id", params: { id: String(g.providerId) } };
  if (g.kind === "location")
    return { to: "/locations/$id", params: { id: String(g.providerId) } };
  return { to: "/shop", search: { bereich: "deko" } };
}
