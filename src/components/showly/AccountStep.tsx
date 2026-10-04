/* Konto anlegen direkt im Anmeldeformular: per Handynummer oder E-Mail.
 *
 * Wer sich als Künstler, Planer, Torten- oder Deko-Anbieter registriert und
 * noch kein Konto hat, landet nicht mehr auf einer fremden Seite, sondern
 * bestätigt hier mit einem Einmal-Code. Per SMS braucht es keine E-Mail und
 * kein Passwort. Ist der Code richtig, ist die Person angemeldet; die vorher
 * gemerkte Registrierung legt der Store danach an (pendingArtist,
 * pendingBaker), oder onDone erledigt den Rest.
 *
 * Voraussetzung für SMS: ein SMS-Dienst in der Datenbank (EINRICHTUNG.md,
 * Abschnitt 4). Fehlt er, meldet der Server einen Fehler und die Person kann
 * auf E-Mail ausweichen. */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { useEscape } from "@/showly/useEscape";
import { authRedirectTo, supabase } from "@/lib/supabase";
import { normalizePhone, prettyPhone } from "@/showly/phone";

const COPY = {
  de: {
    h: "Konto anlegen",
    p: "Zum Schluss bestätigst du dein Konto. Am schnellsten geht es mit deiner Handynummer: Du bekommst einen Code per SMS, ganz ohne Passwort.",
    tabPhone: "Handynummer",
    tabMail: "E-Mail",
    phone: "Deine Handynummer",
    phonePh: "0151 23456789",
    mail: "Deine E-Mail-Adresse",
    mailPh: "name@beispiel.de",
    send: "Code senden",
    codeH: "Code eingeben",
    codeP: (to: string) => `Wir haben einen 6-stelligen Code an ${to} geschickt.`,
    code: "Code",
    verify: "Bestätigen",
    back: "Andere Nummer oder Adresse",
    resend: "Code erneut senden",
    other: "Lieber mit Google oder Apple?",
    otherLink: "Zur Anmeldung",
    errPhone: "Bitte eine gültige Handynummer eingeben, etwa 0151 23456789 oder +49 151 23456789.",
    errMail: "Bitte eine gültige E-Mail-Adresse eingeben.",
    errCode: "Der Code stimmt nicht oder ist abgelaufen.",
    errSms: "Die SMS konnte nicht verschickt werden. Versuch es später noch einmal oder nimm deine E-Mail-Adresse.",
    note: "Eine Nummer gehört zu genau einem Konto. Wir nutzen sie nur für die Anmeldung und Hinweise zu deinen Buchungen, nie für Werbung.",
    busy: "Einen Moment …",
    close: "Schließen",
  },
  en: {
    h: "Create your account",
    p: "Finally, confirm your account. The quickest way is your mobile number: you get a code by text message, no password needed.",
    tabPhone: "Mobile number",
    tabMail: "Email",
    phone: "Your mobile number",
    phonePh: "+49 151 23456789",
    mail: "Your email address",
    mailPh: "name@example.com",
    send: "Send code",
    codeH: "Enter code",
    codeP: (to: string) => `We sent a 6-digit code to ${to}.`,
    code: "Code",
    verify: "Confirm",
    back: "Use a different number or address",
    resend: "Send code again",
    other: "Prefer Google or Apple?",
    otherLink: "Go to sign-in",
    errPhone: "Please enter a valid mobile number, e.g. +49 151 23456789.",
    errMail: "Please enter a valid email address.",
    errCode: "The code is wrong or has expired.",
    errSms: "The text message could not be sent. Try again later or use your email address.",
    note: "One number belongs to exactly one account. We only use it for sign-in and notes about your bookings, never for advertising.",
    busy: "One moment …",
    close: "Close",
  },
  es: {
    h: "Crear cuenta",
    p: "Para terminar, confirma tu cuenta. Lo más rápido es con tu móvil: recibes un código por SMS, sin contraseña.",
    tabPhone: "Móvil",
    tabMail: "Correo",
    phone: "Tu número de móvil",
    phonePh: "600 123 456",
    mail: "Tu correo electrónico",
    mailPh: "nombre@ejemplo.es",
    send: "Enviar código",
    codeH: "Introduce el código",
    codeP: (to: string) => `Hemos enviado un código de 6 cifras a ${to}.`,
    code: "Código",
    verify: "Confirmar",
    back: "Usar otro número o correo",
    resend: "Reenviar código",
    other: "¿Prefieres Google o Apple?",
    otherLink: "Ir al inicio de sesión",
    errPhone: "Introduce un móvil válido, p. ej. 600 123 456 o +34 600 123 456.",
    errMail: "Introduce un correo válido.",
    errCode: "El código no es correcto o ha caducado.",
    errSms: "No se pudo enviar el SMS. Inténtalo más tarde o usa tu correo.",
    note: "Un número pertenece a una sola cuenta. Solo lo usamos para iniciar sesión y avisos sobre tus reservas, nunca para publicidad.",
    busy: "Un momento …",
    close: "Cerrar",
  },
} as const;

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AccountStep({
  onClose,
  onDone,
  next = "/dashboard",
}: {
  onClose: () => void;
  /** Läuft, sobald die Person angemeldet ist */
  onDone: () => void;
  /** Wohin der Link aus der E-Mail führt */
  next?: string;
}) {
  const { lang } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [mode, setMode] = useState<"phone" | "mail">("phone");
  const [target, setTarget] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEscape(true, onClose);

  async function send() {
    setErr("");
    const sb = supabase();
    if (mode === "phone") {
      const phone = normalizePhone(target, lang);
      if (!phone) return setErr(T.errPhone);
      setBusy(true);
      const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
      setBusy(false);
      if (error) return setErr(T.errSms);
      setSentTo(phone);
    } else {
      const email = target.trim().toLowerCase();
      if (!MAIL.test(email)) return setErr(T.errMail);
      setBusy(true);
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: authRedirectTo(next) },
      });
      setBusy(false);
      if (error) return setErr(error.message);
      setSentTo(email);
    }
  }

  async function verify() {
    setErr("");
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setErr(T.errCode);
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp(
      mode === "phone" ? { phone: sentTo, token, type: "sms" } : { email: sentTo, token, type: "email" },
    );
    setBusy(false);
    if (error) return setErr(T.errCode);
    onDone();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="acct-step" role="dialog" aria-modal="true" aria-labelledby="acct-h">
        <button type="button" className="acct-x" onClick={onClose} aria-label={T.close}>
          <Icon name="close" />
        </button>
        {!sentTo ? (
          <>
            <h2 id="acct-h">{T.h}</h2>
            <p className="acct-p">{T.p}</p>
            <div className="konto-tabs" role="tablist">
              {(["phone", "mail"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className={"konto-tab" + (mode === m ? " on" : "")}
                  onClick={() => {
                    setMode(m);
                    setTarget("");
                    setErr("");
                  }}
                >
                  {m === "phone" ? T.tabPhone : T.tabMail}
                </button>
              ))}
            </div>
            <div className="input-group">
              <label htmlFor="acct-target">{mode === "phone" ? T.phone : T.mail}</label>
              <input
                id="acct-target"
                type={mode === "phone" ? "tel" : "email"}
                inputMode={mode === "phone" ? "tel" : "email"}
                autoComplete={mode === "phone" ? "tel" : "email"}
                placeholder={mode === "phone" ? T.phonePh : T.mailPh}
                value={target}
                autoFocus
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
              />
            </div>
            {err && (
              <p className="picker-err" role="alert">
                {err}
              </p>
            )}
            <button type="button" className="btn-primary acct-go" disabled={busy} onClick={() => void send()}>
              {busy ? T.busy : T.send}
            </button>
            <p className="acct-small">
              {T.other}{" "}
              <Link to="/anmelden" className="konto-link">
                {T.otherLink}
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 id="acct-h">{T.codeH}</h2>
            <p className="acct-p">{T.codeP(mode === "phone" ? prettyPhone(sentTo) : sentTo)}</p>
            <div className="input-group">
              <label htmlFor="acct-code">{T.code}</label>
              <input
                id="acct-code"
                className="acct-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                autoFocus
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void verify()}
              />
            </div>
            {err && (
              <p className="picker-err" role="alert">
                {err}
              </p>
            )}
            <button type="button" className="btn-primary acct-go" disabled={busy} onClick={() => void verify()}>
              {busy ? T.busy : T.verify}
            </button>
            <div className="acct-row">
              <button
                type="button"
                className="konto-link"
                onClick={() => {
                  setSentTo("");
                  setCode("");
                  setErr("");
                }}
              >
                {T.back}
              </button>
              <button type="button" className="konto-link" disabled={busy} onClick={() => void send()}>
                {T.resend}
              </button>
            </div>
          </>
        )}
        <p className="acct-note">
          <Icon name="lock" /> {T.note}
        </p>
      </div>
    </div>,
    document.body,
  );
}
