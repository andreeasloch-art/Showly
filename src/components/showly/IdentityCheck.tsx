/* Ausweisprüfung im Künstlerportal.
 *
 * Der Ausweis und das Selfie gehen im gesicherten Fenster von Stripe direkt an
 * den Prüfdienst. Showly bekommt nur zurück, ob die Prüfung bestanden wurde.
 * Deshalb steht hier auch nur ein Knopf und ein Stand, kein Hochladefeld. */
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { getStripe } from "@/lib/stripe";
import { isBackendConfigured } from "@/lib/supabase";
import {
  getIdentityStatus,
  refreshIdentityCheck,
  startIdentityCheck,
} from "@/utils/identity.functions";
import type { VerificationStatus } from "@/lib/database.types";

const TEXT = {
  de: {
    h: "Ausweisprüfung",
    badge: {
      none: "Noch nicht geprüft",
      pending: "Prüfung gestartet",
      processing: "Wird geprüft",
      verified: "Geprüft",
      failed: "Nicht bestanden",
      cancelled: "Abgebrochen",
    },
    p: "Geprüfte Profile werden im Katalog mit einem Siegel angezeigt und deutlich häufiger gebucht. Die Prüfung dauert etwa zwei Minuten.",
    steps: [
      "Du fotografierst deinen Ausweis oder Reisepass.",
      "Danach ein kurzes Selfie, damit klar ist, dass du es selbst bist.",
      "Beides geht direkt an den Prüfdienst, Showly sieht die Bilder nie.",
    ],
    start: "Prüfung starten",
    again: "Erneut versuchen",
    check: "Stand aktualisieren",
    busy: "Einen Moment …",
    okH: "Dein Profil ist geprüft",
    okP: "Das Siegel ist ab sofort im Katalog sichtbar.",
    waitP:
      "Die Prüfung läuft. Das dauert meist wenige Minuten, in Einzelfällen länger.",
    failP:
      "Die Prüfung ist nicht durchgegangen. Häufigste Ursache: Das Bild war unscharf oder der Ausweis abgelaufen.",
    note: "Ausweisbilder und Selfie verarbeitet unser Prüfdienst Stripe. Nach bestandener Prüfung veranlasst Showly die Löschung dieser Bilder bei Stripe und speichert nur das Ergebnis.",
    consent:
      "Ich willige ein, dass Stripe mein Ausweisfoto und ein Selfie verarbeitet, um meine Identität per Gesichtsabgleich zu prüfen (biometrische Daten, Art. 9 Abs. 2 lit. a DSGVO). Die Einwilligung ist freiwillig; ohne sie kann das Profil aber nicht freigeschaltet werden. Widerruf jederzeit an datenschutz@showly.de.",
    off: "Die Prüfung steht bereit, sobald die Datenbank verbunden ist.",
    err: "Die Prüfung konnte nicht gestartet werden.",
    dupH: "Für dich gibt es schon ein Showly-Profil",
    dupP: "Bei Showly hat jede Person nur ein Profil. Melde dich bitte mit deinem bestehenden Konto an und trag dort weitere Figuren und Acts ein. Dieses Profil bleibt verborgen. Unser Team meldet sich bei dir; wenn du das alte Konto nicht mehr nutzen kannst, schreib uns über die Hilfe-Seite.",
    dupBadge: "Schon vorhanden",
  },
  en: {
    h: "Identity check",
    badge: {
      none: "Not checked yet",
      pending: "Check started",
      processing: "Being checked",
      verified: "Verified",
      failed: "Not passed",
      cancelled: "Cancelled",
    },
    p: "Verified profiles carry a badge in the catalogue and get booked far more often. The check takes about two minutes.",
    steps: [
      "You photograph your ID card or passport.",
      "Then a short selfie, so it is clear it is really you.",
      "Both go straight to the checking service, Showly never sees the images.",
    ],
    start: "Start the check",
    again: "Try again",
    check: "Refresh status",
    busy: "One moment …",
    okH: "Your profile is verified",
    okP: "The badge is now visible in the catalogue.",
    waitP: "The check is running. Usually a few minutes, sometimes longer.",
    failP:
      "The check did not pass. Most common reason: blurred photo or an expired document.",
    note: "ID images and the selfie are processed by our checking service Stripe. After a successful check Showly has these images deleted at Stripe and stores the result only.",
    consent:
      "I consent to Stripe processing my ID photo and a selfie to verify my identity by face matching (biometric data, Art. 9(2)(a) GDPR). Consent is voluntary, but without it the profile cannot be activated. Withdraw any time at datenschutz@showly.de.",
    off: "The check is ready as soon as the database is connected.",
    err: "The check could not be started.",
    dupH: "You already have a Showly profile",
    dupP: "On Showly every person has one profile only. Please sign in with your existing account and add further characters and acts there. This profile stays hidden. Our team will get in touch; if you can no longer use the old account, write to us via the help page.",
    dupBadge: "Already exists",
  },
  es: {
    h: "Verificación de identidad",
    badge: {
      none: "Sin verificar",
      pending: "Verificación iniciada",
      processing: "En revisión",
      verified: "Verificado",
      failed: "No superada",
      cancelled: "Cancelada",
    },
    p: "Los perfiles verificados llevan un sello en el catálogo y se reservan mucho más. Tarda unos dos minutos.",
    steps: [
      "Fotografías tu documento de identidad o pasaporte.",
      "Después un selfie corto, para confirmar que eres tú.",
      "Todo va directo al servicio de verificación, Showly nunca ve las imágenes.",
    ],
    start: "Empezar la verificación",
    again: "Intentar de nuevo",
    check: "Actualizar estado",
    busy: "Un momento …",
    okH: "Tu perfil está verificado",
    okP: "El sello ya se ve en el catálogo.",
    waitP: "La verificación está en curso. Suele tardar unos minutos.",
    failP:
      "No se ha superado. Motivo más común: foto borrosa o documento caducado.",
    note: "Las imágenes del documento y el selfie los trata nuestro servicio de verificación Stripe. Tras una verificación correcta, Showly solicita su borrado en Stripe y solo guarda el resultado.",
    consent:
      "Consiento que Stripe trate la foto de mi documento y un selfie para verificar mi identidad mediante comparación facial (datos biométricos, art. 9.2.a RGPD). Es voluntario, pero sin ello no se puede activar el perfil. Revocable en cualquier momento en datenschutz@showly.de.",
    off: "La verificación estará lista en cuanto se conecte la base de datos.",
    err: "No se pudo iniciar la verificación.",
    dupH: "Ya tienes un perfil en Showly",
    dupP: "En Showly cada persona tiene un solo perfil. Inicia sesión con tu cuenta existente y añade allí más personajes y actuaciones. Este perfil permanece oculto. Nuestro equipo se pondrá en contacto; si ya no puedes usar la cuenta antigua, escríbenos desde la página de ayuda.",
    dupBadge: "Ya existe",
  },
} as const;

