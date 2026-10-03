/* Vorspann beim Öffnen der App: das Startvideo mit allen Figuren, in der
 * Mitte wächst das Showly-Logo aus dem Licht.
 *
 * Er startet von selbst und ist spätestens vier Sekunden nach dem Öffnen
 * wieder weg (die letzte halbe Sekunde blendet er aus). Ein Tippen schließt
 * ihn sofort. Er kommt bei jedem Öffnen bzw. Neuladen der App, aber nicht
 * beim Wechsel zwischen Seiten.
 *
 * Das Video liegt als animiertes Bild vor, nicht als <video>: Videos starten
 * in vielen Umgebungen nie von selbst (eingebettete Ansichten in Apps,
 * Stromsparmodus), Bilder laufen überall. AVIF ist wie ein Video komprimiert
 * (volle 720 px, 24 Bilder pro Sekunde, 1,7 MB); ältere Browser ohne AVIF
 * bekommen dieselben Einzelbilder als WebP. Bis die Animation geladen ist,
 * steht ihr erstes Bild da. */
import { useEffect, useRef, useState } from "react";

const TOTAL_MS = 4000;
const FADE_MS = 450;

let shownThisLoad = false;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [ready, setReady] = useState(false);
  const timers = useRef<number[]>([]);
  const anim = useRef<HTMLImageElement>(null);

  function clearAll() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function close() {
    clearAll();
    setPhase((p) => (p === "show" ? "fade" : p));
    timers.current.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
  }

  useEffect(() => {
    if (shownThisLoad) {
      setPhase("gone");
      return;
    }
    shownThisLoad = true;
    /* Schon vor dem Start der App geladen (Cache): gleich zeigen */
    if (anim.current?.complete && anim.current.naturalWidth > 0) setReady(true);
    /* Feste Obergrenze ab dem Öffnen */
    timers.current.push(window.setTimeout(close, TOTAL_MS - FADE_MS));
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className="splash-stage">
        <img className="splash-video" src="/splash-poster.webp" alt="" fetchPriority="high" />
        <picture>
          <source srcSet="/splash-anim.avif" type="image/avif" />
          <img
            ref={anim}
            className={"splash-video splash-anim" + (ready ? " on" : "")}
            src="/splash-anim.webp"
            alt=""
            fetchPriority="high"
            onLoad={() => setReady(true)}
          />
        </picture>
      </div>
    </div>
  );
}
