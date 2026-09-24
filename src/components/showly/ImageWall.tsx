import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/* Bausteine der neu geschnittenen Seiten (Startseite, Shop, Künstler werden,
   Event-Blog). Gestaltung in showly.css unter "NEUSCHNITT 2026". */

export type WallTile = {
  key: string;
  style: CSSProperties;
  title: string;
  sub?: string;
  /** Ziel beim Klick, zum Beispiel ein Künstlerprofil */
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
};

/* Laufende Bildspalten.
 *
 * Drei Spalten, die mittlere läuft gegenläufig. Jede Spalte zeigt ihre Bilder
 * zweimal hintereinander und verschiebt sich um genau die Hälfte: dann setzt
 * die Schleife nahtlos wieder an.
 *
 * Die Spalten sind Schmuck. Für Vorlesehilfen und die Tastatur sind sie
 * ausgeblendet; dieselben Inhalte stehen auf der Seite darunter vollständig
 * bedienbar. Mit der Maus kann man trotzdem auf ein Bild klicken. Beim
 * Überfahren halten die Spalten an, und wer in den Systemeinstellungen
 * weniger Bewegung gewählt hat, sieht sie still. */
export function ImageWall({ tiles, light = false }: { tiles: WallTile[]; light?: boolean }) {
  const cols = [0, 1, 2].map((c) => tiles.filter((_, i) => i % 3 === c));
  return (
    <div className={"act-wall" + (light ? " light" : "")} aria-hidden="true">
      {cols.map((list, c) => (
        <div className={"act-wall-col c" + c} key={c}>
          <div className="act-wall-track">
            {[...list, ...list].map((tile, k) => {
              const inner = (
                <>
                  <span className="act-wall-img" style={tile.style} />
                  <span className="act-wall-cap">
                    <b>{tile.title}</b>
                    {tile.sub && <span>{tile.sub}</span>}
                  </span>
                </>
              );
              const key = tile.key + "-" + k;
              if (tile.to) {
                return (
                  <Link
                    to={tile.to as never}
                    params={tile.params as never}
                    className="act-wall-tile"
                    key={key}
                    tabIndex={-1}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <span
                  className={"act-wall-tile" + (tile.onClick ? " clickable" : "")}
                  key={key}
                  onClick={tile.onClick}
                >
                  {inner}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Zahl, die beim ersten Sichtbarwerden hochzählt.
 *
 * Auf dem Server und ohne JavaScript steht sofort der Endwert da. Die
 * Zählung setzt den Startwert erst im ersten Bildrahmen: Hält der Browser die
 * Bildrahmen an, etwa in einem Hintergrund-Tab, bleibt der Endwert stehen,
 * statt bei null hängenzubleiben. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    /* Ändert sich der Wert, etwa weil die Daten erst nach dem ersten
       Zeichnen aus dem Speicher kommen, sofort den neuen Wert zeigen. */
    setShown(value);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const dur = 1100;
        let start = 0;
        const step = (now: number) => {
          if (!start) start = now;
          const p = Math.min(1, (now - start) / dur);
          setShown(value * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span ref={ref}>{format(shown)}</span>;
}
