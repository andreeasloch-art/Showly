/* Hochgeladene Dateien auf dem Server prüfen (rein, getestet in
 * imageSafety.test.ts).
 *
 *  - sniffType: echte Dateiart aus den ersten Bytes statt aus Dateiname oder
 *    Browser-Angabe. Ein umbenanntes Programm oder HTML gilt nicht als Bild.
 *  - stripImageMetadata: entfernt aus JPEG die EXIF-/XMP-Blöcke (APP1–APP15,
 *    Kommentare) und aus PNG die eXIf-/Text-Blöcke. Darin stehen oft der
 *    Aufnahmeort (GPS), Kamera-Seriennummer oder Name. Normalerweise macht das
 *    schon der Browser beim Verkleinern (showly/media.ts); das hier ist das
 *    Sicherheitsnetz auf dem Server. */

export type FileKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "mp4" | "mov" | "webm";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

export function sniffType(b: Uint8Array): FileKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1|avif)$/.test(brand)) return "heic";
    if (brand === "qt  ") return "mov";
    return "mp4";
  }
  return null;
}

export function isImageKind(k: FileKind | null): boolean {
  return k === "jpeg" || k === "png" || k === "webp" || k === "gif" || k === "heic";
}

export function isVideoKind(k: FileKind | null): boolean {
  return k === "mp4" || k === "mov" || k === "webm";
}

/** JPEG ohne APP1–APP15 und COM; APP0 (JFIF) und Bilddaten bleiben */
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b; // kaputt: lieber unverändert lassen
    const marker = b[i + 1]!;
    if (marker === 0xda) {
      out.push(b.subarray(i)); // Start of Scan: Rest sind Bilddaten
      i = b.length;
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2 || i + 2 + len > b.length) return b;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (i < b.length) return b;
  const total = out.reduce((n, x) => n + x.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const x of out) {
    res.set(x, o);
    o += x.length;
  }
  return res;
}

/** PNG ohne eXIf, tEXt, zTXt, iTXt */
function stripPng(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return b;
    if (!/^(eXIf|tEXt|zTXt|iTXt)$/.test(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  const total = out.reduce((n, x) => n + x.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const x of out) {
    res.set(x, o);
    o += x.length;
  }
  return res;
}

/** Metadaten entfernen; changed=false, wenn nichts zu tun war */
export function stripImageMetadata(b: Uint8Array): { bytes: Uint8Array; changed: boolean } {
  const k = sniffType(b);
  const bytes = k === "jpeg" ? stripJpeg(b) : k === "png" ? stripPng(b) : b;
  return { bytes, changed: bytes.length !== b.length };
}
