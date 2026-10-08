/* Beiträge und Bewertungen, die Gäste selbst schreiben.
 *
 * Zwei Sorten, dieselbe Grundlage:
 *  - Bewertung: gehört zu genau einem Künstlerprofil, hat Sterne.
 *  - Beitrag: steht im Veranstaltungs-Blog, kann ein Profil erwähnen.
 * Text und Kennungen liegen im localStorage, die Dateien in IndexedDB
 * (siehe media.ts). Änderungen werden gemeldet, damit offene Ansichten
 * sich sofort aktualisieren. */
import { loadJSON, saveJSON } from "./persist";
import { deleteMedia, preloadMedia, type MediaRef } from "./media";
import { cloudUser } from "./cloudMedia";

/* Mit Datenbank (und Anmeldung beim Schreiben) liegen Bewertungen und
 * Beiträge auf dem Server (utils/community.functions.ts) und alle sehen sie.
 * Ihre Kennungen beginnen mit "db:". Ohne Datenbank bleibt alles wie bisher
 * im Browser (Übungsbetrieb). */
export const isCloudItem = (id: string) => id.startsWith("db:");
const dbId = (id: string) => Number(id.slice(3));

export type CommunityResult = { ok: true } | { error: string } | { needLogin: true };

export interface UserReview {
  id: string;
  artistId: number;
  author: string;
  rating: number;
  text: string;
  dateISO: string;
  eventDate?: string;
  media: MediaRef[];
  /** Nur bei Einträgen aus der Datenbank: von der angemeldeten Person */
  mine?: boolean;
  /** nach echter Buchung geschrieben ("Verifizierte Buchung") */
  verified?: boolean;
  /** Teilnoten: Pünktlichkeit, Qualität, Kinderfreundlichkeit, Preis-Leistung */
  sub?: Record<string, number>;
  /** öffentliche Antwort des Anbieters */
  reply?: string;
  /** noch verdeckt (doppelt verdeckt bis beide bewertet haben oder 14 Tage um) */
  hidden?: boolean;
}

export interface PostComment {
  id: string;
  author: string;
  text: string;
  dateISO: string;
  mine?: boolean;
}

export interface Post {
  id: string;
  author: string;
  text: string;
  dateISO: string;
  media: MediaRef[];
  /** Markierte Künstlerprofile. Ein Event hat oft mehrere Acts. */
  artistIds: number[];
  /** Gesetzt, wenn ein Künstler selbst schreibt: verweist auf sein Profil. */
  authorProviderId?: number;
  authorRole?: "customer" | "artist" | "planner";
  city?: string;
  likes: number;
  liked: boolean;
  comments: PostComment[];
  mine?: boolean;
}

const REVIEW_KEY = "reviews.user";
const POST_KEY = "posts";

let reviews: UserReview[] = [];
let posts: Post[] = [];
let cloudReviews: UserReview[] = [];
let cloudPosts: Post[] = [];
/* Zusammengeführte Listen; neue Liste nur bei Änderung (useSyncExternalStore) */
let allReviews: UserReview[] = [];
let allPosts: Post[] = [];
let loaded = false;

const listeners = new Set<() => void>();

function ensure() {
  if (loaded || typeof window === "undefined") return;
  reviews = loadJSON<UserReview[]>(REVIEW_KEY, []);

  /* Früher trug ein Beitrag höchstens ein Profil im Feld artistId. Beim Laden
     wird daraus die Liste artistIds, damit alte Beiträge nicht verschwinden. */
  const raw = loadJSON<(Post & { artistId?: number })[]>(POST_KEY, []);
  posts = raw.map((p) => ({
    ...p,
    artistIds: Array.isArray(p.artistIds)
      ? p.artistIds
      : typeof p.artistId === "number"
        ? [p.artistId]
        : [],
  }));
  loaded = true;
  merge();
}

function merge() {
  allReviews = [...cloudReviews, ...reviews];
  allPosts = [...cloudPosts, ...posts].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
}

function publish() {
  saveJSON(REVIEW_KEY, reviews);
  saveJSON(POST_KEY, posts);
  merge();
  listeners.forEach((fn) => fn());
}

let syncing: Promise<void> | null = null;

/** Bewertungen und Beiträge vom Server holen (nur mit Datenbank) */
export function syncCommunity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    const { isBackendConfigured } = await import("@/lib/supabase");
    if (!isBackendConfigured()) return;
    const { listCommunity } = await import("@/utils/community.functions");
    const r = await listCommunity().catch(() => null);
    if (!r) return;
    ensure();
    cloudReviews = r.reviews.map((x) => ({ ...x, id: "db:" + x.id, media: x.media as MediaRef[] }));
    cloudPosts = r.posts.map((x) => ({
      ...x,
      id: "db:" + x.id,
      media: x.media as MediaRef[],
      comments: x.comments.map((c) => ({ ...c, id: "db:" + c.id })),
    }));
    void preloadMedia(
      [...cloudReviews, ...cloudPosts].flatMap((x) => x.media.filter((m) => m.kind === "image").map((m) => m.id)),
    );
    merge();
    listeners.forEach((fn) => fn());
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** Mit Datenbank: angemeldet? Ohne Datenbank: null (dann örtlich speichern) */
async function cloudMode(): Promise<"off" | "user" | "anon"> {
  const { isBackendConfigured } = await import("@/lib/supabase");
  if (!isBackendConfigured()) return "off";
  return (await cloudUser()) ? "user" : "anon";
}

const cloudMedia = (m: MediaRef[]) => m.filter((x) => x.id.startsWith("c:"));

