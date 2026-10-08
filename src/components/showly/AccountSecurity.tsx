/* Konto-Sicherheit und eigene Daten (Seite /konto).
 *
 *  - Zwei-Faktor-Anmeldung mit einer Authenticator-App (TOTP, z. B. Google
 *    Authenticator, Apple Passwörter, Microsoft Authenticator). Läuft über
 *    Supabase Auth; das Geheimnis liegt nur dort und in der App der Person.
 *  - MfaGate: Wer 2FA eingerichtet hat, muss nach jeder Anmeldung (Passwort,
 *    E-Mail-Code, SMS, Google, Apple) zusätzlich den 6-stelligen Code
 *    eingeben. Die Verwaltung (/admin) prüft das zusätzlich auf dem Server.
 *  - Datenauskunft: alle eigenen Daten als JSON-Datei (Art. 15/20 DSGVO).
 *
 * Ohne Datenbank (Vorschau) zeigen beide Bereiche nur einen Hinweis. */
import { useEffect, useState } from "react";
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { exportMyData } from "@/utils/account.functions";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

type Lang = "de" | "en" | "es";

const COPY = {
  de: {
    h: "Zwei-Faktor-Anmeldung",
    p: "Zusätzlich zum Passwort oder Code fragt Showly nach einem 6-stelligen Code aus deiner Authenticator-App. Empfohlen für Künstler und Anbieter, Pflicht für die Verwaltung.",
    on: "Eingeschaltet",
    off: "Ausgeschaltet",
    start: "Einrichten",
    scan: "Scanne den QR-Code mit deiner Authenticator-App (z. B. Google Authenticator, Apple Passwörter, Microsoft Authenticator) oder gib den Schlüssel ein:",
    code: "6-stelliger Code aus der App",
    confirm: "Bestätigen",
    cancel: "Abbrechen",
    remove: "Ausschalten",
    removeSure: "Zum Ausschalten den aktuellen Code eingeben:",
    bad: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.",
    done: "Zwei-Faktor-Anmeldung ist eingeschaltet.",
    removed: "Zwei-Faktor-Anmeldung ist ausgeschaltet.",
    failed: "Das hat nicht geklappt. Bitte versuch es noch einmal.",
    offline: "In der Vorschau ohne Server ausgeschaltet.",
    gateH: "Anmeldung bestätigen",
    gateP: "Gib den 6-stelligen Code aus deiner Authenticator-App ein.",
    gateOut: "Abmelden",
    exH: "Meine Daten herunterladen",
    exP: "Alle Daten zu deinem Konto als Datei (JSON): Profil, Buchungen, Bestellungen, Nachrichten, Bewertungen, Beiträge und mehr.",
    exBtn: "Daten herunterladen",
    exBusy: "Wird zusammengestellt …",
    exFix: "Etwas stimmt nicht? Korrigieren kannst du deine Angaben direkt im Profil oder Dashboard, sonst schreib an support@showly.eu.",
  },
  en: {
    h: "Two-factor sign-in",
    p: "On top of your password or code, Showly asks for a 6-digit code from your authenticator app. Recommended for artists and providers, required for admins.",
    on: "On",
    off: "Off",
    start: "Set up",
    scan: "Scan the QR code with your authenticator app (e.g. Google Authenticator, Apple Passwords, Microsoft Authenticator) or enter the key:",
    code: "6-digit code from the app",
    confirm: "Confirm",
    cancel: "Cancel",
    remove: "Turn off",
    removeSure: "Enter the current code to turn it off:",
    bad: "The code is wrong. Please enter the current code from the app.",
    done: "Two-factor sign-in is on.",
    removed: "Two-factor sign-in is off.",
    failed: "That didn't work. Please try again.",
    offline: "Off in the preview without a server.",
    gateH: "Confirm sign-in",
    gateP: "Enter the 6-digit code from your authenticator app.",
    gateOut: "Sign out",
    exH: "Download my data",
    exP: "All data about your account as a file (JSON): profile, bookings, orders, messages, reviews, posts and more.",
    exBtn: "Download data",
    exBusy: "Preparing …",
    exFix: "Something wrong? You can correct your details in your profile or dashboard, otherwise write to support@showly.eu.",
  },
  es: {
    h: "Inicio de sesión en dos pasos",
    p: "Además de tu contraseña o código, Showly te pide un código de 6 dígitos de tu app de autenticación. Recomendado para artistas y proveedores, obligatorio para la administración.",
    on: "Activado",
    off: "Desactivado",
    start: "Configurar",
    scan: "Escanea el código QR con tu app de autenticación (p. ej. Google Authenticator, Contraseñas de Apple, Microsoft Authenticator) o introduce la clave:",
    code: "Código de 6 dígitos de la app",
    confirm: "Confirmar",
    cancel: "Cancelar",
    remove: "Desactivar",
    removeSure: "Introduce el código actual para desactivarlo:",
    bad: "El código no es correcto. Introduce el código actual de la app.",
    done: "El inicio de sesión en dos pasos está activado.",
    removed: "El inicio de sesión en dos pasos está desactivado.",
    failed: "No ha funcionado. Inténtalo de nuevo.",
    offline: "Desactivado en la vista previa sin servidor.",
    gateH: "Confirmar inicio de sesión",
    gateP: "Introduce el código de 6 dígitos de tu app de autenticación.",
    gateOut: "Cerrar sesión",
    exH: "Descargar mis datos",
    exP: "Todos los datos de tu cuenta en un archivo (JSON): perfil, reservas, pedidos, mensajes, reseñas, publicaciones y más.",
    exBtn: "Descargar datos",
    exBusy: "Preparando …",
    exFix: "¿Algo no es correcto? Puedes corregir tus datos en tu perfil o panel; si no, escribe a support@showly.eu.",
  },
} as const;

