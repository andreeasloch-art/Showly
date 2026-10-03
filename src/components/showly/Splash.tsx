/* Vorspann beim Öffnen der App: das Startvideo mit allen Figuren, in der
 * Mitte wächst das Showly-Logo aus dem Licht.
 *
 * Er startet von selbst und ist spätestens vier Sekunden nach dem Öffnen
 * wieder weg (die letzte halbe Sekunde blendet er aus). Ein Tippen schließt
 * ihn sofort. Er kommt bei jedem Öffnen bzw. Neuladen der App, aber nicht
 * beim Wechsel zwischen Seiten.
 *
 * Zuerst wird das Video abgespielt (stumm, sonst verbieten Handys den
 * Selbststart). Manche Umgebungen spielen Videos aber nie von selbst ab, zum
 * Beispiel eingebettete Ansichten in Apps oder der Stromsparmodus. Läuft das
 * Video nach einer halben Sekunde nicht, zeigt die App dieselben Einzelbilder
 * aus dem Video als animiertes Bild; Bilder laufen überall von selbst. */
import { useEffect, useRef, useState } from "react";

const TOTAL_MS = 4000;
const FADE_MS = 450;
const SWITCH_MS = 500;

let shownThisLoad = false;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [frames, setFrames] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const playing = useRef(false);
  const timers = useRef<number[]>([]);

  function clearAll() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function close() {
    clearAll();
    setPhase((p) => (p === "show" ? "fade" : p));
    timers.current.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
  }
  function useFrames() {
    if (playing.current) return;
    video.current?.pause();
    setFrames(true);
  }

  useEffect(() => {
    if (shownThisLoad) {
      setPhase("gone");
      return;
    }
    shownThisLoad = true;
    /* Feste Obergrenze ab dem Öffnen */
    timers.current.push(window.setTimeout(close, TOTAL_MS - FADE_MS));
    const v = video.current;
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.play().catch(useFrames);
    }
    timers.current.push(window.setTimeout(useFrames, SWITCH_MS));
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className="splash-stage">
        {frames ? (
          <img className="splash-video" src="/splash-anim.webp" alt="" decoding="async" fetchPriority="high" />
        ) : (
          <video
            ref={video}
            className="splash-video"
            poster="/splash-poster.webp"
            autoPlay
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            onPlaying={() => (playing.current = true)}
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
