/* Story-Betrachter wie bei Instagram, bildschirmfüllend.
 *
 *  - oben Balken je Story, Name, Zeit, Schließen
 *  - Tippen links: zurück, rechts: weiter; Gedrückthalten hält an
 *  - nach unten wischen oder Esc: schließen
 *  - Fotos 5 Sekunden, Videos so lang wie das Video (höchstens 60 s)
 *  - nach der letzten Story eines Anbieters geht es zum nächsten
 *  - unten Text und "Profil ansehen"; echte Stories lassen sich melden */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  captionText,
  markSeen,
  profileLink,
  type StoryGroup,
} from "@/showly/stories";
import { useMediaUrl } from "./MediaView";
import { ReportMenu } from "./ReportMenu";

const PHOTO_MS = 5000;

const COPY = {
  de: {
    close: "Schließen",
    profile: "Profil ansehen",
    demo: "Beispiel",
    local: "Nur auf diesem Gerät",
    ago: (h: number) => (h < 1 ? "gerade eben" : `vor ${h} Std.`),
    paused: "Angehalten",
  },
  en: {
    close: "Close",
    profile: "View profile",
    demo: "Example",
    local: "Only on this device",
    ago: (h: number) => (h < 1 ? "just now" : `${h} h ago`),
    paused: "Paused",
  },
  es: {
    close: "Cerrar",
    profile: "Ver perfil",
    demo: "Ejemplo",
    local: "Solo en este dispositivo",
    ago: (h: number) => (h < 1 ? "ahora" : `hace ${h} h`),
    paused: "En pausa",
  },
} as const;

export function StoryViewer({
  groups,
  start,
  onClose,
}: {
  groups: StoryGroup[];
  start: number;
  onClose: () => void;
}) {
  const { lang } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const press = useRef<{
    x: number;
    y: number;
    t: number;
    held: boolean;
  } | null>(null);
  const holdTimer = useRef<number | null>(null);

  const g = groups[gi];
  const s = g?.stories[si];
  const localUrl = useMediaUrl(s?.ref || "");
  const src = s ? s.url || localUrl || "" : "";

  function next() {
    if (!g) return;
    if (si < g.stories.length - 1) {
      setSi(si + 1);
    } else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(0);
    } else onClose();
    setProgress(0);
  }
  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      const pg = groups[gi - 1]!;
      setGi(gi - 1);
      setSi(pg.stories.length - 1);
    }
    setProgress(0);
  }

  /* Gesehen merken */
  useEffect(() => {
    if (s) markSeen(s.id);
  }, [s]);

  /* Seite dahinter festhalten, Tasten */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", key);
    };
  });

  /* Fotos: Zeit selbst zählen */
  useEffect(() => {
    if (!s || s.kind !== "image" || paused || !src) return;
    let raf = 0;
    let last = performance.now();
    let p = progress;
    const tick = (now: number) => {
      p += (now - last) / PHOTO_MS;
      last = now;
      if (p >= 1) {
        next();
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, paused, src]);

  /* Videos: anhalten/weiter mit dem Betrachter */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    /* Mit Ton geht es nur nach einer Berührung; sonst stumm abspielen */ else
      void v.play().catch(() => {
        v.muted = true;
        return v.play().catch(() => undefined);
      });
  }, [paused, src]);

  /* Nächstes Bild schon laden */
  useEffect(() => {
    const n = g?.stories[si + 1] || groups[gi + 1]?.stories[0];
    if (n?.kind === "image" && n.url) {
      const img = new Image();
      img.src = n.url;
    }
  }, [gi, si, g, groups]);

  if (!g || !s) return null;
  const name = g.name[lang] || g.name["de"] || "";
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(s.at).getTime()) / 3_600_000),
  );
  const link = profileLink(g);
  const caption = captionText(s.caption, lang);

  function down(e: React.PointerEvent) {
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), held: false };
    holdTimer.current = window.setTimeout(() => {
      if (press.current) press.current.held = true;
      setPaused(true);
    }, 220);
  }
  function up(e: React.PointerEvent) {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (e.clientY - p.y > 80) return onClose();
    if (p.held) {
      setPaused(false);
      return;
    }
    if (paused) {
      setPaused(false);
      return;
    }
    const w = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - w.left < w.width * 0.3) prev();
    else next();
  }

  return createPortal(
    <div className="sv" role="dialog" aria-modal="true" aria-label={name}>
      <div className="sv-frame">
        <div
          className="sv-media"
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={() => (press.current = null)}
        >
          {s.kind === "video" ? (
            <video
              key={s.id}
              ref={videoRef}
              src={src}
              playsInline
              autoPlay
              muted={false}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration)
                  setProgress(Math.min(1, v.currentTime / v.duration));
              }}
              onEnded={next}
            />
          ) : (
            src && <img key={s.id} src={src} alt="" draggable={false} />
          )}
        </div>

        <div className="sv-top">
          <div className="sv-bars">
            {g.stories.map((x, i) => (
              <span key={x.id} className="sv-bar">
                <i
                  style={{
                    transform: `scaleX(${i < si ? 1 : i === si ? progress : 0})`,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="sv-head">
            <Link {...link} className="sv-who" onClick={onClose}>
              <img src={g.avatar || (s.kind === "image" ? src : "")} alt="" />
              <span className="sv-name">{name}</span>
              <span className="sv-time">{C.ago(hours)}</span>
            </Link>
            {g.demo && <span className="sv-tag">{C.demo}</span>}
            {g.local && <span className="sv-tag">{C.local}</span>}
            {paused && <span className="sv-tag">{C.paused}</span>}
            {!g.demo && !g.local && (
              <span className="sv-more" onClickCapture={() => setPaused(true)}>
                <ReportMenu target="story" id={s.id} author={name} />
              </span>
            )}
            <button
              type="button"
              className="sv-close"
              onClick={onClose}
              aria-label={C.close}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        <div className="sv-foot">
          {caption && <p className="sv-cap">{caption}</p>}
          <Link {...link} className="sv-cta" onClick={onClose}>
            {C.profile} <Icon name="arrow" />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
