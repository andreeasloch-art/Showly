/* Passwort vergessen: E-Mail-Adresse eingeben, Link per E-Mail bekommen.
 *
 * Die Antwort ist immer dieselbe, ob es zur Adresse ein Konto gibt oder
 * nicht. Sonst könnte jeder ausprobieren, welche Adressen bei Showly
 * registriert sind. Nach einer Anfrage bleibt der Knopf 60 Sekunden gesperrt;
 * Supabase begrenzt die Zahl der Mails zusätzlich auf dem Server.
 *
 * Mit Datenbank verschickt Supabase die E-Mail. Der Link führt über
 * /auth/rueckkehr zu /passwort-neu. Im Übungsbetrieb gibt es keinen
 * Mailversand; dort zeigt die Seite die E-Mail direkt an. */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { authRedirectTo, isBackendConfigured, supabase } from "@/lib/supabase";
import { createLocalReset, type LocalReset } from "@/showly/persist";

export const Route = createFileRoute("/passwort-vergessen")({
  head: () => ({
    meta: [{ title: "Passwort vergessen | Showly" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPage,
});

const COPY = {
  de: {
    eyebrow: "Passwort vergessen",
    h1: "Neues Passwort festlegen",
    sub: "Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.",
    mail: "E-Mail-Adresse",
    mailPh: "name@beispiel.de",
    send: "Link zuschicken",
    wait: "Neuer Versuch in {s} s",
    errMail: "Bitte eine gültige E-Mail-Adresse eingeben.",
    errServer: "Das hat gerade nicht geklappt. Bitte versuche es in ein paar Minuten noch einmal.",
    sentH: "Schau in dein Postfach",
    sentP: "Wenn es zu {m} ein Konto gibt, ist eine E-Mail mit einem Link unterwegs. Der Link gilt eine Stunde und funktioniert nur einmal.",
    spam: "Nichts angekommen? Schau im Spam-Ordner nach oder fordere den Link in einer Minute noch einmal an.",
    again: "Andere Adresse eingeben",
    back: "Zurück zur Anmeldung",
    code: "Du kannst dich auch ohne Passwort anmelden: mit einem Code per E-Mail.",
    demoH: "Übungsbetrieb: So sieht die E-Mail aus",
    demoNone: "Übungsbetrieb: Zu dieser Adresse gibt es auf diesem Gerät kein Konto. Im echten Betrieb bekäme niemand eine E-Mail.",
    demoNote: "Solange keine Datenbank verbunden ist, verschickt Showly keine E-Mails. Die Vorschau zeigt sie deshalb hier.",
    mailSubject: "Dein neues Passwort für Showly",
    mailHi: "Hallo,",
    mailBody: "jemand (hoffentlich du) möchte das Passwort für dein Showly-Konto zurücksetzen. Mit dem Knopf legst du ein neues fest.",
    mailBtn: "Neues Passwort festlegen",
    mailIgnore: "Warst du das nicht? Dann ignoriere diese E-Mail. Dein Passwort bleibt, wie es ist.",
  },
  en: {
    eyebrow: "Forgot password",
    h1: "Set a new password",
    sub: "Enter the email address of your account. We will send you a link to set a new password.",
    mail: "Email address",
    mailPh: "name@example.com",
    send: "Send me the link",
    wait: "Try again in {s} s",
    errMail: "Please enter a valid email address.",
    errServer: "That did not work just now. Please try again in a few minutes.",
    sentH: "Check your inbox",
    sentP: "If there is an account for {m}, an email with a link is on its way. The link is valid for one hour and works only once.",
    spam: "Nothing arrived? Check your spam folder or request the link again in a minute.",
    again: "Use a different address",
    back: "Back to sign-in",
    code: "You can also sign in without a password, with a code by email.",
    demoH: "Practice mode: this is what the email looks like",
    demoNone: "Practice mode: there is no account for this address on this device. In live mode nobody would get an email.",
    demoNote: "As long as no database is connected, Showly sends no emails. The preview shows it here instead.",
    mailSubject: "Your new Showly password",
    mailHi: "Hello,",
    mailBody: "someone (hopefully you) wants to reset the password of your Showly account. Use the button to set a new one.",
    mailBtn: "Set new password",
    mailIgnore: "Wasn't you? Just ignore this email. Your password stays as it is.",
  },
  es: {
    eyebrow: "Contraseña olvidada",
    h1: "Nueva contraseña",
    sub: "Escribe el correo de tu cuenta. Te enviaremos un enlace para elegir una contraseña nueva.",
    mail: "Correo",
    mailPh: "nombre@ejemplo.es",
    send: "Enviar enlace",
    wait: "Nuevo intento en {s} s",
    errMail: "Introduce un correo válido.",
    errServer: "Ahora no ha funcionado. Inténtalo de nuevo en unos minutos.",
    sentH: "Mira tu bandeja de entrada",
    sentP: "Si existe una cuenta para {m}, te llegará un correo con un enlace. El enlace vale una hora y solo funciona una vez.",
    spam: "¿No ha llegado nada? Mira en spam o vuelve a pedir el enlace dentro de un minuto.",
    again: "Usar otro correo",
    back: "Volver a entrar",
    code: "También puedes entrar sin contraseña, con un código por correo.",
    demoH: "Modo de práctica: así se ve el correo",
    demoNone: "Modo de práctica: no hay ninguna cuenta con este correo en este dispositivo. En el modo real nadie recibiría un correo.",
    demoNote: "Mientras no haya base de datos, Showly no envía correos. La vista previa lo muestra aquí.",
    mailSubject: "Tu nueva contraseña de Showly",
    mailHi: "Hola:",
    mailBody: "alguien (esperamos que tú) quiere restablecer la contraseña de tu cuenta de Showly. Con el botón eliges una nueva.",
    mailBtn: "Elegir contraseña nueva",
    mailIgnore: "¿No has sido tú? Ignora este correo. Tu contraseña no cambia.",
  },
} as const;

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOLDOWN = 60;

function ForgotPage() {
  const { lang } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const cloud = isBackendConfigured();

  const [mail, setMail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);
  const [demo, setDemo] = useState<LocalReset | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send() {
    setErr("");
    const value = mail.trim();
    if (!MAIL.test(value)) return setErr(T.errMail);
    if (left > 0) return;
    setBusy(true);
    if (cloud) {
      const { error } = await supabase().auth.resetPasswordForEmail(value, {
        redirectTo: authRedirectTo("/passwort-neu"),
      });
      /* Fehler wie "Konto unbekannt" verraten nichts nach außen. Nur wenn der
         Server gar nicht antwortet oder bremst, sagen wir es. */
      if (error && (error.status === 429 || (error.status ?? 500) >= 500)) {
        setBusy(false);
        return setErr(T.errServer);
      }
    } else {
      setDemo(createLocalReset(value));
    }
    setBusy(false);
    setSent(true);
    setLeft(COOLDOWN);
  }

  return (
    <div className="page active konto-page">
      <div className="konto-wrap">
        <div className="konto-card">
          <div className="eyebrow violet">{T.eyebrow}</div>
          {!sent ? (
            <>
              <h1 className="konto-h1">{T.h1}</h1>
              <p className="konto-sub">{T.sub}</p>
              <div className="input-group">
                <label htmlFor="pw-forgot-mail">{T.mail}</label>
                <input
                  id="pw-forgot-mail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={mail}
                  placeholder={T.mailPh}
                  onChange={(e) => setMail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void send()}
                />
              </div>
              {err && (
                <p className="picker-err" role="alert">
                  {err}
                </p>
              )}
              <button className="btn-primary konto-go" onClick={() => void send()} disabled={busy || left > 0}>
                {left > 0 ? T.wait.replace("{s}", String(left)) : T.send}
              </button>
              <p className="konto-small">{T.code}</p>
            </>
          ) : (
            <>
              <div className="pw-sent-ico" aria-hidden="true">
                <Icon name="send" />
              </div>
              <h1 className="konto-h1" role="status">
                {T.sentH}
              </h1>
              <p className="konto-sub">{T.sentP.replace("{m}", mail.trim())}</p>
              <p className="konto-small">{T.spam}</p>

              {!cloud &&
                (demo ? (
                  <div className="pw-demo-mail" aria-label={T.demoH}>
                    <div className="pw-demo-h">{T.demoH}</div>
                    <div className="pw-demo-body">
                      <div className="pw-demo-subj">{T.mailSubject}</div>
                      <p>{T.mailHi}</p>
                      <p>{T.mailBody}</p>
                      <Link to="/passwort-neu" search={{ t: demo.token }} className="btn-primary pw-demo-btn">
                        {T.mailBtn}
                      </Link>
                      <p className="pw-demo-small">{T.mailIgnore}</p>
                    </div>
                    <p className="pw-demo-note">{T.demoNote}</p>
                  </div>
                ) : (
                  <p className="pw-demo-none">{T.demoNone}</p>
                ))}

              <div className="konto-foot">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSent(false);
                    setDemo(null);
                  }}
                >
                  {T.again}
                </button>
              </div>
            </>
          )}
          <div className="konto-switch">
            <Link to={cloud ? "/anmelden" : "/konto"} className="konto-link">
              ← {T.back}
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
