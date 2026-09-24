/* Beiträge und Bewertungen, die Gäste selbst schreiben.
 *
 * Zwei Sorten, dieselbe Grundlage:
 *  - Bewertung: gehört zu genau einem Künstlerprofil, hat Sterne.
 *  - Beitrag: steht im Veranstaltungs-Blog, kann ein Profil erwähnen.
 * Text und Kennungen liegen im localStorage, die Dateien in IndexedDB
 * (siehe media.ts). Änderungen werden gemeldet, damit offene Ansichten
 * sich sofort aktualisieren. */
import { loadJSON, saveJSON } from "./persist";
import { deleteMedia, type MediaRef } from "./media";

export interface UserReview {
  id: string;
  artistId: number;
  author: string;
  rating: number;
  text: string;
  dateISO: string;
  eventDate?: string;
  media: MediaRef[];
}

export interface PostComment {
  id: string;
  author: string;
  text: string;
  dateISO: string;
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
}

const REVIEW_KEY = "reviews.user";
const POST_KEY = "posts";

let reviews: UserReview[] = [];
let posts: Post[] = [];
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
}

function publish() {
  saveJSON(REVIEW_KEY, reviews);
  saveJSON(POST_KEY, posts);
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  ensure();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function newId(prefix: string) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Bewertungen ---------- */

export function getReviews(artistId: number): UserReview[] {
  ensure();
  return reviews.filter((r) => r.artistId === artistId);
}

/** Momentaufnahme für useSyncExternalStore: gleiche Liste, gleiche Kennung. */
export function reviewsSnapshot(): UserReview[] {
  ensure();
  return reviews;
}

export function addReview(r: Omit<UserReview, "id" | "dateISO">) {
  ensure();
  reviews = [{ ...r, id: newId("r"), dateISO: new Date().toISOString() }, ...reviews];
  publish();
}

export function removeReview(id: string) {
  ensure();
  const gone = reviews.find((r) => r.id === id);
  gone?.media.forEach((m) => void deleteMedia(m.id));
  reviews = reviews.filter((r) => r.id !== id);
  publish();
}

/* ---------- Beiträge ---------- */

export function postsSnapshot(): Post[] {
  ensure();
  return posts;
}

export function addPost(p: Omit<Post, "id" | "dateISO" | "likes" | "liked" | "comments">) {
  ensure();
  posts = [
    { ...p, id: newId("p"), dateISO: new Date().toISOString(), likes: 0, liked: false, comments: [] },
    ...posts,
  ];
  publish();
}

export function removePost(id: string) {
  ensure();
  const gone = posts.find((p) => p.id === id);
  gone?.media.forEach((m) => void deleteMedia(m.id));
  posts = posts.filter((p) => p.id !== id);
  publish();
}

export function toggleLike(id: string) {
  ensure();
  posts = posts.map((p) =>
    p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
  );
  publish();
}

export function addComment(postId: string, author: string, text: string) {
  ensure();
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
}
