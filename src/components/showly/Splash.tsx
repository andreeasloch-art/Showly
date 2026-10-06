/* Vorspann beim Öffnen der App: das Startvideo mit allen Figuren, in der
 * Mitte wächst das Showly-Logo aus dem Licht.
 *
 * Er startet von selbst, läuft einmal durch (gut vier Sekunden) und blendet
 * dann aus. Ein Tippen schließt ihn sofort. Er kommt bei jedem Öffnen bzw.
 * Neuladen der App, aber nicht beim Wechsel zwischen Seiten.
 *
 * Abgespielt wird ein echtes Video (H.264, 720 px, 24 Bilder pro Sekunde),
 * das der Grafikchip entschlüsselt. Drei Wege, der erste, der klappt, gewinnt:
 *   1. <video> startet von selbst (normaler Browser, fertige App).
 *   2. Ist das gesperrt (eingebettete Ansichten in Apps, Stromsparmodus),
 *      entschlüsselt die App dasselbe Video selbst und malt es in ein
 *      <canvas> (showly/splashPlayer.ts). Läuft nach der echten Uhr, also
 *      nie in Zeitlupe.
 *   3. Sehr alte Geräte ohne beides: das animierte Bild (AVIF/WebP).
 * Bis das erste Bild läuft, steht das Standbild da. Solange der Vorspann zu
 * sehen ist, ruht die Figuren-Animation dahinter (Klasse splash-open). */
import { useEffect, useRef, useState } from "react";
import { canDecodeVideo, playOnCanvas } from "@/showly/splashPlayer";

const FADE_MS = 450;
/* Länge des animierten Bilds (Weg 3) */
const ANIM_MS = 4000;
/* Nach dieser Zeit prüfen, ob das Video überhaupt starten darf */
const START_MS = 900;
/* Spätestens dann ist der Vorspann weg, egal was passiert */
const MAX_MS = 7000;

let shownThisLoad = false;

type Mode = "wait" | "video" | "canvas" | "anim";

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [mode, setMode] = useState<Mode>("wait");
  const [on, setOn] = useState(false);
  const timers = useRef<number[]>([]);
  const anim = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef({ stopped: false });
  const animStarted = useRef(false);

  function clearAll() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function close() {
    clearAll();
    player.current.stopped = true;
    setPhase((p) => (p === "show" ? "fade" : p));
    timers.current.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
  }
  /* Video darf nicht starten: eigener Abspieler, sonst animiertes Bild */
  function fallback() {
    setMode((m) => (m === "wait" ? (canDecodeVideo() ? "canvas" : "anim") : m));
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
      v.play()?.catch(fallback);
    }
    /* Steht das Video nach kurzer Zeit still (Autoplay gesperrt), Ersatzweg
       nehmen. Lädt es nur noch, weiter warten; das Standbild steht ja. */
    timers.current.push(
      window.setTimeout(() => {
        const v2 = video.current;
        if (!v2 || v2.paused || v2.error) fallback();
      }, START_MS),
    );
    timers.current.push(window.setTimeout(close, MAX_MS - FADE_MS));
    return () => {
      clearAll();
      player.current.stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "wait" || mode === "video") return;
    video.current?.pause();
    if (mode === "canvas" && canvas.current) {
      playOnCanvas(canvas.current, "/splash.mp4", player.current, () => setOn(true)).then(
        () => close(),
        () => {
          if (player.current.stopped) return;
          setOn(false);
          setMode("anim");
        },
      );
    }
    if (mode === "anim" && anim.current?.complete && anim.current.naturalWidth > 0) animReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function animReady() {
    if (animStarted.current) return;
    animStarted.current = true;
    setOn(true);
    timers.current.push(window.setTimeout(close, ANIM_MS - FADE_MS));
  }

  /* Hintergrund-Animation anhalten, solange der Vorspann zu sehen ist */
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "gone") root.classList.remove("splash-open");
    else root.classList.add("splash-open");
    return () => root.classList.remove("splash-open");
  }, [phase]);

  if (phase === "gone") return null;
  const cls = (m: Mode) => "splash-video splash-anim" + (mode === m && on ? " on" : "");
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={close} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className="splash-stage">
        <img className="splash-video" src="/splash-poster.webp" alt="" fetchPriority="high" />
        {(mode === "wait" || mode === "video") && (
          <video
            ref={video}
            className={cls("video")}
            src="/splash.mp4"
            poster="/splash-poster.webp"
            muted
            playsInline
            autoPlay
            preload="auto"
            disablePictureInPicture
            onPlaying={() => {
              setMode((m) => (m === "wait" ? "video" : m));
              setOn(true);
            }}
            onEnded={close}
            onError={fallback}
          />
        )}
        {mode === "canvas" && <canvas ref={canvas} className={cls("canvas")} />}
        {mode === "anim" && (
          <picture>
            <source srcSet="/splash-anim.avif" type="image/avif" />
            <img ref={anim} className={cls("anim")} src="/splash-anim.webp" alt="" onLoad={animReady} />
          </picture>
        )}
      </div>
    </div>
  );
}
