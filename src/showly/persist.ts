/* Lokale Persistenz: Buchungen, Bestellungen, Konto & neu registrierte Künstler
   überleben einen Reload (bis ein echtes Backend angebunden wird). */
import { ARTISTS } from "@/showly/data";

const PREFIX = "showly.";

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

/** Neu registrierte Künstlerprofile ablegen. */
export function saveArtistProfile(prof: unknown) {
  const list = loadJSON<unknown[]>("artists", []);
  list.push(prof);
  saveJSON("artists", list);
}

/** Gespeicherte Profile beim Start in den Katalog zurückspielen.
 *
 * Kommt eine Kennung schon im Katalog vor, weil dort inzwischen neue Profile
 * dazugekommen sind, bekommt das gespeicherte Profil eine freie Kennung statt
 * übergangen zu werden. Sonst verschwände ein selbst angelegtes Profil
 * stillschweigend, und zwei Einträge trügen dieselbe Kennung. */
let hydrated = false;

export function hydrateArtists() {
  /* Nur einmal je Sitzung. Ohne diese Sperre landet bei jedem weiteren Aufruf
     dieselbe Person ein zweites Mal im Katalog. */
  const list = loadJSON<{ id: number }[]>("artists", []);
  if (hydrated) return list.length;
  hydrated = true;
  let changed = false;

  for (const a of list) {
    if (!a || typeof a.id !== "number") continue;

    if (ARTISTS.some((x) => x.id === a.id)) {
      const free = Math.max(0, ...ARTISTS.map((x) => x.id), ...list.map((x) => x?.id ?? 0)) + 1;
      a.id = free;
      changed = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ARTISTS.push(a as any);
  }

  if (changed) saveJSON("artists", list);

  /* Änderungen, die Künstler an Profilen aus dem festen Katalog vorgenommen
     haben. Selbst angelegte Profile tragen ihre Änderungen direkt in sich. */
  const edits = loadJSON<Record<string, Record<string, unknown>>>("artistEdits", {});
  for (const [id, patch] of Object.entries(edits)) {
    const inCat = ARTISTS.find((x) => x.id === Number(id));
    if (inCat && patch) Object.assign(inCat, stripLocked(patch));
  }
  return list.length;
}

/* Diese Felder ändert kein Künstler selbst. Name und Geburtsdatum kommen aus
   der Ausweisprüfung, Bewertungen und Siegel vergibt Showly. Sie werden aus
   jeder Änderung entfernt, bevor sie gespeichert oder übernommen wird.
   Hinweis: Das schützt nur die Oberfläche. Solange die Profile im Browser
   liegen, gehört dieselbe Sperre zusätzlich in die Datenbank
   (Row Level Security, siehe supabase/migrations). */
const LOCKED = ["id", "real", "birthDate", "verified", "rating", "reviews", "superhost", "events", "kind"];

function stripLocked(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (!LOCKED.includes(k)) out[k] = v;
  return out;
}

/** Ein gespeichertes Künstlerprofil aktualisieren (auch im Katalog). */
export function updateArtistProfile(id: number, rawPatch: Record<string, unknown>) {
  const patch = stripLocked(rawPatch);
  const list = loadJSON<Record<string, unknown>[]>("artists", []);
  if (list.some((a) => a && a["id"] === id)) {
    saveJSON(
      "artists",
      list.map((a) => (a && a["id"] === id ? { ...a, ...patch } : a)),
    );
  } else {
    const edits = loadJSON<Record<string, Record<string, unknown>>>("artistEdits", {});
    edits[String(id)] = { ...(edits[String(id)] || {}), ...patch };
    saveJSON("artistEdits", edits);
  }
  const inCat = ARTISTS.find((x: { id: number }) => x.id === id);
  if (inCat) Object.assign(inCat, patch);
}

/* ---------- Lokale Künstler-Konten (Anmeldung ohne Backend) ---------- */
export interface Account {
  email: string;
  pwHash: string;
  name: string;
  /* "customer" ist der normale Gast, der bucht und bewertet. */
  role: "artist" | "planner" | "customer";
  /* Nur Anbieter haben ein eigenes Profil im Katalog. */
  providerId?: number;
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function saveAccount(a: Omit<Account, "pwHash"> & { pw: string }) {
  const list = loadJSON<Account[]>("accounts", []);
  const email = a.email.trim().toLowerCase();
  const next = list.filter((x) => x.email !== email);
  next.push({
    email,
    pwHash: hash(a.pw),
    name: a.name,
    role: a.role,
    ...(a.providerId !== undefined ? { providerId: a.providerId } : {}),
  });
  saveJSON("accounts", next);
}

export function findAccount(email: string, pw: string): Account | null {
  const list = loadJSON<Account[]>("accounts", []);
  const e = email.trim().toLowerCase();
  return list.find((x) => x.email === e && x.pwHash === hash(pw)) ?? null;
}

/** Konto aus dem Browser entfernen, bei Anbietern auch das eigene Profil. */
export function deleteLocalAccount(email: string, providerId?: number) {
  const e = email.trim().toLowerCase();
  saveJSON(
    "accounts",
    loadJSON<Account[]>("accounts", []).filter((x) => x.email !== e),
  );
  if (providerId === undefined) return;
  const stored = loadJSON<Record<string, unknown>[]>("artists", []);
  const wasOwn = stored.some((a) => a && a["id"] === providerId);
  saveJSON(
    "artists",
    stored.filter((a) => a && a["id"] !== providerId),
  );
  const edits = loadJSON<Record<string, unknown>>("artistEdits", {});
  delete edits[String(providerId)];
  saveJSON("artistEdits", edits);
  const i = ARTISTS.findIndex((x: { id: number }) => x.id === providerId);
  /* Nur selbst angelegte Profile verschwinden sofort; Beispielprofile aus dem
     festen Katalog bleiben in dieser Vorschau stehen. */
  if (i >= 0 && wasOwn) ARTISTS.splice(i, 1);
}

/** Gibt es zu dieser Adresse schon ein Konto? */
export function accountExists(email: string): boolean {
  const list = loadJSON<Account[]>("accounts", []);
  const e = email.trim().toLowerCase();
  return list.some((x) => x.email === e);
}