let firstSync = false;

export function subscribe(fn: () => void) {
  ensure();
  if (!firstSync) {
    firstSync = true;
    void syncCommunity();
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function newId(prefix: string) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Bewertungen ---------- */

export function getReviews(artistId: number): UserReview[] {
  ensure();
  return allReviews.filter((r) => r.artistId === artistId);
}

/** Momentaufnahme für useSyncExternalStore: gleiche Liste, gleiche Kennung. */
export function reviewsSnapshot(): UserReview[] {
  ensure();
  return allReviews;
}

export async function addReview(r: Omit<UserReview, "id" | "dateISO">): Promise<CommunityResult> {
  ensure();
  const mode = await cloudMode();
  if (mode === "anon") return { needLogin: true };
  if (mode === "user") {
    const { addReviewCloud } = await import("@/utils/community.functions");
    const res = await addReviewCloud({
      data: {
        artistId: r.artistId,
        name: r.author,
        rating: r.rating,
        text: r.text,
        ...(r.eventDate ? { eventDate: r.eventDate } : {}),
        media: cloudMedia(r.media),
        ...(r.sub ? { sub: r.sub } : {}),
      },
    }).catch(() => ({ error: "Keine Verbindung" }));
    if ("error" in res) return res;
    await syncCommunity();
    return { ok: true };
  }
  reviews = [{ ...r, verified: true, id: newId("r"), dateISO: new Date().toISOString() }, ...reviews];
  publish();
  return { ok: true };
}

export async function removeReview(id: string) {
  ensure();
  if (isCloudItem(id)) {
    const { deleteReviewCloud } = await import("@/utils/community.functions");
    await deleteReviewCloud({ data: { id: dbId(id) } }).catch(() => null);
    return syncCommunity();
  }
  const gone = reviews.find((r) => r.id === id);
  gone?.media.forEach((m) => void deleteMedia(m.id));
  reviews = reviews.filter((r) => r.id !== id);
  publish();
}

/* ---------- Beiträge ---------- */

export function postsSnapshot(): Post[] {
  ensure();
  return allPosts;
}

export async function addPost(
  p: Omit<Post, "id" | "dateISO" | "likes" | "liked" | "comments">,
): Promise<CommunityResult> {
  ensure();
  const mode = await cloudMode();
  if (mode === "anon") return { needLogin: true };
  if (mode === "user") {
    const { addPostCloud } = await import("@/utils/community.functions");
    const res = await addPostCloud({
      data: {
        name: p.author,
        text: p.text,
        ...(p.city ? { city: p.city } : {}),
        artistIds: p.artistIds,
        media: cloudMedia(p.media),
      },
    }).catch(() => ({ error: "Keine Verbindung" }));
    if ("error" in res) return res;
    await syncCommunity();
    return { ok: true };
  }
  posts = [
    { ...p, id: newId("p"), dateISO: new Date().toISOString(), likes: 0, liked: false, comments: [] },
    ...posts,
  ];
  publish();
  return { ok: true };
}

export async function removePost(id: string) {
  ensure();
  if (isCloudItem(id)) {
    const { deletePostCloud } = await import("@/utils/community.functions");
    await deletePostCloud({ data: { id: dbId(id) } }).catch(() => null);
    return syncCommunity();
  }
  const gone = posts.find((p) => p.id === id);
  gone?.media.forEach((m) => void deleteMedia(m.id));
  posts = posts.filter((p) => p.id !== id);
  publish();
}

export async function toggleLike(id: string) {
  ensure();
  if (isCloudItem(id)) {
    if ((await cloudMode()) !== "user") return;
    /* Sofort anzeigen, dann mit dem Server abgleichen */
    cloudPosts = cloudPosts.map((p) =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
    );
    merge();
    listeners.forEach((fn) => fn());
    const { toggleLikeCloud } = await import("@/utils/community.functions");
    await toggleLikeCloud({ data: { id: dbId(id) } }).catch(() => null);
    return syncCommunity();
  }
  posts = posts.map((p) =>
    p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
  );
  publish();
}

export async function addComment(postId: string, author: string, text: string): Promise<CommunityResult> {
  ensure();
  if (isCloudItem(postId)) {
    if ((await cloudMode()) !== "user") return { needLogin: true };
    const { addCommentCloud } = await import("@/utils/community.functions");
    const res = await addCommentCloud({ data: { postId: dbId(postId), name: author, text } }).catch(() => ({
      error: "Keine Verbindung",
    }));
    if ("error" in res) return res;
    await syncCommunity();
    return { ok: true };
  }
  posts = posts.map((p) =>
    p.id === postId
      ? {
          ...p,
          comments: [
            ...p.comments,
            { id: newId("c"), author, text, dateISO: new Date().toISOString() },
          ],
        }
      : p,
  );
  publish();
  return { ok: true };
}

/** Beim Löschen des Kontos: alle Beiträge, Kommentare und Bewertungen
 *  dieser Person samt Fotos und Videos wirklich entfernen. */
export function removeAllBy(author: string) {
  ensure();
  const mine = (a: string) => a.trim().toLowerCase() === author.trim().toLowerCase();
  for (const r of reviews) if (mine(r.author)) r.media.forEach((m) => void deleteMedia(m.id));
  for (const p of posts) if (mine(p.author)) p.media.forEach((m) => void deleteMedia(m.id));
  reviews = reviews.filter((r) => !mine(r.author));
  posts = posts
    .filter((p) => !mine(p.author))
    .map((p) => ({ ...p, comments: p.comments.filter((c) => !mine(c.author)) }));
  publish();
}
