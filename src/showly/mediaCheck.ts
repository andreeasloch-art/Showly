/* Prüfung von Fotos und Videos auf Kontaktdaten, bevor sie gespeichert werden.
 *
 * Anbieterinnen und Anbieter dürfen in ihren Bildern und Videos keine
 * Telefonnummern, E-Mail-Adressen, Webseiten, Social-Media-Namen oder
 * QR-Codes zeigen (AGB § 20 Abs. 3). Jede Datei wird deshalb vor dem
 * Speichern geprüft:
 *
 *  - Texterkennung (Tesseract) liest jeden Text im Bild; der Text läuft
 *    durch denselben Filter wie Profiltexte (contactGuard).
 *  - QR-Codes werden erkannt und immer abgelehnt, weil sie fast immer auf
 *    eine Webseite, ein Profil oder eine Nummer führen.
 *  - Bei Videos werden Einzelbilder in gleichmäßigen Abständen geprüft
 *    (höchstens zwölf), und die Länge ist begrenzt.
 *
 * Die Dateien der Texterkennung liegen unter /ocr und werden erst geladen,
 * wenn jemand etwas hochlädt; Kundinnen und Kunden laden sie nie.
 *
 * Grenzen: Sehr kleine, verzerrte oder handschriftliche Schrift wird nicht
 * immer erkannt, gesprochene Nummern im Ton gar nicht (Videos laufen in
 * Profilen deshalb stumm). Die Prüfung läuft im Browser; sobald Dateien auf
 * den Server hochgeladen werden, gehört sie zusätzlich dorthin. */
import { findContact, type ContactKind } from "./contactGuard";

export type MediaFinding = Exclude<ContactKind, "offplatform" | "name"> | "qr";

export interface MediaCheckResult {
  ok: boolean;
  found: MediaFinding[];
  /** Bei Videos: Sekunde, in der etwas gefunden wurde */
  atSecond?: number;
  /** Prüfung war nicht möglich (z. B. Datei nicht lesbar) */
  failed?: boolean;
  /** Video ist zu lang */
  tooLong?: boolean;
  /** Länge des Videos in Sekunden */
  duration?: number;
}

export const MAX_VIDEO_SECONDS = 60;
const MAX_FRAMES = 12;
const OCR_EDGE = 1400;
const QR_EDGE = 900;
const MIN_WORD_CONF = 55;

/* ---------- Texterkennung, einmal geladen und wiederverwendet ---------- */

type OcrWorker = {
  recognize: (img: HTMLCanvasElement, opts?: object, out?: object) => Promise<{ data: OcrData }>;
};
interface OcrWord {
  text: string;
  confidence: number;
}
interface OcrData {
  text?: string;
  blocks?: { paragraphs?: { lines?: { words?: OcrWord[] }[] }[] }[] | null;
}

let workerPromise: Promise<OcrWorker> | null = null;

