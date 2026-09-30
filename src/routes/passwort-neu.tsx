/* Neues Passwort festlegen.
 *
 * Hierher führt der Link aus der E-Mail "Passwort vergessen". Mit Datenbank
 * hat /auth/rueckkehr den Code aus dem Link schon gegen eine kurzlebige
 * Sitzung getauscht; mit ihr darf genau dieses Konto sein Passwort ändern.
 * Angemeldete Nutzer können die Seite auch direkt aufrufen, um ihr Passwort
 * zu ändern oder erstmals eines festzulegen.
 *
 * Im Übungsbetrieb trägt der Link einen Einmal-Schlüssel (?t=…), der nach
 * 30 Minuten oder nach dem Einlösen verfällt. */
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { readLocalReset, redeemLocalReset } from "@/showly/persist";
import { pwScore } from "@/showly/figures";

export const Route = createFileRoute("/passwort-neu")({
  validateSearch: (s: Record<string, unknown>) => ({
    t: typeof s["t"] === "string" ? s["t"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Neues Passwort | Showly" }, { name: "robots", content: "noindex" }],
  }),
  component: NewPasswordPage,
});

const COPY = {
  de: {
    eyebrow: "Neues Passwort",
    h1: "Wähle ein neues Passwort",
    sub: "Mindestens 8 Zeichen. Am sichersten ist ein langer Satz, den du sonst nirgends verwendest.",
    for: "Für das Konto",
    pw: "Neues Passwort",
    pw2: "Passwort wiederholen",
    show: "Passwort anzeigen",
    hide: "Passwort verbergen",
    strength: "Passwortstärke",
    save: "Passwort speichern",
    errPw: "Das Passwort braucht mindestens 8 Zeichen.",
    errWeak: "Dieses Passwort ist zu leicht zu erraten. Nimm bitte ein längeres.",
    errPw2: "Die beiden Passwörter stimmen nicht überein.",
    errSame: "Das neue Passwort muss sich vom alten unterscheiden.",
    errServer: "Das Passwort konnte nicht gespeichert werden. Fordere bitte einen neuen Link an.",
    check: "Link wird geprüft …",
    badH: "Der Link ist abgelaufen",
    badP: "Links zum Zurücksetzen gelten nur kurz und funktionieren nur einmal. Fordere einfach einen neuen an.",
    newLink: "Neuen Link anfordern",
    ok: "Dein Passwort ist geändert.",
    okH: "Passwort gespeichert",
    okP: "Ab jetzt meldest du dich mit dem neuen Passwort an. Aus Sicherheitsgründen haben wir dich auf anderen Geräten abgemeldet.",
    toDash: "Weiter zu meinen Buchungen",
    toLogin: "Jetzt anmelden",
  },
  en: {
    eyebrow: "New password",
    h1: "Choose a new password",
    sub: "At least 8 characters. Safest is a long phrase you do not use anywhere else.",
    for: "For the account",
    pw: "New password",
    pw2: "Repeat password",
    show: "Show password",
    hide: "Hide password",
    strength: "Password strength",
    save: "Save password",
    errPw: "The password needs at least 8 characters.",
    errWeak: "This password is too easy to guess. Please choose a longer one.",
    errPw2: "The two passwords do not match.",
    errSame: "The new password must be different from the old one.",
    errServer: "The password could not be saved. Please request a new link.",
    check: "Checking the link …",
    badH: "This link has expired",
    badP: "Reset links are only valid for a short time and work only once. Just request a new one.",
    newLink: "Request a new link",
    ok: "Your password has been changed.",
    okH: "Password saved",
    okP: "From now on, sign in with your new password. For your safety we signed you out on other devices.",
    toDash: "Go to my bookings",
    toLogin: "Sign in now",
  },
  es: {
    eyebrow: "Contraseña nueva",
    h1: "Elige una contraseña nueva",
    sub: "Mínimo 8 caracteres. Lo más seguro es una frase larga que no uses en ningún otro sitio.",
    for: "Para la cuenta",
    pw: "Contraseña nueva",
    pw2: "Repite la contraseña",
    show: "Mostrar contraseña",
    hide: "Ocultar contraseña",
    strength: "Seguridad de la contraseña",
    save: "Guardar contraseña",
    errPw: "La contraseña necesita al menos 8 caracteres.",
    errWeak: "Esta contraseña es demasiado fácil de adivinar. Elige una más larga.",
    errPw2: "Las dos contraseñas no coinciden.",
    errSame: "La contraseña nueva debe ser distinta de la anterior.",
    errServer: "No se pudo guardar la contraseña. Pide un enlace nuevo.",
    check: "Comprobando el enlace …",
    badH: "El enlace ha caducado",
    badP: "Los enlaces para restablecer valen poco tiempo y solo una vez. Pide uno nuevo.",
    newLink: "Pedir enlace nuevo",
    ok: "Tu contraseña se ha cambiado.",
    okH: "Contraseña guardada",
    okP: "A partir de ahora entras con la contraseña nueva. Por seguridad hemos cerrado la sesión en otros dispositivos.",
    toDash: "Ir a mis reservas",
    toLogin: "Entrar ahora",
  },
} as const;

function NewPasswordPage() {
  const { t } = Route.useSearch();
  const { lang, toast } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const cloud = isBackendConfigured();

  /* "check" solange geprüft wird, "bad" bei abgelaufenem Link, sonst die
     Adresse des Kontos, dessen Passwort gleich geändert wird. */
  const [state, setState] = useState<"check" | "bad" | "ready" | "done">("check");
  const [who, setWho] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (cloud) {
      void supabase()
        .auth.getSession()
        .then(({ data }) => {
          const u = data.session?.user;
          if (!u) return setState("bad");
          setWho(u.email ?? "");
          setState("ready");
        });
      return;
    }
    const r = t ? readLocalReset(t) : null;
    if (!r) return setState("bad");
    setWho(r.email);
    setState("ready");
  }, [cloud, t]);

  const score = pwScore(pw).score;

  async function save() {
    setErr("");
    if (pw.length < 8) return setErr(T.errPw);
    if (score < 1) return setErr(T.errWeak);
    if (pw !== pw2) return setErr(T.errPw2);
    setBusy(true);
    if (cloud) {
      const sb = supabase();
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        setBusy(false);
        return setErr(error.code === "same_password" ? T.errSame : T.errServer);
      }
      /* Wer sein Passwort zurücksetzt, fürchtet oft, dass jemand anderes
         Zugriff hat. Deshalb alle übrigen Sitzungen beenden. */
      await sb.auth.signOut({ scope: "others" }).catch(() => undefined);
    } else if (!t || !redeemLocalReset(t, pw)) {
      setBusy(false);
      return setState("bad");
    }
    setBusy(false);
    setState("done");
    toast(T.ok);
  }

  let body;
  if (state === "check") {
    body = <p className="konto-sub">{T.check}</p>;
  } else if (state === "bad") {
    body = (
      <>
        <h1 className="konto-h1">{T.badH}</h1>
        <p className="konto-sub">{T.badP}</p>
        <Link to="/passwort-vergessen" className="btn-primary konto-go pw-link-btn">
          {T.newLink}
        </Link>
      </>
    );
  } else if (state === "done") {
    body = (
      <>
        <div className="pw-sent-ico ok" aria-hidden="true">
          <Icon name="check" />
        </div>
        <h1 className="konto-h1" role="status">
          {T.okH}
        </h1>
        <p className="konto-sub">{T.okP}</p>
        <button
          className="btn-primary konto-go"
          onClick={() => navigate({ to: cloud ? "/dashboard" : "/konto" })}
        >
          {cloud ? T.toDash : T.toLogin}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="konto-h1">{T.h1}</h1>
        <p className="konto-sub">{T.sub}</p>
        {who && (
          <p className="pw-for">
            {T.for} <strong>{who}</strong>
          </p>
        )}
        {/* Unsichtbares Feld mit der Adresse, damit Passwortmanager das neue
            Passwort dem richtigen Konto zuordnen. */}
        <input type="email" name="username" autoComplete="username" value={who} readOnly hidden />
        <div className="input-group">
          <label htmlFor="pw-new">{T.pw}</label>
          <div className="pw-field">
            <input
              id="pw-new"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setErr("");
              }}
              aria-describedby="pw-new-strength"
            />
            <button
              type="button"
              className="pw-eye"
              aria-label={show ? T.hide : T.show}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? "eyeOff" : "eye"} />
            </button>
          </div>
          {pw.length > 0 && (
            <>
              <div className="pw-meter" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={"pw-seg" + (score >= n ? " on" + score : "")} />
                ))}
              </div>
              <div className="pw-lbl" id="pw-new-strength">
                {T.strength}: {pwScore(pw)[(lang as "de" | "en" | "es") ?? "de"] ?? pwScore(pw).de}
              </div>
            </>
          )}
        </div>
        <div className="input-group">
          <label htmlFor="pw-new2">{T.pw2}</label>
          <input
            id="pw-new2"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => {
              setPw2(e.target.value);
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
        </div>
        {err && (
          <p className="picker-err" role="alert">
            {err}
          </p>
        )}
        <button className="btn-primary konto-go" onClick={() => void save()} disabled={busy}>
          {T.save}
        </button>
      </>
    );
  }

  return (
    <div className="page active konto-page">
      <div className="konto-wrap">
        <div className="konto-card">
          <div className="eyebrow violet">{T.eyebrow}</div>
          {body}
        </div>
      </div>
      <Footer />
    </div>
  );
}
