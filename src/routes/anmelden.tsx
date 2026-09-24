/* Anmeldung über Google, eigene E-Mail-Adresse oder Telefonnummer.
 *
 * Es gibt bewusst kein Passwortfeld mehr. Alle drei Wege laufen ohne
 * gespeichertes Passwort: Google bestätigt selbst, E-Mail und Telefon
 * bekommen einen Einmalcode. Damit entfällt die größte Schwachstelle der
 * bisherigen Lösung, nämlich im Browser abgelegte Passwörter.
 *
 * Die Sitzung landet danach in einem Cookie, das JavaScript nicht lesen kann. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { seoHead } from "@/showly/seo";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { authRedirectTo, isBackendConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/anmelden")({
  head: () => seoHead("/anmelden", "/anmelden"),
  component: SignInPage,
});

const COPY = {
  de: {
    eyebrow: "Anmelden",
    h1: "Willkommen bei Showly",
    sub: "Melde dich an, um zu buchen, zu bewerten und Beiträge zu schreiben. Ein Passwort brauchst du nicht.",
    google: "Mit Google anmelden",
    apple: "Mit Apple anmelden",
    or: "oder",
    tabMail: "E-Mail",
    tabPhone: "Telefon",
    mail: "Deine E-Mail-Adresse",
    mailPh: "name@beispiel.de",
    phone: "Deine Handynummer",
    phonePh: "+49 151 23456789",
    send: "Code anfordern",
    codeH: "Code eingeben",
    codeP: "Wir haben dir einen sechsstelligen Code geschickt an",
    code: "Code",
    verify: "Anmelden",
    again: "Andere Adresse verwenden",
    hint: "Der Code gilt zehn Minuten.",
    errMail: "Bitte eine gültige E-Mail-Adresse eingeben.",
    errPhone: "Bitte eine Handynummer mit Landesvorwahl eingeben, etwa +49 …",
    errCode: "Der Code stimmt nicht oder ist abgelaufen.",
    ok: "Angemeldet. Schön, dass du da bist.",
    offH: "Die Datenbank ist noch nicht verbunden",
    offP: "Sobald die Zugangsdaten für Supabase hinterlegt sind, funktioniert diese Seite. Bis dahin läuft Showly im örtlichen Übungsbetrieb weiter.",
    privacy:
      "Mit der Anmeldung stimmst du zu, dass wir deine Adresse zur Bestätigung nutzen. Mehr dazu in der Datenschutzerklärung.",
  },
  en: {
    eyebrow: "Sign in",
    h1: "Welcome to Showly",
    sub: "Sign in to book, review and post. You do not need a password.",
    google: "Continue with Google",
    apple: "Continue with Apple",
    or: "or",
    tabMail: "Email",
    tabPhone: "Phone",
    mail: "Your email address",
    mailPh: "name@example.com",
    phone: "Your mobile number",
    phonePh: "+49 151 23456789",
    send: "Send me a code",
    codeH: "Enter the code",
    codeP: "We sent a six-digit code to",
    code: "Code",
    verify: "Sign in",
    again: "Use a different address",
    hint: "The code is valid for ten minutes.",
    errMail: "Please enter a valid email address.",
    errPhone: "Please enter a mobile number with country code, e.g. +49 …",
    errCode: "That code is wrong or expired.",
    ok: "Signed in. Good to have you.",
    offH: "The database is not connected yet",
    offP: "This page works as soon as the Supabase keys are in place. Until then Showly keeps running in local practice mode.",
    privacy:
      "By signing in you agree that we use your address for confirmation. See the privacy notice for details.",
  },
  es: {
    eyebrow: "Entrar",
    h1: "Bienvenida a Showly",
    sub: "Entra para reservar, reseñar y publicar. No necesitas contraseña.",
    google: "Continuar con Google",
    apple: "Continuar con Apple",
    or: "o",
    tabMail: "Correo",
    tabPhone: "Teléfono",
    mail: "Tu correo",
    mailPh: "nombre@ejemplo.es",
    phone: "Tu móvil",
    phonePh: "+34 600 123456",
    send: "Enviar código",
    codeH: "Introduce el código",
    codeP: "Hemos enviado un código de seis cifras a",
    code: "Código",
    verify: "Entrar",
    again: "Usar otra dirección",
    hint: "El código vale diez minutos.",
    errMail: "Introduce un correo válido.",
    errPhone: "Introduce un móvil con prefijo, p. ej. +34 …",
    errCode: "El código no es correcto o ha caducado.",
    ok: "Sesión iniciada. Qué bien tenerte aquí.",
    offH: "La base de datos aún no está conectada",
    offP: "Esta página funciona en cuanto estén las claves de Supabase. Mientras tanto Showly sigue en modo local.",
    privacy:
      "Al entrar aceptas que usemos tu dirección para la confirmación. Más en el aviso de privacidad.",
  },
} as const;

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+[1-9]\d{7,14}$/;

function SignInPage() {
  const { lang, toast } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();

  const [mode, setMode] = useState<"mail" | "phone">("mail");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!isBackendConfigured()) {
    return (
      <div className="page active konto-page">
        <div className="konto-wrap">
          <div className="konto-card">
            <div className="eyebrow violet">{T.eyebrow}</div>
            <h1 className="konto-h1">{T.offH}</h1>
            <p className="konto-sub">{T.offP}</p>
            <button className="btn-primary" onClick={() => navigate({ to: "/konto" })}>
              {T.eyebrow}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* Apple verlangt in Apps mit Google-Anmeldung eine gleichwertige
     datenschutzfreundliche Alternative (Richtlinie 4.8); "Mit Apple anmelden"
     erfüllt das. Einrichtung siehe EINRICHTUNG.md, Abschnitt Apple. */
  async function withProvider(provider: "google" | "apple") {
    setErr("");
    setBusy(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectTo("/dashboard") },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  }

  async function sendCode() {
    setErr("");
    const value = target.trim();
    if (mode === "mail" && !MAIL.test(value)) return setErr(T.errMail);
    if (mode === "phone" && !PHONE.test(value.replace(/[\s/-]/g, ""))) return setErr(T.errPhone);

    setBusy(true);
    const sb = supabase();
    const { error } =
      mode === "mail"
        ? await sb.auth.signInWithOtp({
            email: value,
            options: { emailRedirectTo: authRedirectTo("/dashboard") },
          })
        : await sb.auth.signInWithOtp({ phone: value.replace(/[\s/-]/g, "") });

    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  }

  async function verify() {
    setErr("");
    setBusy(true);
    const value = target.trim();
    const { error } = await supabase().auth.verifyOtp(
      mode === "mail"
        ? { email: value, token: code.trim(), type: "email" }
        : { phone: value.replace(/[\s/-]/g, ""), token: code.trim(), type: "sms" },
    );
    setBusy(false);
    if (error) return setErr(T.errCode);
    toast(T.ok);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="page active konto-page">
      <div className="konto-wrap">
        <div className="konto-card">
          <div className="eyebrow violet">{T.eyebrow}</div>
          <h1 className="konto-h1">{T.h1}</h1>
          <p className="konto-sub">{T.sub}</p>

          {!sent ? (
            <>
              <button className="btn-google btn-apple" onClick={() => void withProvider("apple")} disabled={busy}>
                <AppleMark /> {T.apple}
              </button>
              <button className="btn-google" onClick={() => void withProvider("google")} disabled={busy}>
                <GoogleMark /> {T.google}
              </button>

              <div className="auth-or">
                <span>{T.or}</span>
              </div>

              <div className="konto-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === "mail"}
                  className={"konto-tab" + (mode === "mail" ? " on" : "")}
                  onClick={() => {
                    setMode("mail");
                    setErr("");
                  }}
                >
                  {T.tabMail}
                </button>
                <button
                  role="tab"
                  aria-selected={mode === "phone"}
                  className={"konto-tab" + (mode === "phone" ? " on" : "")}
                  onClick={() => {
                    setMode("phone");
                    setErr("");
                  }}
                >
                  {T.tabPhone}
                </button>
              </div>

              <div className="input-group">
                <label htmlFor="auth-target">{mode === "mail" ? T.mail : T.phone}</label>
                <input
                  id="auth-target"
                  type={mode === "mail" ? "email" : "tel"}
                  inputMode={mode === "mail" ? "email" : "tel"}
                  autoComplete={mode === "mail" ? "email" : "tel"}
                  value={target}
                  placeholder={mode === "mail" ? T.mailPh : T.phonePh}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendCode()}
                />
              </div>

              {err && <p className="picker-err">{err}</p>}

              <button className="btn-primary konto-go" onClick={() => void sendCode()} disabled={busy}>
                {T.send}
              </button>
            </>
          ) : (
            <>
              <h2 className="auth-code-h">{T.codeH}</h2>
              <p className="konto-sub">
                {T.codeP} <strong>{target}</strong>
              </p>
              <div className="input-group">
                <label htmlFor="auth-code">{T.code}</label>
                <input
                  id="auth-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  className="auth-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && void verify()}
                />
              </div>
              {err && <p className="picker-err">{err}</p>}
              <button className="btn-primary konto-go" onClick={() => void verify()} disabled={busy}>
                {T.verify}
              </button>
              <p className="konto-small">{T.hint}</p>
              <button
                className="konto-link auth-again"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setErr("");
                }}
              >
                {T.again}
              </button>
            </>
          )}

          <p className="konto-note">
            <Icon name="shield" /> {T.privacy}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* Das Google-Zeichen in den Originalfarben, wie es die Markenvorgaben verlangen. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
      <path d="M16.9 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4 0-.1-2.3-.9-2.3-3.3Z" />
      <path d="M14.8 6.2c.6-.7 1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.6 2.7-1.4Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
