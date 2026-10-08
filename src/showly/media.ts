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
  /** Örtliche Kennung, oder "c:<uuid>" für eine Datei auf dem Server */
  id: string;
  kind: MediaKind;
  name?: string;
  /** Seitenverhältnis, damit die Kachel vor dem Laden schon Platz hat. */
  ratio?: number;
}

/** Freigabe einer Server-Datei durch das Team */
export type MediaStatus = "pending" | "approved" | "rejected";
export const isCloudMedia = (id: string) => id.startsWith("c:");

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
    /* Immer neu zeichnen, auch kleine Fotos: Dabei fallen EXIF-Daten mit
       Aufnahmeort (GPS), Kamera und Datum weg. Die Drehung übernimmt der
       Browser beim Zeichnen. */

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, ratio };
    /* JPEG kennt keine Transparenz: weißer Grund statt schwarzer Flächen */
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", JPEG_QUALITY),
    );
    return { blob: blob ?? file, ratio };
  } catch {
    return { blob: file, ratio: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto verkleinern und neu zeichnen (ohne EXIF/GPS), z. B. für Chat-Anhänge */
export async function cleanImage(file: File): Promise<Blob> {
  return (await shrinkImage(file)).blob;
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

/* Prüfstatus der Server-Dateien, soweit die fragende Person ihn sehen darf
   (eigene Dateien und Verwaltung; bei fremden nur "approved"). */
const statusCache = new Map<string, { status: MediaStatus; reason: string | null }>();

export function mediaStatusSync(id: string) {
  return statusCache.get(id) ?? null;
}

function notify() {
  mediaVer += 1;
  mediaListeners.forEach((fn) => fn());
}

/* Adressen von Server-Dateien gesammelt holen. Der Server gibt nur heraus,
   was die Person sehen darf; alles andere bleibt ohne Adresse und wird
   deshalb nirgends angezeigt. */
async function resolveCloud(ids: string[], force = false): Promise<void> {
  const want = ids.filter((id) => isCloudMedia(id) && (force || !urlCache.has(id)));
  if (!want.length) return;
  try {
    const { mediaUrls } = await import("@/utils/media.functions");
    for (let i = 0; i < want.length; i += 80) {
      const part = want.slice(i, i + 80);
      const { items } = await mediaUrls({ data: { ids: part.map((x) => x.slice(2)) } });
      for (const it of items) {
        const key = "c:" + it.id;
        statusCache.set(key, { status: it.status, reason: it.reason });
        /* Eigene Vorschau aus dem Browser-Speicher behalten, sonst Server-Adresse */
        if (!urlCache.has(key) || force) {
          const local = await localBlobUrl(key);
          urlCache.set(key, local ?? it.url);
        }
      }
    }
    notify();
  } catch {
    /* Server nicht erreichbar: ohne Adresse wird die Datei nicht angezeigt */
  }
}

/** Prüfstatus eigener Server-Dateien neu laden (Profilbearbeitung) */
export function refreshMediaStatus(ids: string[]) {
  return resolveCloud(ids, true);
}

async function localBlobUrl(id: string): Promise<string | null> {
  try {
    const blob = await tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** Die gespeicherte Datei (für das Hochladen auf den Server) */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    return (await tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>)) ?? null;
  } catch {
    return null;
  }
}

/** Nach dem Hochladen: örtliche Kopie unter der Server-Kennung ablegen,
 *  damit die eigene Vorschau sofort und ohne Netz da ist. */
export async function rekeyMedia(oldId: string, newId: string, status: MediaStatus = "pending") {
  const blob = await getMediaBlob(oldId);
  if (blob) await tx("readwrite", (s) => s.put(blob, newId) as IDBRequest<IDBValidKey>).catch(() => null);
  const url = urlCache.get(oldId);
  if (url) urlCache.set(newId, url);
  urlCache.delete(oldId);
  await tx("readwrite", (s) => s.delete(oldId) as IDBRequest<undefined>).catch(() => null);
  statusCache.set(newId, { status, reason: null });
  notify();
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
  /* Server-Dateien: zuerst die eigene Kopie im Browser, sonst gesammelt vom Server */
  const cloud = ids.filter((id) => id && isCloudMedia(id) && !urlCache.has(id));
  const missing: string[] = [];
  for (const id of cloud) {
    const local = await localBlobUrl(id);
    if (local) urlCache.set(id, local);
    else missing.push(id);
  }
  await resolveCloud(missing);
  let added = cloud.length > missing.length;
  for (const id of ids.filter((x) => !isCloudMedia(x))) {
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
  if (isCloudMedia(id)) {
    const local = await localBlobUrl(id);
    if (local) {
      urlCache.set(id, local);
      return local;
    }
    await resolveCloud([id]);
    return urlCache.get(id) ?? null;
  }
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
  /* Server-Datei: auch dort löschen (nur eigene; der Server prüft das) */
  if (isCloudMedia(id)) {
    void import("@/utils/media.functions")
      .then(({ deleteMyMedia }) => deleteMyMedia({ data: { id: id.slice(2) } }))
      .catch(() => null);
    statusCache.delete(id);
  }
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
