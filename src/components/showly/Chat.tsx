/* Nachrichten zu einer Buchung oder Torten-Anfrage.
 *
 * Mit Anmeldung über die Datenbank gehen die Nachrichten über den Server
 * (chat.functions.ts), der sie auf Kontaktdaten prüft; beide Seiten sehen
 * denselben Verlauf, alle 8 Sekunden aktualisiert. Ohne Datenbank bleibt der
 * Verlauf im Browser (Übungsbetrieb).
 *
 * Der Kontaktdaten-Filter greift schon beim Tippen (Hinweis) und beim
 * Absenden. Der Server prüft noch einmal, falls jemand den Browser umgeht. */
import { useEffect, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { ContactHint, useContactCheck } from "./ContactHint";
import { dbIdOf } from "@/showly/cloudMap";
import { loadJSON, saveJSON } from "@/showly/persist";
import { chatUploadUrl, listMessages, sendMessage, unreadCounts, type ChatMessage, type ThreadRef } from "@/utils/chat.functions";

const COPY = {
  de: {
    title: "Nachrichten",
    ph: "Nachricht schreiben …",
    send: "Senden",
    empty: "Noch keine Nachrichten. Stell hier Fragen zum Ablauf, zum Ort oder zu Wünschen.",
    rule: "Kontakt läuft über Showly. Telefonnummern, E-Mail-Adressen und Links werden nicht zugestellt.",
    close: "Schließen",
    you: "Du",
    customer: "Kunde",
    provider: "Anbieter",
    admin: "Showly-Team",
    read: "gelesen",
    failed: "Nachricht konnte nicht gesendet werden",
    practice: "Übungsbetrieb: Nachrichten bleiben auf diesem Gerät.",
    attach: "Foto oder PDF anhängen",
    tooBig: "Die Datei ist zu groß (höchstens 10 MB).",
    checking: "Wird geprüft …",
    why: "Warum? So greifen Zahlungsschutz, Stornoregeln und Bewertungen (AGB § 20). Nach der Zusage dürft ihr auch Dokumente (PDF) schicken.",
  },
  en: {
    title: "Messages",
    ph: "Write a message …",
    send: "Send",
    empty: "No messages yet. Ask about the schedule, the venue or special wishes here.",
    rule: "Contact goes through Showly. Phone numbers, email addresses and links are not delivered.",
    close: "Close",
    you: "You",
    customer: "Customer",
    provider: "Provider",
    admin: "Showly team",
    read: "read",
    failed: "Message could not be sent",
    practice: "Practice mode: messages stay on this device.",
    attach: "Attach photo or PDF",
    tooBig: "The file is too large (max. 10 MB).",
    checking: "Checking …",
    why: "Why? This keeps payment protection, cancellation rules and reviews in place (terms § 20). After confirmation you can also send documents (PDF).",
  },
  es: {
    title: "Mensajes",
    ph: "Escribe un mensaje …",
    send: "Enviar",
    empty: "Aún no hay mensajes. Pregunta aquí por el horario, el lugar o tus deseos.",
    rule: "El contacto va por Showly. No se entregan teléfonos, correos ni enlaces.",
    close: "Cerrar",
    you: "Tú",
    customer: "Cliente",
    provider: "Proveedor",
    admin: "Equipo Showly",
    read: "leído",
    failed: "No se pudo enviar el mensaje",
    practice: "Modo de prueba: los mensajes se quedan en este dispositivo.",
    attach: "Adjuntar foto o PDF",
    tooBig: "El archivo es demasiado grande (máx. 10 MB).",
    checking: "Comprobando …",
    why: "¿Por qué? Así se mantienen la protección de pago, las reglas de cancelación y las reseñas (condiciones § 20). Tras la confirmación también podéis enviar documentos (PDF).",
  },
} as const;

type LocalMsg = { id: number; role: "customer" | "provider"; body: string; at: string };

export interface ChatProps {
  /** Buchung (App-Kennung) oder Torten-Anfrage (App-Kennung, "db-…" aus der Datenbank) */
  bookingId?: number;
  sweetId?: string;
  /** Aus welcher Sicht der Verlauf gezeigt wird */
  as: "customer" | "provider";
  heading: string;
  onClose: () => void;
}

function cloudRef(p: ChatProps): ThreadRef | null {
  if (p.bookingId !== undefined) {
    const id = dbIdOf(p.bookingId);
    return id === null ? null : { bookingId: id };
  }
  if (p.sweetId && p.sweetId.startsWith("db-")) return { sweetId: Number(p.sweetId.slice(3)) };
  return null;
}

export function Chat(props: ChatProps) {
  const { lang, session, fmtDate, toast } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const ok = useContactCheck();
  const ref = session?.backend ? cloudRef(props) : null;
  const localKey = `chat.${props.bookingId !== undefined ? "b" + props.bookingId : "s" + props.sweetId}`;
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Anhang: Foto neu zeichnen (ohne Standortdaten), auf Kontaktdaten prüfen,
     direkt in den privaten Speicher laden, dann als Nachricht senden */
  async function attach(file: File | undefined) {
    if (!file || !ref || busy) return;
    if (file.size > 10 * 1024 * 1024) return toast(C.tooBig);
    setBusy(true);
    setNote(C.checking);
    try {
      let blob: Blob = file;
      let mime = file.type;
      if (file.type.startsWith("image/")) {
        const { cleanImage } = await import("@/showly/media");
        blob = await cleanImage(file);
        mime = blob.type || "image/jpeg";
        const { checkMedia, mediaCheckMessage } = await import("@/showly/mediaCheck");
        const chk = await checkMedia(Object.assign(blob, { type: mime }) as Blob & { type: string });
        if (!chk.ok) return toast(mediaCheckMessage(chk, file.name, lang));
      }
      const up = await chatUploadUrl({ data: { ref, mime, bytes: blob.size } });
      if ("error" in up) return toast(up.error);
      const { supabase } = await import("@/lib/supabase");
      const put = await supabase().storage.from("chat").uploadToSignedUrl(up.path, up.token, blob, { contentType: mime });
      if (put.error) return toast(C.failed);
      const r = await sendMessage({ data: { ref, body: text.trim(), attachment: { path: up.path, name: file.name } } });
      if ("error" in r) return toast(r.error || C.failed);
      setText("");
      await load();
    } catch {
      toast(C.failed);
    } finally {
      setBusy(false);
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const load = async () => {
    if (ref) {
      const r = await listMessages({ data: { ref } }).catch(() => null);
      if (r && "messages" in r) setMsgs(r.messages);
      return;
    }
    const local = loadJSON<LocalMsg[]>(localKey, []);
    setMsgs(
      local.map((m) => ({
        id: m.id,
        sender_role: m.role,
        body: m.body,
        created_at: m.at,
        read_at: null,
        mine: m.role === props.as,
      })),
    );
  };

  useEffect(() => {
    void load();
    if (!ref) return;
    const iv = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey, ref && JSON.stringify(ref)]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    if (!ok(body)) return;
    setBusy(true);
    try {
      if (ref) {
        const r = await sendMessage({ data: { ref, body } });
        if ("error" in r) return toast(r.error || C.failed);
      } else {
        const local = loadJSON<LocalMsg[]>(localKey, []);
        saveJSON(localKey, [...local, { id: Date.now(), role: props.as, body: body.slice(0, 2000), at: new Date().toISOString() }]);
      }
      setText("");
      await load();
    } catch {
      toast(C.failed);
    } finally {
      setBusy(false);
    }
  }

  const who = (m: ChatMessage) =>
    m.mine ? C.you : m.sender_role === "admin" ? C.admin : m.sender_role === "customer" ? C.customer : C.provider;

  return (
    <div className="modal-overlay chat26-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="chat26" role="dialog" aria-modal="true" aria-label={C.title}>
        <div className="chat26-head">
          <span className="chat26-ic">
            <Icon name="comment" />
          </span>
          <div>
            <h3>{C.title}</h3>
            <p>{props.heading}</p>
          </div>
          <button type="button" className="modal-close" onClick={props.onClose} aria-label={C.close}>
            ✕
          </button>
        </div>
        <div className="chat26-list" ref={listRef}>
          {msgs.length === 0 && <p className="chat26-empty">{C.empty}</p>}
          {msgs.map((m) => (
            <div key={m.id} className={"chat26-msg" + (m.mine ? " mine" : "") + (m.sender_role === "admin" ? " admin" : "")}>
              <small>
                {who(m)} · {fmtDate(m.created_at)}{" "}
                {new Date(m.created_at).toLocaleTimeString(lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {m.mine && m.read_at ? ` · ${C.read}` : ""}
              </small>
              {m.attachment?.url && m.attachment.mime.startsWith("image/") ? (
                <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="chat26-img">
                  <img src={m.attachment.url} alt={m.attachment.name} loading="lazy" />
                </a>
              ) : m.attachment?.url ? (
                <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="chat26-file">
                  <Icon name="clipboard" /> {m.attachment.name} · {Math.max(1, Math.round(m.attachment.bytes / 1024))} KB
                </a>
              ) : null}
              {(!m.attachment || m.body !== m.attachment.name) && <p>{m.body}</p>}
            </div>
          ))}
        </div>
        <div className="chat26-foot">
          <p className="chat26-rule">
            {ref ? C.rule : C.practice}
            {ref && <span className="chat26-why"> {C.why}</span>}
          </p>
          {note && <p className="chat26-rule" role="status">{note}</p>}
          <ContactHint text={text} />
          <div className="chat26-input">
            <textarea
              value={text}
              rows={2}
              maxLength={2000}
              placeholder={C.ph}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {ref && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  hidden
                  onChange={(e) => void attach(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="chat26-attach"
                  aria-label={C.attach}
                  title={C.attach}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="image" />
                </button>
              </>
            )}
            <button type="button" className="home-btn primary" disabled={busy || !text.trim()} onClick={() => void send()}>
              {C.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ungelesene Nachrichten je Buchung/Anfrage (nur mit Datenbank), alle 30 s */
export function useUnread(): { bookings: Record<number, number>; sweets: Record<number, number> } {
  const { session } = useShowly();
  const [c, setC] = useState<{ bookings: Record<number, number>; sweets: Record<number, number> }>({
    bookings: {},
    sweets: {},
  });
  useEffect(() => {
    if (!session?.backend) return;
    const load = () =>
      void unreadCounts()
        .then(setC)
        .catch(() => undefined);
    load();
    const iv = window.setInterval(load, 30000);
    return () => window.clearInterval(iv);
  }, [session?.backend]);
  return c;
}

/** Anzahl ungelesener Nachrichten zu einer Buchung (App-Kennung) */
export function unreadFor(u: ReturnType<typeof useUnread>, bookingId: number): number {
  const id = dbIdOf(bookingId);
  return id === null ? 0 : u.bookings[id] || 0;
}