function useCopy() {
  const { lang } = useShowly();
  return COPY[(lang as Lang) ?? "de"] ?? COPY.de;
}

const sixDigits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Bestätigt einen TOTP-Faktor mit Code; true bei Erfolg */
async function verifyCode(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId, code });
  return !error;
}

export function TwoFactorSettings() {
  const C = useCopy();
  const { toast } = useShowly();
  const online = isBackendConfigured();
  const [factor, setFactor] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!online) return;
    const { data } = await supabase().auth.mfa.listFactors();
    setFactor(data?.totp?.[0]?.id ?? null);
  }
  useEffect(() => {
    void load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin() {
    setMsg("");
    setBusy(true);
    try {
      /* angefangene, nie bestätigte Einrichtungen aufräumen */
      const { data: list } = await supabase().auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status !== "verified") await supabase().auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase().auth.mfa.enroll({ factorType: "totp", friendlyName: "Showly" });
      if (error || !data) throw error;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setMsg(C.failed);
    }
    setBusy(false);
  }

  async function finish() {
    if (!setup) return;
    setBusy(true);
    const ok = await verifyCode(setup.id, code).catch(() => false);
    setBusy(false);
    if (!ok) return setMsg(C.bad);
    setSetup(null);
    setCode("");
    setMsg("");
    toast(C.done);
    await load();
  }

  async function remove() {
    if (!factor) return;
    setBusy(true);
    /* Ausschalten nur mit gültigem Code (aal2) */
    const ok = await verifyCode(factor, code).catch(() => false);
    const res = ok ? await supabase().auth.mfa.unenroll({ factorId: factor }) : null;
    setBusy(false);
    if (!ok || res?.error) return setMsg(ok ? C.failed : C.bad);
    setRemoving(false);
    setCode("");
    setMsg("");
    toast(C.removed);
    await load();
  }

  const codeInput = (
    <input
      className="acc-sec-code"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={C.code}
      placeholder="123456"
      value={code}
      onChange={(e) => setCode(sixDigits(e.target.value))}
    />
  );

  return (
    <section className="acc-sec">
      <div className="acc-sec-head">
        <span className="acc-sec-ic">
          <Icon name="key" />
        </span>
        <div>
          <h3>
            {C.h} {online && <em className={factor ? "acc-sec-on" : "acc-sec-off"}>{factor ? C.on : C.off}</em>}
          </h3>
          <p>{online ? C.p : C.offline}</p>
        </div>
      </div>
      {online && !factor && !setup && (
        <button type="button" className="acc-sec-btn" disabled={busy} onClick={() => void begin()}>
          {C.start}
        </button>
      )}
      {setup && (
        <div className="acc-sec-box">
          <p>{C.scan}</p>
          <img className="acc-sec-qr" src={setup.qr} alt="QR-Code" width={180} height={180} />
          <code className="acc-sec-secret">{setup.secret}</code>
          <label>
            <span>{C.code}</span>
            {codeInput}
          </label>
          <div className="acc-sec-actions">
            <button
              type="button"
              className="home-btn soft"
              onClick={() => {
                void supabase().auth.mfa.unenroll({ factorId: setup.id });
                setSetup(null);
                setCode("");
              }}
            >
              {C.cancel}
            </button>
            <button type="button" className="home-btn primary" disabled={code.length !== 6 || busy} onClick={() => void finish()}>
              {C.confirm}
            </button>
          </div>
        </div>
      )}
      {factor && !removing && (
        <button type="button" className="acc-sec-btn" onClick={() => setRemoving(true)}>
          {C.remove}
        </button>
      )}
      {factor && removing && (
        <div className="acc-sec-box">
          <label>
            <span>{C.removeSure}</span>
            {codeInput}
          </label>
          <div className="acc-sec-actions">
            <button type="button" className="home-btn soft" onClick={() => setRemoving(false)}>
              {C.cancel}
            </button>
            <button type="button" className="home-btn primary" disabled={code.length !== 6 || busy} onClick={() => void remove()}>
              {C.remove}
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className="acc-sec-msg" role="alert">
          {msg}
        </p>
      )}
    </section>
  );
}

