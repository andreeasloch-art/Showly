/* Bewertungen, die Gäste selbst schreiben – mit Fotos vom Event. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import type { MediaRef } from "@/showly/media";
import {
  addReview,
  removeReview,
  reviewsSnapshot,
  subscribe,
  type UserReview,
} from "@/showly/community";
import { MediaPicker } from "./MediaPicker";
import { MediaGrid } from "./MediaView";
import { ReportMenu, useModeration } from "./ReportMenu";
import { isHidden } from "@/showly/moderation";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";

const EMPTY: UserReview[] = [];

const TEXT = {
  de: {
    h: "Deine Bewertung",
    p: "Warst du bei einem Auftritt dabei? Schreib, wie es war, und häng Fotos vom Event an.",
    name: "Dein Name",
    namePh: "Wie sollen wir dich nennen?",
    text: "Deine Erfahrung",
    textPh: "Was hat den Auftritt ausgemacht?",
    stars: "Sterne",
    when: "Datum des Events",
    send: "Bewertung veröffentlichen",
    needText: "Bitte schreib ein paar Sätze zum Auftritt.",
    needName: "Bitte trag einen Namen ein.",
    thanks: "Danke für deine Bewertung.",
    del: "Löschen",
    own: "Von dir",
    at: "Event am",
    photos: "Fotos vom Event",
  },
  en: {
    h: "Your review",
    p: "Were you at a show? Tell others how it went and attach photos from the event.",
    name: "Your name",
    namePh: "What should we call you?",
    text: "Your experience",
    textPh: "What made the performance special?",
    stars: "Stars",
    when: "Date of the event",
    send: "Publish review",
    needText: "Please write a few sentences about the show.",
    needName: "Please enter a name.",
    thanks: "Thanks for your review.",
    del: "Delete",
    own: "By you",
    at: "Event on",
    photos: "Photos from the event",
  },
  es: {
    h: "Tu reseña",
    p: "¿Estuviste en una actuación? Cuenta cómo fue y añade fotos del evento.",
    name: "Tu nombre",
    namePh: "¿Cómo te llamamos?",
    text: "Tu experiencia",
    textPh: "¿Qué hizo especial la actuación?",
    stars: "Estrellas",
    when: "Fecha del evento",
    send: "Publicar reseña",
    needText: "Escribe unas frases sobre la actuación.",
    needName: "Introduce un nombre.",
    thanks: "Gracias por tu reseña.",
    del: "Borrar",
    own: "Tuya",
    at: "Evento el",
    photos: "Fotos del evento",
  },
} as const;

function useUserReviews(artistId: number) {
  const all = useSyncExternalStore(subscribe, reviewsSnapshot, () => EMPTY);
  return all.filter((r) => r.artistId === artistId);
}

function niceDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function UserReviewList({ artistId }: { artistId: number }) {
  const { lang, session } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const mod = useModeration();
  const list = useUserReviews(artistId).filter((r) => !isHidden(mod, "review", r.id, r.author));
  /* Löschen darf nur, wer die Bewertung geschrieben hat. Vorher stand der
     Knopf unter jeder Bewertung, auch der Künstler hätte sie entfernen können. */
  const mine = (r: { author: string }) =>
    !!session && r.author.trim().toLowerCase() === session.name.trim().toLowerCase();
  if (!list.length) return null;

  return (
    <div className="rev-list">
      {list.map((r) => (
        <div className="review-card review-own" key={r.id}>
          <div className="rev-head">
            <div className="rev-avatar">
              <Icon name="user" />
            </div>
            <div>
              <div className="rev-name">{r.author}</div>
              <div className="rev-date">
                {niceDate(r.dateISO, lang)}
                {r.eventDate ? ` · ${T.at} ${niceDate(r.eventDate, lang)}` : ""}
              </div>
            </div>
            <div className="rev-mark">{"★".repeat(r.rating)}</div>
            {!mine(r) && <ReportMenu target="review" id={r.id} author={r.author} className="small" />}
          </div>
          <p className="rev-text">{r.text}</p>
          {r.media.length > 0 && (
            <>
              <div className="rev-photos-h">
                <Icon name="image" /> {T.photos}
              </div>
              <MediaGrid items={r.media} />
            </>
          )}
          {mine(r) && (
            <button className="rev-del" onClick={() => removeReview(r.id)}>
              <Icon name="trash" /> {T.del}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReviewComposer({ artistId }: { artistId: number }) {
  const okText = useContactCheck();
  const { lang, session, toast } = useShowly();
  const L = (lang as "de" | "en" | "es") ?? "de";
  const T = TEXT[L] ?? TEXT.de;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session?.name ?? "");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [err, setErr] = useState("");

  /* Das Konto steht erst nach dem ersten Rendern bereit. */
  useEffect(() => {
    if (session?.name) setName((n) => n || session.name);
  }, [session?.name]);

  function send() {
    if (!name.trim()) return setErr(T.needName);
    if (text.trim().length < 12) return setErr(T.needText);
    if (!okText(name, text)) return;
    addReview({
      artistId,
      author: name.trim(),
      rating,
      text: text.trim(),
      media,
      ...(when ? { eventDate: when } : {}),
    });
    setText("");
    setMedia([]);
    setWhen("");
    setErr("");
    setOpen(false);
    toast(T.thanks);
  }

  if (!open) {
    return (
      <button className="rev-open" onClick={() => setOpen(true)}>
        <Icon name="camera" /> {T.h}
      </button>
    );
  }

  return (
    <div className="rev-form">
      <h3 className="rev-form-h">{T.h}</h3>
      <p className="rev-form-p">{T.p}</p>

      <div className="rev-stars-pick" role="group" aria-label={T.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={"rev-star" + (n <= rating ? " on" : "")}
            onClick={() => setRating(n)}
            aria-label={`${n} ${T.stars}`}
            aria-pressed={n === rating}
          >
            ★
          </button>
        ))}
      </div>

      <div className="two-col">
        <div className="input-group">
          <label htmlFor="rev-name">{T.name}</label>
          <input
            id="rev-name"
            value={name}
            placeholder={T.namePh}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="rev-when">{T.when}</label>
          <input id="rev-when" type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="rev-text">{T.text}</label>
        <textarea
          id="rev-text"
          rows={4}
          value={text}
          placeholder={T.textPh}
          onChange={(e) => setText(e.target.value)}
        />
        <ContactHint text={text} />
      </div>

      <MediaPicker value={media} onChange={setMedia} lang={L} />

      {err && <p className="picker-err">{err}</p>}

      <div className="rev-form-foot">
        <button className="btn-primary" onClick={send}>
          {T.send}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </div>
  );
}
