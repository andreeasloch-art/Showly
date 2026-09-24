/* Gemeinsame UI-Helfer für die Showly-App (portiert aus dem Prototyp) */
import { mediaUrlSync } from "@/showly/media";
import type { CSSProperties } from "react";
import { ICON, ART_IMG, SHOP_IMG, CATS, type Artist, type ShopItem } from "./data";

export function Icon({ name, className }: { name: string; className?: string }) {
  const svg = ICON[name] || ICON["mask"] || "";
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Html({ html, className, style }: { html: string; className?: string; style?: CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function catIconName(id: string) {
  const c = CATS.find((x) => x.id === id);
  return (c && c.icon) || "mask";
}

export function CatIcon({ id }: { id: string }) {
  return <Icon name={catIconName(id)} />;
}

/* Die Bilder liegen als Dateien unter public/acts und public/shop. Vorher
   steckten sie als Text im JavaScript und wurden mit jedem Seitenaufruf
   mitgeliefert, auch auf Seiten, die gar kein Bild zeigen. Als Datei laedt der
   Browser nur, was er wirklich anzeigt, und behaelt es im Zwischenspeicher. */
function fileUrl(path: string) {
  return `url('${path}')`;
}

/** Anbieter mit festen Paketen (Planer). Alle anderen rechnen pro Stunde ab. */
export function hasPackages(a?: Artist | null) {
  return !!(a && ((a as { packages?: unknown[] }).packages || []).length);
}

/* Erstes eigenes Foto des Künstlers, sofern hochgeladen und geladen */
function ownPhotoUrl(a: Artist): string | null {
  const first = (a["photos"] as { id: string }[] | undefined)?.[0];
  return first ? mediaUrlSync(first.id) : null;
}

export function hasImg(a?: Artist | null) {
  return !!(a && (ownPhotoUrl(a) || ART_IMG[String(a.id)]));
}

/** Hintergrund für ein einzelnes hochgeladenes Bild */
export function mediaBg(id: string | undefined, pos?: string): CSSProperties | null {
  const url = id ? mediaUrlSync(id) : null;
  if (!url) return null;
  return {
    backgroundImage: `url('${url}')`,
    backgroundSize: "cover",
    backgroundPosition: pos || "center",
    backgroundRepeat: "no-repeat",
  };
}

export function bgOf(a: Artist, pos?: string): CSSProperties {
  /* Eigene Fotos des Künstlers haben Vorrang vor der Zeichnung */
  const src = ownPhotoUrl(a) || ART_IMG[String(a.id)];
  if (src) {
    return {
      background: a.color,
      backgroundImage: fileUrl(src),
      backgroundSize: "cover",
      backgroundPosition: pos || "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { background: `linear-gradient(140deg,${a.color || "#F1EAFF"},#FFFFFF)` };
}

export function shopBg(i: ShopItem): CSSProperties {
  const own = i.photo ? mediaBg(i.photo.id) : null;
  if (own) return own;
  const src = SHOP_IMG[String(i.id)];
  if (src) {
    return {
      backgroundImage: fileUrl(src),
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { background: "linear-gradient(135deg,#FFF6F2,#F6F1FF)" };
}

/* Kalender-Helfer */
export function pad2(n: number) {
  return n < 10 ? "0" + n : "" + n;
}
export function isoOf(y: number, m: number, d: number) {
  return y + "-" + pad2(m + 1) + "-" + pad2(d);
}
export function todayISO() {
  const d = new Date();
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}
export const SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
