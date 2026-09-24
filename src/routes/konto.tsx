/* Konto für normale Gäste: anmelden oder in einer Minute registrieren.
 *
 * Anbieter legen ihr Konto weiter über "Künstler werden" an, weil dort auch
 * das öffentliche Profil entsteht. Hier geht es nur um Gäste, die buchen,
 * bewerten und im Event-Blog posten wollen.
 *
 * Hinweis zur Sicherheit: Die Zugangsdaten liegen im Browser dieses Geräts.
 * Das trägt für eine Vorschau, ersetzt aber keine echte Anmeldung mit
 * Server und geprüfter Verschlüsselung. */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { seoHead } from "@/showly/seo";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { accountExists, findAccount, saveAccount } from "@/showly/persist";
import { pwScore } from "@/showly/figures";

export const Route = createFileRoute("/konto")({
  head: () => seoHead("/konto", "/konto"),
  component: AccountPage,
});

const COPY = {
  de: {
    eyebrow: "Dein Konto",
    h1: "Anmelden oder Konto anlegen",
    sub: "Mit einem Konto findest du deine Buchungen, Favoriten und Bewertungen auf jedem Gerät wieder.",
    tabIn: "Anmelden",
    tabUp: "Neu hier",
    name: "Name",
    namePh: "Vor- und Nachname",
    mail: "E-Mail",
    mailPh: "name@beispiel.de",
    pw: "Passwort",
    pwPh: "Mindestens 8 Zeichen",
    pw2: "Passwort wiederholen",
    signIn: "Anmelden",
    signUp: "Konto anlegen",
    forgot: "Passwort vergessen? Lege einfach ein neues Konto an.",
    artist: "Du bist Künstler oder Planer?",
    artistLink: "Hier entlang",
    errMail: "Bitte eine gültige E-Mail-Adresse eingeben.",
    errName: "Bitte trag deinen Namen ein.",
    errPw: "Das Passwort braucht mindestens 8 Zeichen.",
    errPw2: "Die beiden Passwörter stimmen nicht überein.",
    errTaken: "Zu dieser Adresse gibt es schon ein Konto. Melde dich an.",
    errWrong: "E-Mail oder Passwort stimmt nicht.",
    okIn: "Willkommen zurück, {n}.",
    okUp: "Konto angelegt. Schön, dass du da bist, {n}.",
    outH: "Du bist angemeldet",
    outP: "Angemeldet als {n} ({m}).",
    toDash: "Zu meinen Buchungen",
    out: "Abmelden",
    note: "Deine Daten bleiben auf diesem Gerät. Es gibt noch keinen Server dahinter.",
    strength: "Passwortstärke",
  },
  en: {
    eyebrow: "Your account",
    h1: "Sign in or create an account",
    sub: "With an account your bookings, favourites and reviews follow you to every device.",
    tabIn: "Sign in",
    tabUp: "New here",
    name: "Name",
    namePh: "First and last name",
    mail: "Email",
    mailPh: "name@example.com",
    pw: "Password",
    pwPh: "At least 8 characters",
    pw2: "Repeat password",
    signIn: "Sign in",
    signUp: "Create account",
    forgot: "Forgot your password? Just create a new account.",
    artist: "Are you an artist or planner?",
    artistLink: "This way",
    errMail: "Please enter a valid email address.",
    errName: "Please enter your name.",
    errPw: "The password needs at least 8 characters.",
    errPw2: "The two passwords do not match.",
    errTaken: "An account already exists for this address. Please sign in.",
    errWrong: "Email or password is not correct.",
    okIn: "Welcome back, {n}.",
    okUp: "Account created. Good to have you, {n}.",
    outH: "You are signed in",
    outP: "Signed in as {n} ({m}).",
    toDash: "Go to my bookings",
    out: "Sign out",
    note: "Your data stays on this device. There is no server behind it yet.",
    strength: "Password strength",
  },
  es: {
    eyebrow: "Tu cuenta",
    h1: "Entrar o crear una cuenta",
    sub: "Con una cuenta encontrarás tus reservas, favoritos y reseñas en cualquier dispositivo.",
    tabIn: "Entrar",
    tabUp: "Soy nuevo",
    name: "Nombre",
    namePh: "Nombre y apellido",
    mail: "Correo",
    mailPh: "nombre@ejemplo.es",
    pw: "Contraseña",
    pwPh: "Mínimo 8 caracteres",
    pw2: "Repite la contraseña",
    signIn: "Entrar",
    signUp: "Crear cuenta",
    forgot: "¿Olvidaste la contraseña? Crea una cuenta nueva.",
    artist: "¿Eres artista u organizador?",
    artistLink: "Por aquí",
    errMail: "Introduce un correo válido.",
    errName: "Introduce tu nombre.",
    errPw: "La contraseña necesita al menos 8 caracteres.",
    errPw2: "Las dos contraseñas no coinciden.",
    errTaken: "Ya existe una cuenta con este correo. Inicia sesión.",
    errWrong: "El correo o la contraseña no es correcta.",
    okIn: "Bienvenida de nuevo, {n}.",
    okUp: "Cuenta creada. Qué bien tenerte aquí, {n}.",
    outH: "Has iniciado sesión",
    outP: "Conectado como {n} ({m}).",
    toDash: "Ir a mis reservas",
    out: "Cerrar sesión",
    note: "Tus datos se quedan en este dispositivo. Todavía no hay servidor detrás.",
    strength: "Seguridad de la contraseña",
  },
} as const;

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AccountPage() {
  const { lang, session, setSession, toast } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  const score = pwScore(pw).score;

  function signIn() {
    if (!MAIL.test(mail)) return setErr(T.errMail);
    const acc = findAccount(mail, pw);
    if (!acc) return setErr(T.errWrong);
    setSession({
      name: acc.name,
      email: acc.email,
      role: acc.role,
      ...(acc.providerId !== undefined ? { providerId: acc.providerId } : {}),
    });
    setErr("");
    toast(T.okIn.replace("{n}", acc.name));
    setTimeout(() => navigate({ to: "/dashboard" }), 600);
  }

  function signUp() {
    if (!name.trim()) return setErr(T.errName);
    if (!MAIL.test(mail)) return setErr(T.errMail);
    if (pw.length < 8) return setErr(T.errPw);
    if (pw !== pw2) return setErr(T.errPw2);
    if (accountExists(mail)) return setErr(T.errTaken);

    saveAccount({ email: mail, pw, name: name.trim(), role: "customer" });
    setSession({ name: name.trim(), email: mail.trim().toLowerCase(), role: "customer" });
    setErr("");
    toast(T.okUp.replace("{n}", name.trim()));
    setTimeout(() => navigate({ to: "/dashboard" }), 600);
  }

  if (session) {
    return (
      <div className="page active konto-page">
        <div className="konto-wrap">
          <div className="konto-card">
            <div className="eyebrow violet">{T.eyebrow}</div>
            <h1 className="konto-h1">{T.outH}</h1>
            <p className="konto-sub">
              {T.outP.replace("{n}", session.name).replace("{m}", session.email)}
            </p>
            <div className="konto-foot">
              <button className="btn-primary" onClick={() => navigate({ to: "/dashboard" })}>
                {T.toDash}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSession(null);
                  toast(T.out);
                }}
              >
                {T.out}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page active konto-page">
      <div className="konto-wrap">
        <div className="konto-card">
          <div className="eyebrow violet">{T.eyebrow}</div>
          <h1 className="konto-h1">{T.h1}</h1>
          <p className="konto-sub">{T.sub}</p>

          <div className="konto-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "in"}
              className={"konto-tab" + (mode === "in" ? " on" : "")}
              onClick={() => {
                setMode("in");
                setErr("");
              }}
            >
              {T.tabIn}
            </button>
            <button
              role="tab"
              aria-selected={mode === "up"}
              className={"konto-tab" + (mode === "up" ? " on" : "")}
              onClick={() => {
                setMode("up");
                setErr("");
              }}
            >
              {T.tabUp}
            </button>
          </div>

          {mode === "up" && (
            <div className="input-group">
              <label htmlFor="k-name">{T.name}</label>
              <input
                id="k-name"
                value={name}
                placeholder={T.namePh}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="k-mail">{T.mail}</label>
            <input
              id="k-mail"
              type="email"
              value={mail}
              placeholder={T.mailPh}
              autoComplete="email"
              onChange={(e) => setMail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="k-pw">{T.pw}</label>
            <input
              id="k-pw"
              type="password"
              value={pw}
              placeholder={T.pwPh}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (mode === "in" ? signIn() : undefined)}
            />
            {mode === "up" && pw.length > 0 && (
              <>
                <div className="pw-meter" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} className={"pw-seg" + (score >= n ? " on" + score : "")} />
                  ))}
                </div>
                <div className="pw-lbl">{T.strength}</div>
              </>
            )}
          </div>

          {mode === "up" && (
            <div className="input-group">
              <label htmlFor="k-pw2">{T.pw2}</label>
              <input
                id="k-pw2"
                type="password"
                value={pw2}
                autoComplete="new-password"
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signUp()}
              />
            </div>
          )}

          {err && <p className="picker-err">{err}</p>}

          <button className="btn-primary konto-go" onClick={mode === "in" ? signIn : signUp}>
            {mode === "in" ? T.signIn : T.signUp}
          </button>

          <p className="konto-note">
            <Icon name="lock" /> {T.note}
          </p>
          {mode === "in" && <p className="konto-small">{T.forgot}</p>}

          <div className="konto-switch">
            {T.artist}{" "}
            <Link to="/mitmachen" className="konto-link">
              {T.artistLink} →
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
