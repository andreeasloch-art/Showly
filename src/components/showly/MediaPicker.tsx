/* Auswahl von Fotos und Videos für Bewertungen und Beiträge.
 * Bilder werden beim Ablegen verkleinert, Videos nur auf Größe geprüft. */
import { useRef, useState } from "react";
import { Icon } from "@/showly/ui";
import {
  MAX_FILES_PER_POST,
  MAX_VIDEO_BYTES,
  MediaError,
  putMedia,
  deleteMedia,
  type MediaRef,
} from "@/showly/media";
import { MediaThumb } from "./MediaView";

const TEXT = {
  de: {
    add: "Fotos oder Video hinzufügen",
    busy: "Wird vorbereitet …",
    remove: "Entfernen",
    hint: `Bis zu ${MAX_FILES_PER_POST} Dateien, Video bis ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`,
    errType: "Nur Bilder und Videos sind möglich.",
    errSize: `Das Video ist zu groß. Höchstens ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
    errStore: "Die Datei konnte nicht gespeichert werden.",
    errMax: `Mehr als ${MAX_FILES_PER_POST} Dateien gehen nicht.`,
  },
  en: {
    add: "Add photos or video",
    busy: "Preparing …",
    remove: "Remove",
    hint: `Up to ${MAX_FILES_PER_POST} files, video up to ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`,
    errType: "Only images and videos are supported.",
    errSize: `That video is too large. ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB at most.`,
    errStore: "The file could not be stored.",
    errMax: `No more than ${MAX_FILES_PER_POST} files.`,
  },
  es: {
    add: "Añadir fotos o vídeo",
    busy: "Preparando …",
    remove: "Quitar",
    hint: `Hasta ${MAX_FILES_PER_POST} archivos, vídeo hasta ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`,
    errType: "Solo se admiten imágenes y vídeos.",
    errSize: `El vídeo es demasiado grande. Máximo ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
    errStore: "No se pudo guardar el archivo.",
    errMax: `No más de ${MAX_FILES_PER_POST} archivos.`,
  },
} as const;

export function MediaPicker({
  value,
  onChange,
  lang = "de",
}: {
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  lang?: "de" | "en" | "es";
}) {
  const T = TEXT[lang] ?? TEXT.de;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(files: FileList | null) {
    if (!files || !files.length) return;
    setErr("");
    const room = MAX_FILES_PER_POST - value.length;
    if (room <= 0) {
      setErr(T.errMax);
      return;
    }
    setBusy(true);
    const added: MediaRef[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        added.push(await putMedia(file));
      } catch (e) {
        const reason = e instanceof MediaError ? e.reason : "store";
        setErr(reason === "type" ? T.errType : reason === "size" ? T.errSize : T.errStore);
      }
    }
    setBusy(false);
    if (added.length) onChange([...value, ...added]);
    if (input.current) input.current.value = "";
  }

  function drop(id: string) {
    void deleteMedia(id);
    onChange(value.filter((m) => m.id !== id));
  }

  return (
    <div className="picker">
      <div className="picker-row">
        <button
          type="button"
          className="picker-btn"
          onClick={() => input.current?.click()}
          disabled={busy || value.length >= MAX_FILES_PER_POST}
        >
          <Icon name="camera" /> {busy ? T.busy : T.add}
        </button>
        <span className="picker-hint">{T.hint}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => void pick(e.target.files)}
      />
      {err && <p className="picker-err">{err}</p>}
      {value.length > 0 && (
        <div className="picker-previews">
          {value.map((m) => (
            <div className="picker-item" key={m.id}>
              <MediaThumb item={m} />
              <button
                type="button"
                className="picker-drop"
                onClick={() => drop(m.id)}
                aria-label={T.remove}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
