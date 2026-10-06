/* Vorspann beim Öffnen der App: das Startvideo mit allen Figuren, in der
 * Mitte wächst das Showly-Logo aus dem Licht.
 *
 * Er startet von selbst und ist spätestens vier Sekunden nach dem Öffnen
 * wieder weg (die letzte halbe Sekunde blendet er aus). Ein Tippen schließt
 * ihn sofort. Er kommt bei jedem Öffnen bzw. Neuladen der App, aber nicht
 * beim Wechsel zwischen Seiten.
 *
 * Abgespielt wird ein echtes Video (H.264, 720 px, 24 Bilder pro Sekunde).
 * Das entschlüsselt der Grafikchip des Handys, darum läuft es ruckelfrei in
 * voller Qualität. Startet es nicht innerhalb kurzer Zeit von selbst (manche
 * eingebetteten Ansichten in Apps, Stromsparmodus), springt das animierte
 * Bild ein (AVIF, ältere Browser WebP). Bis dahin steht das erste Bild da.
 * Solange der Vorspann läuft, ruht die Figuren-Animation dahinter
 * (Klasse splash-open am <html>). */
import { useEffect, useRef, useState } from "react";

const TOTAL_MS = 4000;
const FADE_MS = 450;
/* Nach dieser Zeit prüfen, ob das Video überhaupt starten darf */
const START_MS = 900;

let shownThisLoad = false;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  /* video: Video läuft; anim: animiertes Bild als Ersatz */
  const [mode, setMode] = useState<"wait" | "video" | "anim">("wait");
  const [ready, setReady] = useState(false);
  const timers = useRef<number[]>([]);
  const anim = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);

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
    const v = video.current;
    if (v) {
      v.muted = true;
      v.play()?.catch(() => setMode((m) => (m === "wait" ? "anim" : m)));
    }
    /* Steht das Video nach kurzer Zeit still (Autoplay gesperrt), animiertes
       Bild nehmen. Lädt es nur noch, weiter warten; das erste Bild steht ja. */
    timers.current.push(
      window.setTimeout(() => {
        const blocked = !video.current || video.current.paused || !!video.current.error;
        if (blocked) setMode((m) => (m === "wait" ? "anim" : m));
      }, START_MS),
    );
    /* Feste Obergrenze ab dem Öffnen */
    timers.current.push(window.setTimeout(close, TOTAL_MS - FADE_MS));
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "anim" && anim.current?.complete && anim.current.naturalWidth > 0) setReady(true);
    if (mode === "anim") video.current?.pause();
  }, [mode]);

  /* Hintergrund-Animation anhalten, solange der Vorspann zu sehen ist */
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "gone") root.classList.remove("splash-open");
    else root.classList.add("splash-open");
    return () => root.classList.remove("splash-open");
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className="splash-stage">
        <img className="splash-video" src="/splash-poster.webp" alt="" fetchPriority="high" />
        {mode !== "anim" && (
          <video
            ref={video}
            className={"splash-video splash-anim" + (mode === "video" ? " on" : "")}
            src="/splash.mp4"
            poster="/splash-poster.webp"
            muted
            playsInline
            autoPlay
            preload="auto"
            disablePictureInPicture
            onPlaying={() => setMode((m) => (m === "wait" ? "video" : m))}
            onError={() => setMode((m) => (m === "wait" ? "anim" : m))}
          />
        )}
        {mode === "anim" && (
          <picture>
            <source srcSet="/splash-anim.avif" type="image/avif" />
            <img
              ref={anim}
              className={"splash-video splash-anim" + (ready ? " on" : "")}
              src="/splash-anim.webp"
              alt=""
              onLoad={() => setReady(true)}
            />
          </picture>
        )}
      </div>
    </div>
  );
}
