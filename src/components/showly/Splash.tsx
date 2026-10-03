/* Vorspann beim Öffnen der App: das Startvideo mit allen Figuren, in der
 * Mitte wächst das Showly-Logo aus dem Licht. Vier Sekunden, ohne Ton.
 *
 * Er kommt bei jedem Öffnen bzw. Neuladen der App, aber nicht beim Wechsel
 * zwischen Seiten.
 *
 * Damit das Video auch am Handy wirklich läuft:
 * - Es wird fest stumm geschaltet (Eigenschaft und Attribut). React setzt
 *   "muted" sonst nur als Eigenschaft, und iPhones blockieren dann das
 *   automatische Abspielen.
 * - Die vier Sekunden zählen erst, wenn das Video spielt.
 * - Startet es nicht, wird die Datei ganz geladen und aus dem Speicher
 *   abgespielt. Manche Server liefern Videos nicht stückweise aus, was
 *   iPhones zum Abspielen brauchen.
 * - Sperrt das Handy automatisches Abspielen ganz (Stromsparmodus), startet
 *   ein Tippen das Video. Läuft es, schließt ein Tippen den Vorspann.
 * Nur wenn das Video gar nicht abspielbar ist, läuft dieselbe Szene als
 * Bild-Animation. */
import { useEffect, useRef, useState } from "react";

const VIDEO_MS = 4000;
const RETRY_MS = 1800; // dann aus dem Speicher versuchen
const GIVE_UP_MS = 7000; // dann Bild-Animation
const ANIM_MS = 3600;
const FADE_MS = 500;

let shownThisLoad = false;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [anim, setAnim] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]);
  const ended = useRef(false);
  const playing = useRef(false);
  const blobUrl = useRef<string | null>(null);

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
  function tryPlay() {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.play().catch(() => {});
  }
  /* Ganze Datei laden und aus dem Speicher abspielen */
  async function fromMemory() {
    const v = video.current;
    if (!v || playing.current || ended.current || blobUrl.current) return;
    const src = v.canPlayType('video/mp4; codecs="avc1.4D401E"') ? "/splash.mp4" : "/splash.webm";
    try {
      const res = await fetch(src);
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      blobUrl.current = url;
      if (playing.current || ended.current) return;
      v.src = url;
      v.load();
      tryPlay();
    } catch {
      /* bleibt beim Standbild, Tippen startet */
    }
  }

  useEffect(() => {
    if (shownThisLoad) {
      setPhase("gone");
      return;
    }
    shownThisLoad = true;
    tryPlay();
    later(fromMemory, RETRY_MS);
    later(() => {
      if (!playing.current && !ended.current) {
        setAnim(true);
        clearAll();
        later(close, ANIM_MS);
      }
    }, GIVE_UP_MS);
    return () => {
      clearAll();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlaying() {
    if (playing.current || ended.current) return;
    playing.current = true;
    clearAll();
    /* Ab jetzt zählen die vier Sekunden; "ended" schließt meist schon vorher */
    later(close, VIDEO_MS + 500);
  }

  function onTap() {
    /* Läuft das Video noch nicht, startet ein Tippen es (erlaubt das Handy
       immer). Sonst schließt das Tippen den Vorspann. */
    if (!playing.current && !anim && video.current) {
      tryPlay();
      return;
    }
    close();
  }

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={onTap} role="presentation" aria-hidden="true">
      <div className="splash-backdrop" />
      <div className={"splash-stage" + (anim ? " anim" : "")}>
        {anim ? (
          <>
            <img className="splash-video" src="/splash-poster.webp" alt="" />
            <div className="splash-logo">
              <img src="/logo-showly@2x.png" alt="" />
            </div>
          </>
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
            onPlaying={onPlaying}
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
