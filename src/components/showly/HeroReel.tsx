import { useEffect, useRef } from "react";
import { ARTISTS } from "@/showly/data";
import { bgOf } from "@/showly/ui";

/* Laufender Film im Hintergrund des Kopfbereichs.
 *
 * Szenen aus dem eigenen Katalog: Märchenfigur, Superheld, Musiker, Band,
 * Zauberer, Akrobatin, Feuershow, Tänzerin. Jede Szene steht ein paar
 * Sekunden, die Kamera fährt dabei langsam heran und seitlich, dann blendet
 * die nächste über. Darüber liegen ein wandernder Lichtkegel und feines
 * Filmkorn. Das Ganze ist bewusst blass und zur Überschrift hin
 * ausgeblendet, damit der Text ruhig lesbar bleibt.
 *
 * Warum kein eingebettetes Videofile: Die Szenen sind dieselben Zeichnungen,
 * die auch auf den Karten stehen, und liegen ohnehin im Zwischenspeicher.
 * Ein Film derselben Länge wäre mehrere Megabyte groß und auf großen
 * Bildschirmen unscharf. So ist er gestochen scharf und lädt nichts nach.
 *
 * Außerhalb des sichtbaren Bereichs hält die Bewegung an. Wer weniger
 * Bewegung eingestellt hat, sieht nur die erste Szene als ruhiges Bild. */

const SCENE_CATS = ["fairy", "superhero", "musician", "band", "magician", "acrobat", "street", "dancer"];
const SCENE_SECONDS = 5;

export function HeroReel() {
  const ref = useRef<HTMLDivElement>(null);

  const scenes = SCENE_CATS.map((c) => ARTISTS.find((a) => a.cat === c)).filter(
    (a): a is (typeof ARTISTS)[number] => !!a,
  );
  const total = scenes.length * SCENE_SECONDS;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle("paused", !entry?.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="hero-reel"
      aria-hidden="true"
      style={{ ["--reel-total" as string]: `${total}s`, ["--reel-n" as string]: scenes.length }}
    >
      {scenes.map((a, i) => (
        <span
          key={a.id}
          className={"hero-reel-scene k" + (i % 4)}
          style={{ ...bgOf(a, "62% 40%"), animationDelay: `${i * SCENE_SECONDS}s` }}
        />
      ))}
      <span className="hero-reel-light" />
      <span className="hero-reel-grain" />
    </div>
  );
}
