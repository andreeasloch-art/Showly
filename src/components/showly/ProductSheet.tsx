/* Detailansicht eines Artikels (Kostüm, Deko) oder einer Torte, wie eine
 * kleine Produktseite: Bilder zum Wischen, Beschreibung, Details und die
 * Knöpfe zum Bestellen. Öffnet sich als Blatt von unten (am Handy) bzw. als
 * Fenster in der Mitte; Escape und Tippen daneben schließen es. */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { MediaRef } from "@/showly/media";
import { Icon } from "@/showly/ui";
import { useMediaUrl } from "./MediaView";

export type Slide = { key: string; media?: MediaRef | undefined; style?: CSSProperties | undefined; label?: string | undefined };

/** Bilder eines Angebots. Eigene Fotos zuerst; ohne eigene Fotos das
 *  Katalogbild, bei Beispielen dazu zwei Nahaufnahmen davon. */
export function slidesFor(photos: MediaRef[] | undefined, fallback: CSSProperties, demo: boolean, detail: string): Slide[] {
  const own = (photos || []).filter((m) => m.kind !== "video");
  if (own.length) return own.map((m) => ({ key: m.id, media: m }));
  const base: Slide[] = [{ key: "main", style: fallback }];
  if (demo && "backgroundImage" in fallback)
    base.push(
      { key: "z1", style: { ...fallback, backgroundSize: "190%", backgroundPosition: "50% 22%" }, label: detail },
      { key: "z2", style: { ...fallback, backgroundSize: "190%", backgroundPosition: "50% 80%" }, label: detail },
    );
  return base;
}

function SlideView({ s }: { s: Slide }) {
  const url = useMediaUrl(s.media?.id ?? "");
  return (
    <div className="pd-slide" style={s.media ? undefined : s.style}>
      {s.media && url && <img src={url} alt="" draggable={false} />}
      {s.label && <span className="pd-slide-tag">{s.label}</span>}
    </div>
  );
}

/** Wischbare Galerie mit Punkten, Zähler und (mit Maus) Pfeilen */
export function ProductGallery({ slides, alt }: { slides: Slide[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!track) return;
    const on = () => setIndex(Math.round(track.scrollLeft / (track.clientWidth || 1)));
    track.addEventListener("scroll", on, { passive: true });
    return () => track.removeEventListener("scroll", on);
  }, [track]);
  const go = (d: number) => track?.scrollBy({ left: d * track.clientWidth, behavior: "smooth" });
  return (
    <div className="pd-gallery" role="group" aria-roledescription="Bildergalerie" aria-label={alt}>
      <div className="pd-track" ref={setTrack}>
        {slides.map((s) => (
          <SlideView key={s.key} s={s} />
        ))}
      </div>
      {slides.length > 1 && (
        <>
          {index > 0 && (
            <button type="button" className="pd-nav prev" onClick={() => go(-1)} aria-label="Vorheriges Bild">
              <Icon name="arrow" />
            </button>
          )}
          {index < slides.length - 1 && (
            <button type="button" className="pd-nav next" onClick={() => go(1)} aria-label="Nächstes Bild">
              <Icon name="arrow" />
            </button>
          )}
          <span className="pd-count">
            {index + 1}/{slides.length}
          </span>
          <div className="pd-dots" aria-hidden="true">
            {slides.map((s, k) => (
              <i key={s.key} className={k === index ? "on" : ""} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Rahmen der Detailansicht */
export function ProductSheet({
  title,
  slides,
  badges,
  children,
  footer,
  onClose,
}: {
  title: string;
  slides: Slide[];
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="feed26-modal pd-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="feed26-sheet pd-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="pd-close" onClick={onClose} aria-label="Schließen">
          <Icon name="close" />
        </button>
        <div className="pd-body">
          <div className="pd-media">
            <ProductGallery slides={slides} alt={title} />
            {badges && <div className="pd-badges">{badges}</div>}
          </div>
          <div className="pd-info">{children}</div>
        </div>
        {footer && <div className="pd-foot">{footer}</div>}
      </div>
    </div>
  );
}
