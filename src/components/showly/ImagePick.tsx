/* Bilder hochladen für Anbieterprofile und Angebote (Torten, Deko).
 *
 * Die Dateien landen im Browser-Speicher (IndexedDB), die Adresse wird
 * gleich vorgeladen, damit Vorschau und Karten das Bild sofort zeigen. */
import { useRef, useState } from "react";
import { MediaError, preloadMedia, putMedia, type MediaRef } from "@/showly/media";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";

const TEXT = {
  de: { add: "Foto hochladen", change: "Foto ändern", remove: "Entfernen", busy: "Lädt …", errType: "Bitte ein Bild wählen (JPG, PNG oder WebP).", errStore: "Das Bild konnte nicht gespeichert werden." },
  en: { add: "Upload photo", change: "Change photo", remove: "Remove", busy: "Loading …", errType: "Please choose an image (JPG, PNG or WebP).", errStore: "The image could not be saved." },
  es: { add: "Subir foto", change: "Cambiar foto", remove: "Quitar", busy: "Cargando …", errType: "Elige una imagen (JPG, PNG o WebP).", errStore: "No se pudo guardar la imagen." },
} as const;

export function useImageStore() {
  const { lang, toast } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  return async function store(files: FileList | File[] | null, max = 8): Promise<MediaRef[]> {
    const out: MediaRef[] = [];
    for (const f of Array.from(files || []).slice(0, max)) {
      if (!f.type.startsWith("image/")) {
        toast(T.errType);
        continue;
      }
      try {
        out.push(await putMedia(f));
      } catch (e) {
        toast(e instanceof MediaError && e.reason === "type" ? T.errType : T.errStore);
      }
    }
    await preloadMedia(out.map((m) => m.id));
    return out;
  };
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
          {busy ? T.busy : value ? T.change : T.add}
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
