/* Erzeugt src/assets/spotlight-stage.jpg: Bühne mit Scheinwerfern, Nebel und
 * Konfetti. Vollständig aus Code gezeichnet (keine fremden Bilder), damit die
 * Rechte eindeutig bei Showly liegen.   Aufruf: node scripts/brand/stage.mjs */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1280, H = 960;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const lamps = [
  { x: 128, y: 110, tx: 560, c: "#8B5CF6" },
  { x: 350, y: 145, tx: 700, c: "#C026D3" },
  { x: 645, y: 60, tx: 640, c: "#A5B4FC" },
  { x: 955, y: 145, tx: 560, c: "#DB2777" },
  { x: 1175, y: 105, tx: 720, c: "#D946EF" },
  { x: 1055, y: 55, tx: 900, c: "#E11D48" },
];
const beam = (l, i) => {
  const bx = l.tx, by = H - 70, spread = 170;
  return `<linearGradient id="b${i}" gradientUnits="userSpaceOnUse" x1="${l.x}" y1="${l.y}" x2="${bx}" y2="${by}">
    <stop offset="0" stop-color="${l.c}" stop-opacity=".95"/><stop offset=".55" stop-color="${l.c}" stop-opacity=".35"/>
    <stop offset="1" stop-color="${l.c}" stop-opacity="0"/></linearGradient>
  <path d="M${l.x - 10} ${l.y} L${bx - spread} ${by} L${bx + spread} ${by} L${l.x + 10} ${l.y}Z" fill="url(#b${i})" filter="url(#soft)"/>`;
};
const colors = ["#FDE68A", "#F9A8D4", "#C4B5FD", "#FFFFFF", "#FCA5A5", "#A5F3FC"];
let confetti = "";
for (let i = 0; i < 420; i++) {
  const x = rnd() * W, y = 80 + rnd() * (H - 180), r = 1.5 + rnd() * 3.2;
  const c = colors[Math.floor(rnd() * colors.length)];
  confetti += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 1.3).toFixed(1)}" ry="${r.toFixed(1)}" fill="${c}" opacity="${(0.45 + rnd() * 0.5).toFixed(2)}" transform="rotate(${Math.floor(rnd() * 180)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="soft" x="-30%" y="-10%" width="160%" height="130%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="fog" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>
  <radialGradient id="floor" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#7C3AED" stop-opacity=".55"/><stop offset="1" stop-color="#0B0716" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#07040F"/>
<g stroke="#2A2340" stroke-width="6" opacity=".9"><path d="M0 40 H${W}"/><path d="M60 118 H${W - 60}"/><path d="M0 200 H${W}" opacity=".5"/></g>
${lamps.map(beam).join("")}
<ellipse cx="420" cy="690" rx="330" ry="160" fill="#7C3AED" opacity=".35" filter="url(#fog)"/>
<ellipse cx="880" cy="700" rx="330" ry="170" fill="#DB2777" opacity=".33" filter="url(#fog)"/>
<rect y="${H - 90}" width="${W}" height="90" fill="#0E0A1C"/>
<ellipse cx="${W / 2}" cy="${H - 90}" rx="560" ry="80" fill="url(#floor)"/>
${lamps.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="14" fill="#fff"/><circle cx="${l.x}" cy="${l.y}" r="30" fill="${l.c}" opacity=".6" filter="url(#soft)"/>`).join("")}
${confetti}
</svg>`;
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "..", "src", "assets", "spotlight-stage.jpg");
await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
console.log("geschrieben:", out);
