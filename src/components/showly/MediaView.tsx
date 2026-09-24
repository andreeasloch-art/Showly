/* Anzeige für hochgeladene Fotos und Videos.
 * Die Dateien liegen in IndexedDB, die Adresse wird beim Anzeigen aufgelöst. */
import { useEffect, useState } from "react";
import { mediaUrl, type MediaRef } from "@/showly/media";
import { Icon } from "@/showly/ui";

function useMediaUrl(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void mediaUrl(id).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function MediaThumb({
  item,
  onOpen,
}: {
  item: MediaRef;
  onOpen?: (item: MediaRef) => void;
}) {
  const url = useMediaUrl(item.id);

  if (!url) return <div className="media-cell media-loading" aria-hidden="true" />;

  if (item.kind === "video") {
    return (
      <div className="media-cell">
        <video src={url} controls preload="metadata" playsInline />
        <span className="media-flag">
          <Icon name="play" /> Video
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="media-cell media-cell-btn"
      onClick={() => onOpen?.(item)}
      aria-label={item.name || "Foto"}
    >
      <img src={url} alt={item.name || ""} loading="lazy" />
    </button>
  );
}

export function MediaGrid({ items }: { items: MediaRef[] }) {
  const [open, setOpen] = useState<MediaRef | null>(null);
  if (!items.length) return null;

  return (
    <>
      <div className={"media-grid n" + Math.min(items.length, 4)}>
        {items.map((m) => (
          <MediaThumb key={m.id} item={m} onOpen={setOpen} />
        ))}
      </div>
      {open && <Lightbox item={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ item, onClose }: { item: MediaRef; onClose: () => void }) {
  const url = useMediaUrl(item.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="media-box" onClick={onClose} role="dialog" aria-modal="true">
      <button className="media-box-close" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      {url && <img src={url} alt={item.name || ""} onClick={(e) => e.stopPropagation()} />}
    </div>
  );
}

/* Bilderstrecke im Feed, wie bei Instagram: ein Bild pro Seite, seitlich
 * wischen, Punkte darunter zeigen die Stelle.
 *
 * Gewischt wird mit dem eingebauten Einrasten des Browsers (scroll-snap).
 * Das fühlt sich auf dem Handy richtig an und braucht keine eigene
 * Wischerkennung. Die Pfeile erscheinen nur mit Maus und nur, wenn es in
 * die Richtung weitergeht. */
export function MediaCarousel({ items }: { items: MediaRef[] }) {
  const [index, setIndex] = useState(0);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!track) return;
    const onScroll = () => {
      const w = track.clientWidth || 1;
      setIndex(Math.round(track.scrollLeft / w));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [track]);

  if (!items.length) return null;

  const go = (d: number) => {
    if (!track) return;
    track.scrollBy({ left: d * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="ig-carousel">
      <div className="ig-track" ref={setTrack}>
        {items.map((m) => (
          <CarouselSlide key={m.id} item={m} />
        ))}
      </div>
      {items.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              className="ig-nav prev"
              onClick={() => go(-1)}
              aria-label="Zurück"
            >
              <Icon name="arrow" />
            </button>
          )}
          {index < items.length - 1 && (
            <button type="button" className="ig-nav next" onClick={() => go(1)} aria-label="Weiter">
              <Icon name="arrow" />
            </button>
          )}
          <span className="ig-count">
            {index + 1}/{items.length}
          </span>
          <div className="ig-dots" aria-hidden="true">
            {items.map((m, k) => (
              <i key={m.id} className={k === index ? "on" : ""} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarouselSlide({ item }: { item: MediaRef }) {
  const url = useMediaUrl(item.id);
  return (
    <div className="ig-slide">
      {!url ? (
        <div className="ig-slide-loading" aria-hidden="true" />
      ) : item.kind === "video" ? (
        <video src={url} controls preload="metadata" playsInline />
      ) : (
        <img src={url} alt={item.name || ""} loading="lazy" draggable={false} />
      )}
    </div>
  );
}