function ocrBase(): string {
  /* Mit Schrägstrich am Ende: so passt die Vorschau-Erstellung den Pfad an,
     und in der App zeigt er immer auf /ocr/ am Wurzelverzeichnis. */
  if (typeof document === "undefined") return "/ocr";
  return new URL("/ocr/", document.baseURI).href.replace(/\/$/, "");
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const [{ createWorker }, { simd }] = await Promise.all([import("tesseract.js"), import("wasm-feature-detect")]);
      const base = ocrBase();
      const core = (await simd()) ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js";
      const w = await createWorker("eng", 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/${core}`,
        /* Die Sprachdatei liegt als ocr/eng-lang.wasm (gzip-Inhalt): manche
           Hoster liefern .gz/.traineddata nicht aus. Tesseract hängt den
           festen Namen "/eng.traineddata.gz" an; durch das "?f=" landet er
           in der Abfrage und wird ignoriert. */
        langPath: `${base}/eng-lang.wasm?f=`,
        gzip: true,
        workerBlobURL: false,
      });
      return w as unknown as OcrWorker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Erkannter Text: "sure" nur mit Wörtern, bei denen die Erkennung sicher ist
 *  (für den vollen Filter), "raw" alles (nur für eindeutige Muster). */
async function readText(canvas: HTMLCanvasElement): Promise<{ sure: string; raw: string }> {
  const w = await getWorker();
  const { data } = await w.recognize(canvas, {}, { text: true, blocks: true });
  const lines: string[] = [];
  for (const b of data.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) {
        const words = (l.words || []).filter((x) => x.confidence >= MIN_WORD_CONF).map((x) => x.text);
        if (words.length) lines.push(words.join(" "));
      }
    }
  }
  return { sure: lines.join("\n"), raw: data.text || "" };
}

/* Eindeutige Muster, die auch in unsicher erkanntem Text zählen. Zufälliges
   Bildrauschen erzeugt so etwas praktisch nie. */
const RAW_EMAIL = /[a-z0-9._%+-]{2,}\s?@\s?[a-z0-9-]{3,}/i;
const RAW_HANDLE = /@[a-z0-9_.]{4,}/i;
/* Nummer, die mit + oder 0 beginnt, mindestens neun Ziffern, nur Leerzeichen,
   Schrägstrich oder Strich dazwischen */
const RAW_PHONE = /(?:\+|\b0)\d(?:[ /-]?\d){8,}/;
const RAW_WEB = /\bwww\.[a-z0-9-]{3,}|https?:\/\/[a-z0-9-]{3,}|\b[a-z0-9-]{4,}\.(?:de|com|at|ch|es|net|org|eu|shop|info)\b/i;

/* ---------- QR-Codes ---------- */

async function hasQr(canvas: HTMLCanvasElement): Promise<boolean> {
  const small = scaled(canvas, QR_EDGE);
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const img = ctx.getImageData(0, 0, small.width, small.height);
  const { default: jsQR } = await import("jsqr");
  return !!jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
}

/* ---------- Bilder und Einzelbilder ---------- */

/** Auf höchstens edge Pixel Kantenlänge verkleinert auf eine Leinwand zeichnen */
function draw(src: CanvasImageSource, w: number, h: number, edge: number): HTMLCanvasElement {
  const k = Math.min(1, edge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const scaled = (c: HTMLCanvasElement, edge: number) => draw(c, c.width, c.height, edge);

/* Graustufen mit kräftigem Kontrast, wahlweise umgekehrt. Helle Schrift mit
   dunklem Rand auf buntem Grund liest die Texterkennung so viel sicherer. */
function contrast(src: HTMLCanvasElement, invert: boolean): HTMLCanvasElement {
  const c = scaled(src, OCR_EDGE);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return c;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    g = Math.max(0, Math.min(255, (g - 128) * 1.8 + 128));
    if (invert) g = 255 - g;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function addFound(found: Set<MediaFinding>, text: { sure: string; raw: string }) {
  for (const k of findContact(text.sure)) if (k !== "offplatform" && k !== "name") found.add(k);
  if (RAW_PHONE.test(text.raw)) found.add("phone");
  if (RAW_WEB.test(text.raw)) found.add("web");
  if (RAW_EMAIL.test(text.raw)) found.add("email");
  else if (RAW_HANDLE.test(text.raw)) found.add("social");
}

/** passes: 1 = nur Original (schnell, für Video-Einzelbilder), 3 = zusätzlich
 *  kontrastverstärkt und umgekehrt (gründlich, für Fotos) */
async function checkCanvas(canvas: HTMLCanvasElement, passes: 1 | 3 = 3): Promise<MediaFinding[]> {
  const found = new Set<MediaFinding>();
  if (await hasQr(canvas)) found.add("qr");
  addFound(found, await readText(scaled(canvas, OCR_EDGE)));
  if (passes === 3 && found.size === 0) {
    addFound(found, await readText(contrast(canvas, false)));
    if (found.size === 0) addFound(found, await readText(contrast(canvas, true)));
  }
  return [...found];
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bild"));
    };
    img.src = url;
  });
}

export async function checkImage(file: Blob): Promise<MediaCheckResult> {
  try {
    const img = await loadImage(file);
    const c = draw(img, img.naturalWidth, img.naturalHeight, 2000);
    const found = await checkCanvas(c);
    return { ok: found.length === 0, found };
  } catch {
    return { ok: false, found: [], failed: true };
  }
}

/* ---------- Videos ---------- */

function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("video"));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

export async function checkVideo(
  file: Blob,
  onProgress?: (done: number, total: number) => void,
): Promise<MediaCheckResult> {
  let v: HTMLVideoElement | null = null;
  try {
    v = await loadVideo(file);
    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0) return { ok: false, found: [], failed: true };
    if (dur > MAX_VIDEO_SECONDS + 0.5) return { ok: false, found: [], tooLong: true };
    const n = Math.max(2, Math.min(MAX_FRAMES, Math.ceil(dur / 2)));
    for (let i = 0; i < n; i++) {
      /* Erstes und letztes Bild immer, dazwischen gleichmäßig */
      const t = Math.min(dur - 0.05, (dur * i) / (n - 1));
      await seek(v, Math.max(0, t));
      onProgress?.(i, n);
      const c = draw(v, v.videoWidth, v.videoHeight, 2000);
      const found = await checkCanvas(c);
      if (found.length) return { ok: false, found, atSecond: Math.round(t) };
    }
    onProgress?.(n, n);
    return { ok: true, found: [], duration: dur };
  } catch {
    return { ok: false, found: [], failed: true };
  } finally {
    if (v) URL.revokeObjectURL(v.src);
  }
}

export async function checkMedia(
  file: Blob & { type: string },
  onProgress?: (done: number, total: number) => void,
): Promise<MediaCheckResult> {
  if (file.type.startsWith("video/")) return checkVideo(file, onProgress);
  return checkImage(file);
}

/* ---------- Texte für die Oberfläche ---------- */

const LABEL: Record<string, Record<MediaFinding, string>> = {
  de: { phone: "eine Telefonnummer", email: "eine E-Mail-Adresse", web: "eine Webseite", social: "ein Social-Media-Name", qr: "ein QR-Code", address: "eine Adresse" },
  en: { phone: "a phone number", email: "an email address", web: "a website", social: "a social media handle", qr: "a QR code", address: "an address" },
  es: { phone: "un número de teléfono", email: "un correo electrónico", web: "una web", social: "un perfil de redes sociales", qr: "un código QR", address: "una dirección" },
};

export function mediaCheckMessage(r: MediaCheckResult, name: string, lang: string): string {
  const L = LABEL[lang] || LABEL["de"]!;
  const what = r.found.map((f) => L[f]).join(", ");
  const at = r.atSecond != null ? r.atSecond : null;
  if (lang === "en") {
    if (r.tooLong) return `"${name}" is longer than ${MAX_VIDEO_SECONDS} seconds. Please trim it.`;
    if (r.failed) return `"${name}" could not be checked and was not saved. Please try another file.`;
    return `"${name}" was not saved: it shows ${what}${at != null ? ` (around second ${at})` : ""}. Contact details are not allowed in photos and videos. Contact and payment go through Showly.`;
  }
  if (lang === "es") {
    if (r.tooLong) return `«${name}» dura más de ${MAX_VIDEO_SECONDS} segundos. Recórtalo, por favor.`;
    if (r.failed) return `No se pudo comprobar «${name}» y no se guardó. Prueba con otro archivo.`;
    return `«${name}» no se guardó: muestra ${what}${at != null ? ` (hacia el segundo ${at})` : ""}. No se permiten datos de contacto en fotos ni vídeos. El contacto y el pago van por Showly.`;
  }
  if (r.tooLong) return `„${name}“ ist länger als ${MAX_VIDEO_SECONDS} Sekunden. Bitte kürze das Video.`;
  if (r.failed) return `„${name}“ konnte nicht geprüft werden und wurde nicht gespeichert. Bitte versuch eine andere Datei.`;
  return `„${name}“ wurde nicht gespeichert: Darauf ist ${what} zu sehen${at != null ? ` (etwa bei Sekunde ${at})` : ""}. Kontaktdaten sind in Fotos und Videos nicht erlaubt. Kontakt und Zahlung laufen über Showly.`;
}
