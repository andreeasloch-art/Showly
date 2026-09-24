/* Farbfläche der Wortmarke, als Farbe für hervorgehobene Wörter.
 *
 * Statt Farben nachzubauen, wird die Wortmarke selbst zur Farbe: Das Logo
 * wird auf seine farbigen Pixel zugeschnitten, die weißen Flächen zwischen
 * den Buchstaben werden mit der jeweils nächstgelegenen Logofarbe aufgefüllt
 * und das Ergebnis leicht weichgezeichnet. Übrig bleibt ein Farbfeld, das
 * links oben violett ist, links unten koralle, in der Mitte pink und rechts
 * türkis – genau wie das Logo.
 *
 * Dieses Feld legt die Seite hinter ein Wort und schneidet es an den
 * Buchstaben aus. Jedes Wort trägt damit dieselbe Farbfolge wie die
 * Wortmarke, unabhängig von seiner Länge.
 *
 * Aufruf: node scripts/brand/build.mjs
 */
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "logo-source.webp");
const OUT = join(HERE, "..", "..", "public", "wordmark-paint.webp");

/* Grob genug, dass einzelne Pixel keine Rolle spielen, fein genug für die
   Sprünge zwischen den Buchstaben. */
const GW = 192;
const GH = 64;

const { data, info } = await sharp(SRC)
  .flatten({ background: "#ffffff" })
  .resize(GW, GH, { fit: "fill" })
  .raw()
  .toBuffer({ resolveWithObject: true });
const C = info.channels;

const colored = new Uint8Array(GW * GH);
const rgb = new Float64Array(GW * GH * 3);
for (let i = 0; i < GW * GH; i++) {
  const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
  rgb[i * 3] = r;
  rgb[i * 3 + 1] = g;
  rgb[i * 3 + 2] = b;
  /* Farbig heißt: deutlich bunter als das weiße Papier */
  colored[i] = Math.max(r, g, b) - Math.min(r, g, b) > 30 && Math.max(r, g, b) < 250 ? 1 : 0;
}

/* Jede Spalte der Wortmarke wird zu einer senkrechten Farbreihe.
 *
 * Nur die farbigen Pixel zählen; der weiße Zwischenraum wird nicht gemittelt,
 * sonst bleicht das Feld aus. Die gefundenen Farben werden über die volle
 * Höhe gespannt, damit auch schmale Stellen wie das i ihren ganzen Verlauf
 * zeigen. Spalten ohne Farbe – die Lücken zwischen den Buchstaben – nehmen
 * die Farbreihe der nächsten farbigen Spalte. */
const column = new Array(GW).fill(null);
for (let x = 0; x < GW; x++) {
  const found = [];
  for (let y = 0; y < GH; y++) {
    const i = y * GW + x;
    if (colored[i]) found.push({ y, c: [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]] });
  }
  if (found.length < 2) continue;
  const top = found[0].y;
  const bottom = found[found.length - 1].y;
  const col = [];
  for (let k = 0; k < GH; k++) {
    const want = top + ((bottom - top) * k) / (GH - 1);
    let best = found[0];
    for (const f of found) if (Math.abs(f.y - want) < Math.abs(best.y - want)) best = f;
    col.push(best.c);
  }
  column[x] = col;
}

/* Lücken zwischen den Buchstaben schließen */
for (let x = 0; x < GW; x++) {
  if (column[x]) continue;
  let left = x, right = x;
  while (left >= 0 && !column[left]) left--;
  while (right < GW && !column[right]) right++;
  const src = left < 0 ? column[right] : right >= GW ? column[left] : x - left <= right - x ? column[left] : column[right];
  column[x] = src;
}

/* Waagerecht glätten: Die einzelnen Buchstabenkanten sollen nicht als
   Streifen durchschlagen, die Farbfolge des Logos aber erhalten bleiben. */
const R = 2;
const smooth = column.map((_, x) => {
  const acc = Array.from({ length: GH }, () => [0, 0, 0]);
  let n = 0;
  for (let k = -R; k <= R; k++) {
    const src = column[Math.max(0, Math.min(GW - 1, x + k))];
    if (!src) continue;
    n++;
    for (let y = 0; y < GH; y++) {
      acc[y][0] += src[y][0];
      acc[y][1] += src[y][1];
      acc[y][2] += src[y][2];
    }
  }
  return acc.map((c) => c.map((v) => v / Math.max(1, n)));
});
column.splice(0, GW, ...smooth);

/* Die äußersten Spalten sind die auslaufenden Enden von S und y und damit
   heller als der Rest. Sie bleiben außen vor, sonst endet das Wort blass. */
const firstInk = column.findIndex(Boolean);
const lastInk = GW - 1 - [...column].reverse().findIndex(Boolean);
const trim = Math.round((lastInk - firstInk) * 0.04);
const first = firstInk + trim;
const last = lastInk - trim;
const w = last - first + 1;
const h = GH;
const out = Buffer.alloc(w * h * 3);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const c = column[first + x][y];
    out[(y * w + x) * 3] = c[0];
    out[(y * w + x) * 3 + 1] = c[1];
    out[(y * w + x) * 3 + 2] = c[2];
  }
}

await sharp(out, { raw: { width: w, height: h, channels: 3 } })
  .resize(960, 320, { fit: "fill", kernel: "cubic" })
  .blur(2.5)
  /* Das Weichzeichnen nimmt der Fläche etwas Farbe; hier kommt sie zurück. */
  .modulate({ saturation: 1.12 })
  .webp({ quality: 92 })
  .toFile(OUT);
console.log("Farbfeld:", w, "x", h, "->", OUT);
