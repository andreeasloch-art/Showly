/* Menü "•••" an Beiträgen, Kommentaren und Bewertungen: melden oder die
 * Person blockieren. Öffnet ein kleines Fenster statt confirm(), weil
 * Browser-Dialoge in der App-Hülle gesperrt sein können. */
import { useState, useSyncExternalStore } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  REPORT_REASONS,
  addReport,
  blockAuthor,
  moderationServerSnapshot,
  moderationSnapshot,
  subscribeModeration,
  type ReportReason,
  type ReportTarget,
} from "@/showly/moderation";
import { isBackendConfigured } from "@/lib/supabase";
import { reportContent } from "@/utils/account.functions";

const COPY = {
  de: {
    open: "Weitere Aktionen",
    report: "Melden",
    block: (n: string) => `${n} blockieren`,
    cancel: "Abbrechen",
    reportH: "Warum meldest du das?",
    reasons: {
      abuse: "Beleidigung, Hass oder Belästigung",
      spam: "Spam oder Werbung",
      false: "Falsche Angaben oder Betrug",
      explicit: "Nacktheit oder Gewalt",
      rights: "Verletzt meine Rechte (Foto, Urheberrecht, Privatsphäre)",
      other: "Etwas anderes",
    } as Record<ReportReason, string>,
    details: "Was genau ist das Problem? (freiwillig)",
    send: "Meldung senden",
    sent: "Danke! Wir prüfen die Meldung. Für dich ist der Inhalt ab sofort ausgeblendet.",
    blockH: (n: string) => `${n} blockieren?`,
    blockP: "Du siehst dann keine Beiträge, Kommentare und Bewertungen mehr von dieser Person. Aufheben kannst du das jederzeit in deinem Konto.",
    blockBtn: "Blockieren",
    blocked: (n: string) => `${n} ist blockiert.`,
  },
  en: {
    open: "More actions",
    report: "Report",
    block: (n: string) => `Block ${n}`,
    cancel: "Cancel",
    reportH: "Why are you reporting this?",
    reasons: {
      abuse: "Insults, hate or harassment",
      spam: "Spam or advertising",
      false: "False information or fraud",
      explicit: "Nudity or violence",
      rights: "Violates my rights (photo, copyright, privacy)",
      other: "Something else",
    } as Record<ReportReason, string>,
    details: "What exactly is the problem? (optional)",
    send: "Send report",
    sent: "Thanks! We'll review the report. The content is hidden for you from now on.",
    blockH: (n: string) => `Block ${n}?`,
    blockP: "You won't see posts, comments or reviews from this person any more. You can undo this in your account at any time.",
    blockBtn: "Block",
    blocked: (n: string) => `${n} is blocked.`,
  },
  es: {
    open: "Más acciones",
    report: "Denunciar",
    block: (n: string) => `Bloquear a ${n}`,
    cancel: "Cancelar",
    reportH: "¿Por qué lo denuncias?",
    reasons: {
      abuse: "Insultos, odio o acoso",
      spam: "Spam o publicidad",
      false: "Datos falsos o fraude",
      explicit: "Desnudos o violencia",
      rights: "Vulnera mis derechos (foto, derechos de autor, privacidad)",
      other: "Otra cosa",
    } as Record<ReportReason, string>,
    details: "¿Cuál es exactamente el problema? (opcional)",
    send: "Enviar denuncia",
    sent: "¡Gracias! Revisaremos la denuncia. El contenido queda oculto para ti desde ahora.",
    blockH: (n: string) => `¿Bloquear a ${n}?`,
    blockP: "Ya no verás publicaciones, comentarios ni reseñas de esta persona. Puedes deshacerlo en tu cuenta cuando quieras.",
    blockBtn: "Bloquear",
    blocked: (n: string) => `${n} está bloqueado.`,
  },
} as const;

export function useModeration() {
  return useSyncExternalStore(subscribeModeration, moderationSnapshot, moderationServerSnapshot);
}

export function ReportMenu({
  target,
  id,
  author,
  className,
}: {
  target: ReportTarget;
  id: string;
  author?: string;
  className?: string;
}) {
  const { lang, session, toast } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [step, setStep] = useState<"" | "menu" | "report" | "block">("");
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const isMe = !!author && !!session && author.trim().toLowerCase() === session.name.trim().toLowerCase();

  function close() {
    setStep("");
    setReason("");
    setDetails("");
  }

  function send() {
    if (!reason) return;
    addReport({ target, id, reason, ...(details.trim() ? { details: details.trim() } : {}), ...(author ? { author } : {}) });
    if (session?.backend && isBackendConfigured()) {
      void reportContent({ data: { target, id, reason, details: details.trim() } }).catch(() => {});
    }
    toast(C.sent);
    close();
  }

  return (
    <>
      <button
        type="button"
        className={"rm-btn" + (className ? " " + className : "")}
        aria-label={C.open}
        aria-haspopup="dialog"
        onClick={() => setStep("menu")}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {step && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal rm-sheet" role="dialog" aria-modal="true">
            {step === "menu" && (
              <div className="rm-list">
                <button type="button" className="rm-item danger" onClick={() => setStep("report")}>
                  <Icon name="shield" /> {C.report}
                </button>
                {author && !isMe && (
                  <button type="button" className="rm-item" onClick={() => setStep("block")}>
                    <Icon name="close" /> {C.block(author)}
                  </button>
                )}
                <button type="button" className="rm-item muted" onClick={close}>
                  {C.cancel}
                </button>
              </div>
            )}

            {step === "report" && (
              <div className="rm-form">
                <h3>{C.reportH}</h3>
                <div className="rm-reasons" role="radiogroup">
                  {REPORT_REASONS.map((r) => (
                    <label className={"rm-reason" + (reason === r ? " on" : "")} key={r}>
                      <input
                        type="radio"
                        name={"rm-" + id}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                      />
                      <span>{C.reasons[r]}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  id={"rm-details-" + id}
                  value={details}
                  maxLength={1000}
                  placeholder={C.details}
                  onChange={(e) => setDetails(e.target.value)}
                />
                <div className="rm-actions">
                  <button type="button" className="home-btn soft" onClick={close}>
                    {C.cancel}
                  </button>
                  <button type="button" className="rm-go" disabled={!reason} onClick={send}>
                    {C.send}
                  </button>
                </div>
              </div>
            )}

            {step === "block" && author && (
              <div className="rm-form">
                <h3>{C.blockH(author)}</h3>
                <p>{C.blockP}</p>
                <div className="rm-actions">
                  <button type="button" className="home-btn soft" onClick={close}>
                    {C.cancel}
                  </button>
                  <button
                    type="button"
                    className="rm-go"
                    onClick={() => {
                      blockAuthor(author);
                      toast(C.blocked(author));
                      close();
                    }}
                  >
                    {C.blockBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
