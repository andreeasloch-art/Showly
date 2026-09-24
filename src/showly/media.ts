/* Ablage für Fotos und Videos, die Kundinnen und Kunden hochladen.
 *
 * Warum eine eigene Ablage: Der übrige Zustand liegt im localStorage, der
 * fasst nur wenige Megabyte. Ein einziges Handyvideo sprengt das sofort.
 * Die Dateien liegen deshalb in IndexedDB, in den Beiträgen steht nur die
 * Kennung. Bilder werden vorher verkleinert, damit aus einem 8-Megapixel-Foto
 * keine mehrere Megabyte große Ablage wird.
 *
 * Sobald ein Server dahintersteht, wird hier hochgeladen statt gespeichert –
 * die Schnittstelle (putMedia, mediaUrl, deleteMedia) bleibt dieselbe. */

export type MediaKind = "image" | "video";

export interface MediaRef {
  id: string;
  kind: MediaKind;
  name?: string;
  /** Seitenverhältnis, damit die Kachel vor dem Laden schon Platz hat. */
  ratio?: number;
}

const DB_NAME = "showly-media";
const STORE = "files";
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_FILES_PER_POST = 8;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("kein IndexedDB"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function newId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Große Bilder auf eine sinnvolle Kantenlänge bringen. Schlägt das fehl,
   etwa bei HEIC ohne Browser-Unterstützung, wird das Original behalten. */
async function shrinkImage(file: File): Promise<{ blob: Blob; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Bild nicht lesbar"));
      el.src = url;
    });
    const ratio = img.naturalWidth / img.naturalHeight || 1;
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale >= 1 && file.size < 900_000) return { blob: file, ratio };

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, ratio };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", JPEG_QUALITY),
    );
    return { blob: blob && blob.size < file.size ? blob : file, ratio };
  } catch {
    return { blob: file, ratio: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class MediaError extends Error {
  constructor(public reason: "type" | "size" | "store") {
    super(reason);
  }
}

/** Eine Datei ablegen und die Kennung zurückgeben. */
export async function putMedia(file: File): Promise<MediaRef> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new MediaError("type");
  if (isVideo && file.size > MAX_VIDEO_BYTES) throw new MediaError("size");

  let blob: Blob = file;
  let ratio = isVideo ? 16 / 9 : 1;
  if (isImage) {
    const out = await shrinkImage(file);
    blob = out.blob;
    ratio = out.ratio;
  }

  const id = newId();
  try {
    await tx("readwrite", (s) => s.put(blob, id) as IDBRequest<IDBValidKey>);
  } catch {
    throw new MediaError("store");
  }
  return { id, kind: isImage ? "image" : "video", name: file.name, ratio };
}

const urlCache = new Map<string, string>();

/* Profilbilder und Figurenbilder werden an vielen Stellen als Hintergrund
   gesetzt, synchron beim Zeichnen. Deshalb werden ihre Adressen einmal beim
   Start geladen; danach sind sie hier ohne Warten abrufbar. Wer auf neue
   Adressen reagieren muss, meldet sich mit subscribeMedia an. */
const mediaListeners = new Set<() => void>();
let mediaVer = 0;

export function mediaUrlSync(id: string): string | null {
  return urlCache.get(id) ?? null;
}

export function subscribeMedia(fn: () => void) {
  mediaListeners.add(fn);
  return () => {
    mediaListeners.delete(fn);
  };
}

export function mediaVersion() {
  return mediaVer;
}

export async function preloadMedia(ids: string[]) {
  let added = false;
  for (const id of ids) {
    if (!id || urlCache.has(id)) continue;
    if (await mediaUrl(id)) added = true;
  }
  if (added) {
    mediaVer += 1;
    mediaListeners.forEach((fn) => fn());
  }
}

/** Adresse zum Anzeigen. Wird je Sitzung nur einmal erzeugt. */
export async function mediaUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  try {
    const blob = await tx<Blob | undefined>("readonly",
      (s) => s.get(id) as IDBRequest<Blob | undefined>);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export async function deleteMedia(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  try {
    await tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  } catch {
    /* schon weg */
  }
}
