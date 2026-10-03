/* Bilder hochladen für Anbieterprofile und Angebote (Torten, Deko).
 *
 * Jede Datei wird zuerst auf Kontaktdaten geprüft und landet dann im
 * Browser-Speicher (IndexedDB); die Adresse wird gleich vorgeladen, damit
 * Vorschau und Karten das Bild sofort zeigen. */
import { useRef, useState } from "react";
import type { MediaRef } from "@/showly/media";
import { useCheckedUpload } from "@/components/showly/useCheckedUpload";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";

const TEXT = {
  de: { add: "Foto hochladen", change: "Foto ändern", remove: "Entfernen", busy: "Lädt …", errType: "Bitte ein Bild wählen (JPG, PNG oder WebP).", errStore: "Das Bild konnte nicht gespeichert werden." },
  en: { add: "Upload photo", change: "Change photo", remove: "Remove", busy: "Loading …", errType: "Please choose an image (JPG, PNG or WebP).", errStore: "The image could not be saved." },
  es: { add: "Subir foto", change: "Cambiar foto", remove: "Quitar", busy: "Cargando …", errType: "Elige una imagen (JPG, PNG o WebP).", errStore: "No se pudo guardar la imagen." },
} as const;

/* Jede Datei wird vor dem Speichern auf Kontaktdaten geprüft
   (useCheckedUpload). `store.label` sagt, was gerade passiert. */
export function useImageStore() {
  const { lang, toast } = useShowly();
  const up = useCheckedUpload(lang, toast);
  const store = (files: FileList | File[] | null, max = 8, video = false): Promise<MediaRef[]> =>
    up.upload(Array.from(files || []).slice(0, max), { video });
  return Object.assign(store, { label: up.label });
}

/** Ein einzelnes Bild mit Vorschau. `fallback` zeigt ein Standardbild. */
export function ImagePick({
  value,
  onChange,
  fallback,
}: {
  value?: MediaRef | undefined;
  onChange: (m: MediaRef | undefined) => void;
  fallback?: React.CSSProperties | undefined;
}) {
  const { lang } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const store = useImageStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const bg = (value && mediaBg(value.id)) || fallback || null;

  async function pick(files: FileList | null) {
    setBusy(true);
    const [ref] = await store(files, 1);
    setBusy(false);
    if (ref) onChange(ref);
  }

  return (
    <div className="img-pick">
      <button
        type="button"
        className={"img-pick-box" + (bg ? " has" : "")}
        style={bg || undefined}
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        <span className="img-pick-lbl">
          <Icon name="camera" />
          {busy ? (store.label ?? T.busy) : value ? T.change : T.add}
        </span>
      </button>
      {value && (
        <button type="button" className="img-pick-rm" onClick={() => onChange(undefined)}>
          {T.remove}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
