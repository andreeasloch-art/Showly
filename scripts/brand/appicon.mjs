/* App-Icon aus dem "S" des Showly-Logos.
 *
 * Schneidet das S aus scripts/brand/logo-source.webp aus, entfernt den weißen
 * Hintergrund (weiche Kante, ohne weißen Saum) und setzt es auf eine
 * quadratische Fläche ohne abgerundete Ecken; die Rundung macht das Handy
 * selbst. Erzeugt alle Größen für Web-App, iPhone und Android.
 *   node scripts/brand/appicon.mjs [variante]   (dark | light | violet) */
import sharp from "sharp";
import fs from "node:fs";

const variant = process.argv[2] || "dark";
const out = process.argv[3] || "public/icons";
fs.mkdirSync(out, { recursive: true });

// 1) S ausschneiden und freistellen
const box = { left: 112, top: 348, width: 244, height: 296 };
const { data, info } = await sharp("scripts/brand/logo-source.webp")
  .extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const rgba = Buffer.alloc(W * H * 4);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const d = Math.max(255 - r, 255 - g, 255 - b);
  const a = smooth(6, 60, d);
  // Farbe vom weißen Anteil befreien (kein heller Saum)
  const un = (c) => (a > 0.01 ? Math.min(255, Math.max(0, (c - (1 - a) * 255) / a)) : 0);
  rgba[i * 4] = un(r); rgba[i * 4 + 1] = un(g); rgba[i * 4 + 2] = un(b); rgba[i * 4 + 3] = Math.round(a * 255);
}
const S = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();
const sMeta = await sharp(S).metadata();

// 2) Hintergrund
const BG = {
  dark: `<radialGradient id="g" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#2A1452"/><stop offset=".6" stop-color="#150A2E"/><stop offset="1" stop-color="#0B0618"/></radialGradient>
         <rect width="1024" height="1024" fill="url(#g)"/>
         <ellipse cx="512" cy="860" rx="330" ry="60" fill="#7C3AED" opacity=".35" filter="url(#b)"/>`,
  light: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3EEFF"/></linearGradient>
          <rect width="1024" height="1024" fill="url(#g)"/>`,
  violet: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B1D8F"/><stop offset="1" stop-color="#1A0B3D"/></linearGradient>
           <rect width="1024" height="1024" fill="url(#g)"/>`,
}[variant];
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><filter id="b" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="50"/></filter></defs>${BG}</svg>`);

// 3) S auf 60 % Höhe (sichere Zone für runde Masken bei Android: 80 %)
const targetH = 600;
const sBig = await sharp(S).resize({ height: targetH, kernel: "lanczos3" }).png().toBuffer();
const sw = Math.round((sMeta.width / sMeta.height) * targetH);
const glow = variant === "light" ? [] : [{ input: await sharp(sBig).blur(28).modulate({ brightness: 1.2 }).png().toBuffer(), left: Math.round((1024 - sw) / 2), top: Math.round((1024 - targetH) / 2) + 8, blend: "screen" }];
const master = await sharp(bg).composite([...glow, { input: sBig, left: Math.round((1024 - sw) / 2), top: Math.round((1024 - targetH) / 2) }]).png().toBuffer();
await sharp(master).toFile(`${out}/app-icon-1024.png`);

// 4) Größen
for (const n of [48, 72, 96, 128, 192, 256, 512]) await sharp(master).resize(n, n).webp({ quality: 92 }).toFile(`${out}/icon-${n}.webp`);
for (const n of [192, 512]) await sharp(master).resize(n, n).png().toFile(`${out}/icon-${n}.png`);
await sharp(master).resize(180, 180).png().toFile(`${out}/apple-touch-icon.png`);
// Android "maskable": etwas mehr Rand, damit runde Masken nichts abschneiden
const small = await sharp(master).resize(820, 820).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: variant === "light" ? "#FFFFFF" : "#0B0618" } })
  .composite([{ input: bg }, { input: small, left: 102, top: 102 }]).png().toBuffer()
  .then((b) => sharp(b).resize(512, 512).png().toFile(`${out}/icon-maskable-512.png`));
await sharp(master).resize(64, 64).png().toFile(`${out}/favicon-64.png`);
console.log("App-Icon", variant, "->", out);
