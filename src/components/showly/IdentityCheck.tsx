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
    waitP: "Die Prüfung läuft. Das dauert meist wenige Minuten, in Einzelfällen länger.",
    failP: "Die Prüfung ist nicht durchgegangen. Häufigste Ursache: Das Bild war unscharf oder der Ausweis abgelaufen.",
    note: "Ausweisbilder und biometrische Merkmale werden bei unserem Prüfdienst verarbeitet und dort nach der Prüfung gelöscht. Showly speichert ausschließlich das Ergebnis.",
    off: "Die Prüfung steht bereit, sobald die Datenbank verbunden ist.",
    err: "Die Prüfung konnte nicht gestartet werden.",
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
    failP: "The check did not pass. Most common reason: blurred photo or an expired document.",
    note: "ID images and biometric features are processed by our checking service and deleted there afterwards. Showly stores the result only.",
    off: "The check is ready as soon as the database is connected.",
    err: "The check could not be started.",
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
    failP: "No se ha superado. Motivo más común: foto borrosa o documento caducado.",
    note: "Las imágenes del documento y los rasgos biométricos los trata nuestro servicio de verificación y los borra después. Showly solo guarda el resultado.",
    off: "La verificación estará lista en cuanto se conecte la base de datos.",
    err: "No se pudo iniciar la verificación.",
  },
} as const;

export function IdentityCheck() {
  const { lang } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const [status, setStatus] = useState<VerificationStatus>("none");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isBackendConfigured()) return;
    void getIdentityStatus().then((r) => setStatus(r.status)).catch(() => undefined);
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
      const res = await startIdentityCheck();
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
    } catch {
      /* Stand bleibt, wie er war */
    } finally {
      setBusy(false);
    }
  }

  const done = status === "verified";
  const running = status === "pending" || status === "processing";

  return (
    <div className="verify-box">
      <div className="verify-head">
        <h2 className="detail-section-title">
          <Icon name="shield" /> {T.h}
        </h2>
        <span className={"verify-badge " + status}>
          {done && <Icon name="check" />}
          {T.badge[status]}
        </span>
      </div>

      {done ? (
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

      <div className="rev-form-foot">
        {!done && (
          <button className="btn-primary" onClick={() => void start()} disabled={busy}>
            {busy ? T.busy : status === "failed" ? T.again : T.start}
          </button>
        )}
        {(running || status === "failed") && (
          <button className="btn-secondary" onClick={() => void refresh()} disabled={busy}>
            {T.check}
          </button>
        )}
      </div>

      <p className="verify-note">
        <Icon name="lock" /> {T.note}
      </p>
    </div>
  );
}
