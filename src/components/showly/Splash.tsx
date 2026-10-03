/* Startvideo beim Öffnen der App: alle Figuren auf einer Bühne, in der Mitte
 * wächst das Showly-Logo aus dem Licht. Vier Sekunden, ohne Ton.
 *
 * Es erscheint einmal pro App-Start (sessionStorage). Ein Tippen schließt es
 * sofort. Beim Wechsel zwischen Seiten oder beim Neuladen innerhalb derselben
 * Sitzung kommt es nicht noch einmal.
 *
 * Das Video spielt stumm, sonst blockieren Handys das automatische Abspielen.
 * Bis es geladen ist, steht das erste Bild als Standbild da. Wer weniger
 * Bewegung eingestellt hat, sieht nur das Schlussbild mit Logo, kurz. Startet
 * das Video nicht (Stromsparmodus, kein Autoplay), schließt der Vorspann nach
 * der festen Zeit trotzdem. */
import { useEffect, useRef, useState } from "react";

const KEY = "showly.splashShown";
const VIDEO_MS = 4000;
const STILL_MS = 1800;
const FADE_MS = 500;

/* Entscheidung einmal pro Seitenaufruf treffen. Der Effekt kann in der
   Entwicklung doppelt laufen; beim zweiten Mal stünde sonst schon "gezeigt"
   im Speicher und das Bild verschwände sofort. */
let showThisLoad: boolean | null = null;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [still, setStill] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (showThisLoad === null) {
      showThisLoad = true;
      try {
        showThisLoad = sessionStorage.getItem(KEY) !== "1";
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ohne Speicher einfach jedes Mal zeigen */
      }
    }
    if (!showThisLoad) {
      setPhase("gone");
      return;
    }
    const calm = reducedMotion();
    setStill(calm);
    if (!calm) video.current?.play().catch(() => {});
    /* Feste Obergrenze, auch wenn das Video hängt oder nicht startet */
    const ms = calm ? STILL_MS : VIDEO_MS + 600;
    const t1 = window.setTimeout(() => setPhase("fade"), ms);
    const t2 = window.setTimeout(() => setPhase("gone"), ms + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  function close() {
    setPhase((p) => (p === "show" ? "fade" : p));
    window.setTimeout(() => setPhase("gone"), FADE_MS);
  }

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className="splash-stage">
        {still ? (
          <img className="splash-video" src="/splash-still.webp" alt="" />
        ) : (
          <video
            ref={video}
            className="splash-video"
            poster="/splash-poster.webp"
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={close}
          >
            {/* MP4 zuerst: Safari und fast alle Handys. WebM für Browser ohne H.264. */}
            <source src="/splash.mp4" type="video/mp4" />
            <source src="/splash.webm" type="video/webm" />
          </video>
        )}
      </div>
    </div>
  );
}