export function IdentityCheck() {
  const { lang } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const [status, setStatus] = useState<VerificationStatus>("none");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    if (!isBackendConfigured()) return;
    void getIdentityStatus()
      .then((r) => {
        setStatus(r.status);
        setReason(r.reason);
      })
      .catch(() => undefined);
  }, []);

  if (!isBackendConfigured()) {
    return (
      <div className="verify-box">
        <div className="verify-head">
          <h2 className="detail-section-title">
            <Icon name="shield" /> {T.h}
          </h2>
        </div>
        <p className="verify-p">{T.off}</p>
      </div>
    );
  }

  async function start() {
    setErr("");
    setBusy(true);
    try {
      const res = await startIdentityCheck({ data: { consent } });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      const stripe = await getStripe();
      if (!stripe) {
        setErr(T.err);
        return;
      }
      /* Öffnet das gesicherte Fenster von Stripe. Alles Weitere passiert dort. */
      const { error } = await stripe.verifyIdentity(res.clientSecret);
      if (error) setErr(error.message ?? T.err);
      await refresh();
    } catch {
      setErr(T.err);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const r = await refreshIdentityCheck();
      setStatus(r.status);
      setReason(r.reason);
    } catch {
      /* Stand bleibt, wie er war */
    } finally {
      setBusy(false);
    }
  }

  const done = status === "verified";
  /* Dieselbe Person hat schon ein Konto: kein erneuter Versuch (AGB § 3 Abs. 5) */
  const dup = reason === "duplicate";
  const running = status === "pending" || status === "processing";

  return (
    <div className="verify-box">
      <div className="verify-head">
        <h2 className="detail-section-title">
          <Icon name="shield" /> {T.h}
        </h2>
        <span className={"verify-badge " + status}>
          {done && <Icon name="check" />}
          {dup ? T.dupBadge : T.badge[status]}
        </span>
      </div>

      {dup ? (
        <p className="verify-p">
          <strong>{T.dupH}</strong> {T.dupP}
        </p>
      ) : done ? (
        <p className="verify-p">
          <strong>{T.okH}</strong> {T.okP}
        </p>
      ) : running ? (
        <p className="verify-p">{T.waitP}</p>
      ) : (
        <>
          <p className="verify-p">{status === "failed" ? T.failP : T.p}</p>
          <ul className="verify-list">
            {T.steps.map((s) => (
              <li key={s}>
                <Icon name="check" /> {s}
              </li>
            ))}
          </ul>
        </>
      )}

      {err && <p className="picker-err">{err}</p>}

      {!dup && (
        <div className="rev-form-foot">
          {!done && !running && (
            <label className="reg-check verify-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>{T.consent}</span>
            </label>
          )}
          {!done && (
            <button
              className="btn-primary"
              onClick={() => void start()}
              disabled={busy || !consent}
            >
              {busy ? T.busy : status === "failed" ? T.again : T.start}
            </button>
          )}
          {(running || status === "failed") && (
            <button
              className="btn-secondary"
              onClick={() => void refresh()}
              disabled={busy}
            >
              {T.check}
            </button>
          )}
        </div>
      )}

      <p className="verify-note">
        <Icon name="lock" /> {T.note}
      </p>
    </div>
  );
}
