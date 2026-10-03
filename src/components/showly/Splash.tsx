/* Vorspann beim Öffnen der App: alle Figuren auf einer Bühne, in der Mitte
 * wächst das Showly-Logo aus dem Licht. Vier Sekunden, ohne Ton.
 *
 * Er kommt bei jedem Öffnen bzw. Neuladen der App, aber nicht beim Wechsel
 * zwischen Seiten. Ein Tippen schließt ihn sofort.
 *
 * Die vier Sekunden zählen erst, wenn das Video wirklich läuft. Vorher steht
 * das erste Bild da. Startet das Video nicht (Stromsparmodus, kein Autoplay,
 * sehr langsames Netz), läuft stattdessen dieselbe Szene als Bild-Animation:
 * die Bühne zoomt langsam, das Logo fliegt aus dem Licht nach vorne. So gibt
 * es immer mindestens dreieinhalb Sekunden Bewegung. Das Video spielt stumm,
 * sonst blockieren Handys das automatische Abspielen. Wer weniger Bewegung
 * eingestellt hat, sieht kurz das Schlussbild mit Logo. */
import { useEffect, useRef, useState } from "react";

const VIDEO_MS = 4000;
const ANIM_MS = 3600;
const STILL_MS = 1800;
const WAIT_MS = 2500;
const FADE_MS = 500;

/* Nur einmal pro Seitenaufruf, nicht bei jedem Seitenwechsel. Der Effekt kann
   in der Entwicklung doppelt laufen. */
let shownThisLoad = false;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Mode = "video" | "anim" | "still";

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [mode, setMode] = useState<Mode>("video");
  const video = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]);
  const ended = useRef(false);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }
  function clearAll() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function close() {
    if (ended.current) return;
    ended.current = true;
    clearAll();
    setPhase("fade");
    window.setTimeout(() => setPhase("gone"), FADE_MS);
  }
  function fallback() {
    if (ended.current) return;
    clearAll();
    video.current?.pause();
    setMode("anim");
    later(close, ANIM_MS);
  }

  useEffect(() => {
    if (shownThisLoad) {
      setPhase("gone");
      return;
    }
    shownThisLoad = true;
    if (reducedMotion()) {
      setMode("still");
      later(close, STILL_MS);
      return clearAll;
    }
    const v = video.current;
    v?.play().catch(fallback);
    /* Läuft das Video nach kurzer Zeit noch nicht, die Bild-Animation zeigen */
    later(() => {
      if (!v || v.paused || v.currentTime === 0) fallback();
    }, WAIT_MS);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlaying() {
    if (mode !== "video" || ended.current) return;
    clearAll();
    /* Ab jetzt zählen die vier Sekunden; "ended" schließt meist schon vorher */
    later(close, VIDEO_MS + 400);
  }

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className={"splash-stage" + (mode === "anim" ? " anim" : "")}>
        {mode === "still" && <img className="splash-video" src="/splash-still.webp" alt="" />}
        {mode === "anim" && (
          <>
            <img className="splash-video" src="/splash-poster.webp" alt="" />
            <div className="splash-logo">
              <img src="/logo-showly@2x.png" alt="" />
            </div>
          </>
        )}
        {mode === "video" && (
          <video
            ref={video}
            className="splash-video"
            poster="/splash-poster.webp"
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlaying={onPlaying}
            onEnded={close}
            onError={fallback}
          >
            {/* MP4 zuerst: Safari und fast alle Handys. WebM für Browser ohne H.264. */}
            <source src="/splash.mp4" type="video/mp4" />
            {/* Schlägt auch die letzte Quelle fehl, sofort die Bild-Animation */}
            <source src="/splash.webm" type="video/webm" onError={fallback} />
          </video>
        )}
      </div>
    </div>
  );
}