/** Nach der Anmeldung: Code verlangen, wenn 2FA eingerichtet ist */
export function MfaGate() {
  const C = useCopy();
  const [factor, setFactor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    const sb = supabase();
    async function check() {
      try {
        const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
          const { data: f } = await sb.auth.mfa.listFactors();
          setFactor(f?.totp?.[0]?.id ?? null);
        } else setFactor(null);
      } catch {
        setFactor(null);
      }
    }
    void check();
    const { data: sub } = sb.auth.onAuthStateChange(() => void check());
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!factor) return null;

  async function go() {
    if (!factor) return;
    setBusy(true);
    const ok = await verifyCode(factor, code).catch(() => false);
    setBusy(false);
    if (!ok) return setMsg(C.bad);
    setCode("");
    setMsg("");
    setFactor(null);
  }

  return (
    <div className="feed26-modal mfa-gate" role="dialog" aria-modal="true" aria-labelledby="mfa-gate-h">
      <div className="acc-sec acc-sec-modal">
        <div className="acc-sec-head">
          <span className="acc-sec-ic">
            <Icon name="lock" />
          </span>
          <div>
            <h3 id="mfa-gate-h">{C.gateH}</h3>
            <p>{C.gateP}</p>
          </div>
        </div>
        <form
          className="acc-sec-box"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <input
            className="acc-sec-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={C.code}
            placeholder="123456"
            autoFocus
            value={code}
            onChange={(e) => setCode(sixDigits(e.target.value))}
          />
          {msg && (
            <p className="acc-sec-msg" role="alert">
              {msg}
            </p>
          )}
          <div className="acc-sec-actions">
            <button type="button" className="home-btn soft" onClick={() => void supabase().auth.signOut()}>
              {C.gateOut}
            </button>
            <button type="submit" className="home-btn primary" disabled={code.length !== 6 || busy}>
              {C.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DataExport() {
  const C = useCopy();
  const { toast } = useShowly();
  const online = isBackendConfigured();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await exportMyData();
      if ("error" in r) toast(r.error);
      else if ("json" in r) {
        const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `showly-meine-daten-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      toast(C.failed);
    }
    setBusy(false);
  }

  return (
    <section className="acc-sec">
      <div className="acc-sec-head">
        <span className="acc-sec-ic">
          <Icon name="clipboard" />
        </span>
        <div>
          <h3>{C.exH}</h3>
          <p>{online ? C.exP : C.offline}</p>
        </div>
      </div>
      {online && (
        <button type="button" className="acc-sec-btn" disabled={busy} onClick={() => void run()}>
          {busy ? C.exBusy : C.exBtn}
        </button>
      )}
      <p className="acc-sec-note">{C.exFix}</p>
    </section>
  );
}
