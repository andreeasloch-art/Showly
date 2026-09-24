/* Ein Wort aus der Bildwerkstatt für die Überschrift freistellen.
 *
 * Die Vorlage ist farbige Schrift auf weißem Papier. Für die Seite braucht es
 * das Wort ohne Papier, sonst steht ein weißer Kasten im hellen Farbverlauf
 * des Kopfbereichs.
 *
 * Freigestellt wird nicht über einen Schwellenwert – das fräst die weichen
 * Ränder ab –, sondern gerechnet: Jeder Bildpunkt wird als farbiger Punkt mit
 * einer Deckkraft über Weiß gelesen. Aus dem hellsten Anteil ergibt sich die
 * Deckkraft, daraus die reine Farbe. Über Weiß sieht das Ergebnis genauso aus
 * wie vorher, über dem hellen Lila des Kopfbereichs sauber statt kastig.
 *
 * Aufruf: node scripts/brand/word.mjs <quelle.webp> <ziel.webp>
 */
import sharp from "sharp";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("Aufruf: node scripts/brand/word.mjs <quelle> <ziel>");
  process.exit(1);
}

const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

/* Das Papier ist nicht ganz weiß. Als Weiß gilt der häufigste Wert am Rand,
   nicht der hellste im Bild: ein einzelner heller Punkt soll den Maßstab
   nicht verschieben. */
const edge = [];
for (let x = 0; x < W; x++) {
  edge.push(Math.max(data[x * C], data[x * C + 1], data[x * C + 2]));
  const i = (H - 1) * W + x;
  edge.push(Math.max(data[i * C], data[i * C + 1], data[i * C + 2]));
}
edge.sort((a, b) => a - b);
const paper = edge[Math.floor(edge.length / 2)];

const alpha = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) {
  const lo = Math.min(data[i * C], data[i * C + 1], data[i * C + 2]);
  const a = 1 - lo / paper;
  /* Das Rauschen des Papiers liegt unter zwei Prozent und fällt hier weg. */
  alpha[i] = a < 0.02 ? 0 : Math.min(1, a);
}

/* Auf die Farbe zuschneiden.
 *
 * Für den Rahmen zählt nur, was deutlich farbig ist. Die weichen Ausläufer
 * bleiben im Bild, bestimmen aber nicht die Kante – sonst spannt ein einzelner
 * blasser Punkt den Ausschnitt über das halbe Blatt. */
const EDGE_MIN = 0.14;
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] < EDGE_MIN) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
}
/* Ein schmaler Saum, damit die weichen Ränder nicht angeschnitten werden */
const PAD = 3;
x0 = Math.max(0, x0 - PAD);
y0 = Math.max(0, y0 - PAD);
x1 = Math.min(W - 1, x1 + PAD);
y1 = Math.min(H - 1, y1 + PAD);
const w = x1 - x0 + 1;
const h = y1 - y0 + 1;

const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y + y0) * W + (x + x0);
    const a = alpha[i];
    const o = (y * w + x) * 4;
    if (a <= 0) continue;
    /* Deckkraft herausrechnen: aus „Farbe über Weiß" wird die reine Farbe */
    for (let k = 0; k < 3; k++) {
      const c = data[i * C + k];
      rgba[o + k] = Math.max(0, Math.min(255, Math.round((c - (1 - a) * paper) / a)));
    }
    rgba[o + 3] = Math.round(a * 255);
  }
}

const MAXW = 900;
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  .resize({ width: Math.min(MAXW, w), withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile(out);

const ratio = w / h;
console.log(`freigestellt: ${w}x${h} (Seitenverhältnis ${ratio.toFixed(4)}) -> ${out}`);
