/* Hochladen mit Prüfung auf Kontaktdaten (mediaCheck.ts).
 *
 * Jede Datei wird geprüft, bevor sie gespeichert wird. Was Kontaktdaten
 * zeigt, wird nicht gespeichert, und es erscheint ein Hinweis, was gefunden
 * wurde und wo. Der Zustand "label" sagt, was gerade passiert, damit beim
 * Prüfen eines Videos niemand denkt, die App hänge. */
import { useState } from "react";
import { MediaError, preloadMedia, putMedia, MAX_VIDEO_BYTES, type MediaRef } from "@/showly/media";
import { checkMedia, mediaCheckMessage } from "@/showly/mediaCheck";

const T = {
  de: {
    checking: "Wird auf Kontaktdaten geprüft …",
    checkingVideo: (d: number, n: number) => `Video wird geprüft … ${d}/${n}`,
    errType: "Nur Fotos und Videos sind möglich.",
    errTypeImg: "Hier sind nur Fotos möglich.",
    errSize: `Das Video ist zu groß. Höchstens ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
    errStore: "Die Datei konnte nicht gespeichert werden. Ist der Speicher voll?",
  },
  en: {
    checking: "Checking for contact details …",
    checkingVideo: (d: number, n: number) => `Checking video … ${d}/${n}`,
    errType: "Only photos and videos are allowed.",
    errTypeImg: "Only photos are allowed here.",
    errSize: `The video is too large. ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB at most.`,
    errStore: "The file could not be saved. Is the storage full?",
  },
  es: {
    checking: "Comprobando datos de contacto …",
    checkingVideo: (d: number, n: number) => `Comprobando vídeo … ${d}/${n}`,
    errType: "Solo se permiten fotos y vídeos.",
    errTypeImg: "Aquí solo se permiten fotos.",
    errSize: `El vídeo es demasiado grande. Máximo ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
    errStore: "No se pudo guardar el archivo. ¿Está lleno el almacenamiento?",
  },
} as const;

export function useCheckedUpload(lang: string, toast: (msg: string) => void) {
  const C = T[lang as "de" | "en" | "es"] ?? T.de;
  const [label, setLabel] = useState<string | null>(null);

  async function upload(files: File[], opts: { video?: boolean } = {}): Promise<MediaRef[]> {
    const out: MediaRef[] = [];
    for (const f of files) {
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (!isImg && !(isVid && opts.video)) {
        toast(opts.video ? C.errType : C.errTypeImg);
        continue;
      }
      if (isVid && f.size > MAX_VIDEO_BYTES) {
        toast(C.errSize);
        continue;
      }
      setLabel(isVid ? C.checkingVideo(0, 1) : C.checking);
      const r = await checkMedia(f, (d, n) => setLabel(C.checkingVideo(d, n)));
      if (!r.ok) {
        toast(mediaCheckMessage(r, f.name, lang));
        continue;
      }
      try {
        out.push(await putMedia(f));
      } catch (e) {
        const why = e instanceof MediaError ? e.reason : "store";
        toast(why === "type" ? C.errType : why === "size" ? C.errSize : C.errStore);
      }
    }
    setLabel(null);
    await preloadMedia(out.filter((m) => m.kind === "image").map((m) => m.id));
    return out;
  }

  return { upload, label, busy: label !== null };
}
