/* Story posten (Konto → Story), für Künstler, Torten- und Deko-Anbieter
 * und Locations.
 *
 * Foto oder Video wählen, kurzen Text dazu, posten. Die Datei wird wie
 * jedes Foto auf Kontaktdaten geprüft und vom Team freigegeben; ab der
 * Freigabe ist die Story 24 Stunden auf der Startseite zu sehen. Darunter
 * die eigenen Stories der letzten Tage mit Stand.
 *
 * Ohne Datenbank (Übungsbetrieb) bleibt die Story auf diesem Gerät. */
import { useEffect, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { isBackendConfigured } from "@/lib/supabase";
import { contactMessage } from "@/showly/contactGuard";
import {
  invalidateCloudStories,
  localStories,
  saveLocalStories,
  type StoryKind,
} from "@/showly/stories";
import { isCloudMedia, type MediaRef } from "@/showly/media";
import { useCheckedUpload } from "./useCheckedUpload";
import { useMediaUrl } from "./MediaView";

const MAX = 160;

const COPY = {
  de: {
    h: "Story posten",
    p: "Zeig, was gerade bei dir los ist: ein Foto oder kurzes Video (bis 60 Sekunden). Deine Story erscheint ganz oben auf der Startseite.",
    rules:
      "Wird vorher geprüft und ist ab der Freigabe 24 Stunden zu sehen. Keine Telefonnummern, Mail-Adressen oder Links.",
    pick: "Foto oder Video wählen",
    change: "Andere Datei",
    as: "Posten als",
    kinds: {
      artist: "Künstlerprofil",
      baker: "Torten & Süßes",
      deco: "Deko & Kostüme",
      location: "Location",
    } as Record<StoryKind, string>,
    caption: "Text (freiwillig)",
    captionPh: "z. B. Heute Abend in Stuttgart",
    post: "Story posten",
    posting: "Wird gepostet …",
    sentReview:
      "Danke! Deine Story wird geprüft und erscheint nach der Freigabe für 24 Stunden.",
    sentLive: "Deine Story ist jetzt zu sehen.",
    sentLocal:
      "Gepostet. Im Übungsbetrieb ist die Story nur auf diesem Gerät zu sehen.",
    mine: "Deine Stories",
    none: "Noch keine Story in den letzten 7 Tagen.",
    state: {
      pending: "Wird geprüft",
      live: "Läuft",
      expired: "Abgelaufen",
      rejected: "Abgelehnt",
      removed: "Entfernt",
    },
    left: (h: number) => (h < 1 ? "noch unter 1 Std." : `noch ${h} Std.`),
    del: "Löschen",
    noProfile:
      "Stories können Anbieterinnen und Anbieter posten. Lege zuerst dein Profil an.",
  },
  en: {
    h: "Post a story",
    p: "Show what's happening: a photo or short video (up to 60 seconds). Your story appears at the top of the home page.",
    rules:
      "Checked first and visible for 24 hours from approval. No phone numbers, emails or links.",
    pick: "Choose photo or video",
    change: "Other file",
    as: "Post as",
    kinds: {
      artist: "Artist profile",
      baker: "Cakes & sweets",
      deco: "Decor & costumes",
      location: "Venue",
    } as Record<StoryKind, string>,
    caption: "Text (optional)",
    captionPh: "e.g. Tonight in Stuttgart",
    post: "Post story",
    posting: "Posting …",
    sentReview:
      "Thanks! Your story is being reviewed and will be visible for 24 hours after approval.",
    sentLive: "Your story is now live.",
    sentLocal:
      "Posted. In practice mode the story is only visible on this device.",
    mine: "Your stories",
    none: "No stories in the last 7 days.",
    state: {
      pending: "In review",
      live: "Live",
      expired: "Expired",
      rejected: "Rejected",
      removed: "Removed",
    },
    left: (h: number) => (h < 1 ? "under 1 h left" : `${h} h left`),
    del: "Delete",
    noProfile: "Stories can be posted by providers. Create your profile first.",
  },
  es: {
    h: "Publicar historia",
    p: "Muestra lo que pasa: una foto o un vídeo corto (hasta 60 segundos). Tu historia aparece arriba en la página de inicio.",
    rules:
      "Se revisa antes y se ve 24 horas desde la aprobación. Sin teléfonos, correos ni enlaces.",
    pick: "Elegir foto o vídeo",
    change: "Otro archivo",
    as: "Publicar como",
    kinds: {
      artist: "Perfil de artista",
      baker: "Tartas y dulces",
      deco: "Decoración y disfraces",
      location: "Lugar",
    } as Record<StoryKind, string>,
    caption: "Texto (opcional)",
    captionPh: "p. ej. Esta noche en Stuttgart",
    post: "Publicar historia",
    posting: "Publicando …",
    sentReview:
      "¡Gracias! Tu historia se revisa y se verá 24 horas tras la aprobación.",
    sentLive: "Tu historia ya se ve.",
    sentLocal: "Publicada. En modo de prueba solo se ve en este dispositivo.",
    mine: "Tus historias",
    none: "Ninguna historia en los últimos 7 días.",
    state: {
      pending: "En revisión",
      live: "Activa",
      expired: "Caducada",
      rejected: "Rechazada",
      removed: "Eliminada",
    },
    left: (h: number) => (h < 1 ? "queda menos de 1 h" : `quedan ${h} h`),
    del: "Eliminar",
    noProfile:
      "Las historias las publican los proveedores. Crea primero tu perfil.",
  },
} as const;

interface Row {
  id: string;
  url: string;
  ref?: string;
  kind: "image" | "video";
  caption: string;
  state: "pending" | "live" | "expired" | "rejected" | "removed";
  reason: string | null;
  expiresAt: string | null;
}

function Thumb({ r }: { r: Row }) {
  const local = useMediaUrl(r.ref || "");
  const src = r.url || local || "";
  if (!src) return <span className="sc-thumb" />;
  return r.kind === "video" ? (
    <video className="sc-thumb" src={src} muted playsInline />
  ) : (
    <img className="sc-thumb" src={src} alt="" />
  );
}

export function StoryComposer({ kinds }: { kinds: StoryKind[] }) {
  const { lang, toast, session } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const cloud = !!session?.backend && isBackendConfigured();
  const { upload, label, busy } = useCheckedUpload(lang, toast);
  const [kind, setKind] = useState<StoryKind | undefined>(kinds[0]);
  const [file, setFile] = useState<MediaRef | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const input = useRef<HTMLInputElement | null>(null);
  const preview = useMediaUrl(file?.id || "");
  const warn = caption.trim() ? contactMessage(caption, lang) : null;

  async function reload() {
    if (cloud) {
      const { myStories } = await import("@/utils/story.functions");
      const r = await myStories().catch(() => ({ items: [] }));
      setRows(r.items);
    } else {
      setRows(
        localStories().map((s) => ({
          id: s.id,
          url: "",
          ref: s.ref,
          kind: s.kind,
          caption: s.caption,
          state: "live" as const,
          reason: null,
          expiresAt: new Date(
            new Date(s.at).getTime() + 86_400_000,
          ).toISOString(),
        })),
      );
    }
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud]);
  useEffect(() => {
    if (!kind && kinds[0]) setKind(kinds[0]);
  }, [kinds, kind]);

  if (!kinds.length || !kind)
    return (
      <div className="dash26-panel sc">
        <h2>{C.h}</h2>
        <p className="sc-p">{C.noProfile}</p>
      </div>
    );

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const [ref] = await upload([files[0]!], { video: true });
    if (ref) setFile(ref);
  }

  async function post() {
    if (!file || !kind || warn || sending) return;
    setSending(true);
    try {
      if (cloud && isCloudMedia(file.id)) {
        const { postStory } = await import("@/utils/story.functions");
        const r = await postStory({
          data: { mediaId: file.id.slice(2), kind, caption: caption.trim() },
        });
        if ("error" in r) {
          toast(r.error);
          return;
        }
        toast(r.live ? C.sentLive : C.sentReview);
        invalidateCloudStories();
      } else {
        saveLocalStories([
          {
            id: "local-" + file.id,
            ref: file.id,
            kind: file.kind,
            caption: caption.trim(),
            at: new Date().toISOString(),
            providerKind: kind,
          },
          ...localStories(),
        ]);
        toast(C.sentLocal);
      }
      setFile(null);
      setCaption("");
      await reload();
    } finally {
      setSending(false);
    }
  }

  async function remove(r: Row) {
    if (cloud && !r.ref) {
      const { deleteStory } = await import("@/utils/story.functions");
      const res = await deleteStory({ data: { id: r.id } });
      if ("error" in res) return toast(res.error);
      invalidateCloudStories();
    } else {
      saveLocalStories(localStories().filter((s) => s.id !== r.id));
    }
    await reload();
  }

  const hoursLeft = (iso: string | null) =>
    iso
      ? Math.max(
          0,
          Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000),
        )
      : 0;

  return (
    <div className="dash26-panel sc">
      <h2>{C.h}</h2>
      <p className="sc-p">{C.p}</p>

      {kinds.length > 1 && (
        <div className="sc-as" role="radiogroup" aria-label={C.as}>
          <span>{C.as}</span>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={"sc-chip" + (kind === k ? " on" : "")}
              onClick={() => setKind(k)}
            >
              {C.kinds[k]}
            </button>
          ))}
        </div>
      )}

      <div className="sc-new">
        <button
          type="button"
          className={"sc-drop" + (file ? " has" : "")}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {file && preview ? (
            file.kind === "video" ? (
              <video src={preview} muted playsInline autoPlay loop />
            ) : (
              <img src={preview} alt="" />
            )
          ) : (
            <span className="sc-drop-in">
              <Icon name="camera" />
              {label || C.pick}
            </span>
          )}
          {file && <span className="sc-change">{busy ? label : C.change}</span>}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) =>
            void pick(e.target.files).finally(() => (e.target.value = ""))
          }
        />

        <div className="sc-side">
          <label className="sc-label">
            {C.caption}
            <textarea
              value={caption}
              maxLength={MAX}
              rows={3}
              placeholder={C.captionPh}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <div className="sc-count">
            {caption.length}/{MAX}
          </div>
          {warn && <p className="sc-warn">{warn}</p>}
          <p className="sc-rules">{C.rules}</p>
          <button
            type="button"
            className="sc-post"
            disabled={!file || !!warn || sending || busy}
            onClick={() => void post()}
          >
            {sending ? C.posting : C.post}
          </button>
        </div>
      </div>

      <h3 className="sc-h3">{C.mine}</h3>
      {!rows.length ? (
        <p className="sc-p">{C.none}</p>
      ) : (
        <ul className="sc-list">
          {rows.map((r) => (
            <li key={r.id}>
              <Thumb r={r} />
              <div className="sc-info">
                <span className={"sc-state " + r.state}>
                  {C.state[r.state]}
                  {r.state === "live" && " · " + C.left(hoursLeft(r.expiresAt))}
                </span>
                {r.caption && <span className="sc-cap">{r.caption}</span>}
                {r.reason && <span className="sc-reason">{r.reason}</span>}
              </div>
              <button
                type="button"
                className="sc-del"
                onClick={() => void remove(r)}
                aria-label={C.del}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
