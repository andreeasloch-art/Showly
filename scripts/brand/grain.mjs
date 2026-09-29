/* Erzeugt public/textures/grain.webp: feines Filmkorn aus Zufallsrauschen,
 * vollständig aus Code (keine fremde Vorlage).  node scripts/brand/grain.mjs */
import sharp from "sharp";
const N = 128;
let s = 12345;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const px = Buffer.alloc(N * N * 3);
for (let i = 0; i < N * N; i++) {
  const v = Math.round(128 + (rnd() - 0.5) * 90);
  px[i * 3] = px[i * 3 + 1] = px[i * 3 + 2] = v;
}
await sharp(px, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 80 }).toFile("public/textures/grain.webp");
console.log("grain.webp geschrieben");
