/* Bunte, glänzende Bällchen im Hintergrund des Kopfbereichs der Startseite.
 *
 * Rein dekorativ: Positionen, Größen und Farben kommen aus einem festen
 * Zufallsgenerator, damit Server und Browser dasselbe zeichnen (kein
 * Hydration-Fehler). Die Bällchen schweben leicht auf und ab; wer
 * reduzierte Bewegung eingestellt hat, sieht sie still. */

const COLORS = [
  "#FF3B5C", // rot
  "#FFC61A", // gelb
  "#2BC46B", // grün
  "#1E9BFF", // blau
  "#FF6FB5", // pink
  "#FF8A1F", // orange
  "#8B5CF6", // lila
  "#1FC8C8", // türkis
];

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ball = { x: number; y: number; s: number; c: string; d: number; t: number; far: boolean };

const BALLS: Ball[] = (() => {
  const r = rng(20081225);
  const out: Ball[] = [];
  for (let i = 0; i < 64; i++) {
    const far = r() < 0.35;
    // Oben dichter als unten, wie herabrieselndes Konfetti
    const y = Math.pow(r(), 1.35) * 96;
    out.push({
      x: r() * 100,
      y,
      s: far ? 5 + r() * 5 : 9 + r() * 10,
      c: COLORS[Math.floor(r() * COLORS.length)] ?? "#FF3B5C",
      d: -r() * 8,
      t: 5 + r() * 5,
      far,
    });
  }
  return out;
})();

export function HeroBalls() {
  return (
    <div className="hero-balls" aria-hidden="true">
      {BALLS.map((b, i) => (
        <span
          key={i}
          className={"hero-ball" + (b.far ? " far" : "")}
          style={{
            left: `${b.x.toFixed(2)}%`,
            top: `${b.y.toFixed(2)}%`,
            width: `${b.s.toFixed(1)}px`,
            height: `${b.s.toFixed(1)}px`,
            ["--c" as string]: b.c,
            animationDelay: `${b.d.toFixed(2)}s`,
            animationDuration: `${b.t.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
