/* Kalender verbinden: Google, Apple (iCloud) und Outlook über iCal.
 *
 * 1. Einlesen: Künstler tragen den privaten iCal-Link ihres Kalenders ein.
 *    Belegte Zeiten daraus sind auf Showly gesperrt, mit einer Stunde
 *    Fahrtzeit davor und danach. So gibt es keine Doppelbuchung, wenn sie
 *    auch woanders Aufträge annehmen.
 * 2. Ausgeben: ein geheimer Link mit allen Showly-Auftritten zum Abonnieren.
 *
 * Funktioniert nur mit Datenbank (echtes Konto); in der Vorschau steht ein
 * Hinweis. Server: utils/calendar.functions.ts, lib/calsync.server.ts. */
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { isBackendConfigured } from "@/lib/supabase";
import type { CalendarStatus } from "@/utils/calendar.functions";

const COPY = {
  de: {
    h: "Kalender verbinden",
    p: "Nimmst du auch außerhalb von Showly Aufträge an? Verbinde deinen Kalender: Belegte Zeiten daraus sind auf Showly automatisch gesperrt, mit einer Stunde Fahrtzeit davor und danach. Wir speichern nur Beginn und Ende, keine Titel oder Orte.",
    url: "iCal-Link deines Kalenders",
    urlPh: "https://calendar.google.com/calendar/ical/…/basic.ics",
    label: "Name (freiwillig)",
    labelPh: "z. B. Privat",
    add: "Verbinden",
    adding: "Wird geprüft …",
    sync: "Jetzt abgleichen",
    remove: "Entfernen",
    synced: (t: string, n: number) => `Zuletzt abgeglichen ${t} · ${n} belegte Zeiten`,
    never: "Noch nicht abgeglichen",
    err: "Fehler beim letzten Abgleich:",
    next: "Nächste belegte Zeiten aus deinen Kalendern",
    allDay: "ganztägig",
    howH: "So findest du den iCal-Link",
    how: [
      ["Google Kalender", "Am Computer: Einstellungen → links deinen Kalender wählen → „Kalender integrieren“ → „Privatadresse im iCal-Format“ kopieren."],
      ["Apple Kalender (iCloud)", "iPhone: Kalender-App → Kalender → ⓘ neben deinem Kalender → „Öffentlicher Kalender“ einschalten → „Link teilen“ → kopieren. Am Mac: Rechtsklick auf den Kalender → Teilen → „Öffentlicher Kalender“."],
      ["Outlook / Microsoft 365", "Einstellungen → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“ → Kalender wählen, Berechtigung „Kann sehen, wann ich beschäftigt bin“ → Veröffentlichen → ICS-Link kopieren."],
    ] as [string, string][],
    expH: "Showly-Auftritte in deinem Kalender",
    expP: "Abonniere deine Showly-Buchungen in Google, Apple oder Outlook. Der Link ist geheim: Wer ihn hat, sieht deine Auftrittszeiten.",
    expMake: "Link erstellen",
    expNew: "Neuen Link erzeugen (alter wird ungültig)",
    copy: "Kopieren",
    copied: "Link kopiert",
    open: "In Kalender-App öffnen",
    expHow: "Google: „Weitere Kalender“ → + → „Per URL“. Apple: Ablage → „Neues Kalenderabonnement“ (iPhone: Einstellungen → Kalender → Accounts → Andere → Kalenderabo). Outlook: Kalender hinzufügen → „Aus dem Internet abonnieren“. Google aktualisiert Abos nur alle paar Stunden.",
    preview: "Kalender verbinden geht mit deinem echten Showly-Konto. In dieser Vorschau ist es ausgeschaltet.",
    loading: "Lädt …",
  },
  en: {
    h: "Connect your calendar",
    p: "Do you also take bookings outside Showly? Connect your calendar: busy times from it are blocked on Showly automatically, with one hour of travel time before and after. We only store start and end, no titles or places.",
    url: "iCal link of your calendar",
    urlPh: "https://calendar.google.com/calendar/ical/…/basic.ics",
    label: "Name (optional)",
    labelPh: "e.g. Private",
    add: "Connect",
    adding: "Checking …",
    sync: "Sync now",
    remove: "Remove",
    synced: (t: string, n: number) => `Last synced ${t} · ${n} busy times`,
    never: "Not synced yet",
    err: "Error during last sync:",
    next: "Next busy times from your calendars",
    allDay: "all day",
    howH: "Where to find the iCal link",
    how: [
      ["Google Calendar", "On a computer: Settings → pick your calendar on the left → “Integrate calendar” → copy “Secret address in iCal format”."],
      ["Apple Calendar (iCloud)", "iPhone: Calendar app → Calendars → ⓘ next to your calendar → turn on “Public Calendar” → “Share Link” → copy. On a Mac: right-click the calendar → Share → “Public Calendar”."],
      ["Outlook / Microsoft 365", "Settings → Calendar → Shared calendars → “Publish a calendar” → choose the calendar and “Can view when I'm busy” → Publish → copy the ICS link."],
    ] as [string, string][],
    expH: "Your Showly shows in your calendar",
    expP: "Subscribe to your Showly bookings in Google, Apple or Outlook. The link is secret: anyone who has it can see your show times.",
    expMake: "Create link",
    expNew: "Create a new link (old one stops working)",
    copy: "Copy",
    copied: "Link copied",
    open: "Open in calendar app",
    expHow: "Google: “Other calendars” → + → “From URL”. Apple: File → “New Calendar Subscription” (iPhone: Settings → Calendar → Accounts → Other → Add Subscribed Calendar). Outlook: Add calendar → “Subscribe from web”. Google refreshes subscriptions only every few hours.",
    preview: "Connecting a calendar works with your real Showly account. It is switched off in this preview.",
    loading: "Loading …",
  },
  es: {
    h: "Conectar tu calendario",
    p: "¿Aceptas también trabajos fuera de Showly? Conecta tu calendario: las horas ocupadas se bloquean en Showly automáticamente, con una hora de desplazamiento antes y después. Solo guardamos inicio y fin, ni títulos ni lugares.",
    url: "Enlace iCal de tu calendario",
    urlPh: "https://calendar.google.com/calendar/ical/…/basic.ics",
    label: "Nombre (opcional)",
    labelPh: "p. ej. Privado",
    add: "Conectar",
    adding: "Comprobando …",
    sync: "Sincronizar ahora",
    remove: "Quitar",
    synced: (t: string, n: number) => `Última sincronización ${t} · ${n} horas ocupadas`,
    never: "Aún no sincronizado",
    err: "Error en la última sincronización:",
    next: "Próximas horas ocupadas de tus calendarios",
    allDay: "todo el día",
    howH: "Dónde encontrar el enlace iCal",
    how: [
      ["Google Calendar", "En el ordenador: Configuración → elige tu calendario a la izquierda → «Integrar el calendario» → copia la «Dirección secreta en formato iCal»."],
      ["Calendario de Apple (iCloud)", "iPhone: app Calendario → Calendarios → ⓘ junto a tu calendario → activa «Calendario público» → «Compartir enlace» → copiar."],
      ["Outlook / Microsoft 365", "Configuración → Calendario → Calendarios compartidos → «Publicar un calendario» → elige el calendario y «Puede ver cuándo estoy ocupado» → Publicar → copia el enlace ICS."],
    ] as [string, string][],
    expH: "Tus shows de Showly en tu calendario",
    expP: "Suscríbete a tus reservas de Showly en Google, Apple u Outlook. El enlace es secreto: quien lo tenga ve tus horarios.",
    expMake: "Crear enlace",
    expNew: "Crear un enlace nuevo (el anterior deja de funcionar)",
    copy: "Copiar",
    copied: "Enlace copiado",
    open: "Abrir en la app de calendario",
    expHow: "Google: «Otros calendarios» → + → «Desde URL». Apple: Archivo → «Nueva suscripción a calendario». Outlook: Agregar calendario → «Suscribirse desde la web». Google actualiza las suscripciones cada pocas horas.",
    preview: "Conectar un calendario funciona con tu cuenta real de Showly. En esta vista previa está desactivado.",
    loading: "Cargando …",
  },
};

export function CalendarSync() {
  const { lang, session, toast, fmtDate } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") in COPY ? (lang as "de" | "en" | "es") : "de"];
  const live = isBackendConfigured() && !!session?.backend;
  const [st, setSt] = useState<Extract<CalendarStatus, { feeds: unknown }> | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(p: Promise<CalendarStatus | { error: string }>) {
    setBusy(true);
    try {
      const r = await p;
      if ("error" in r) return toast(r.error);
      if ("skipped" in r) return;
      setSt(r);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!live) return;
    void import("@/utils/calendar.functions").then(({ myCalendars }) => run(myCalendars()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const exportUrl = st?.exportPath && typeof window !== "undefined" ? window.location.origin + st.exportPath : null;

  return (
    <section className="calsync">
      <h3 className="calsync-h">
        <Icon name="calendar" /> {T.h}
      </h3>
      <p className="calsync-p">{T.p}</p>
      {!live ? (
        <p className="calsync-note">{T.preview}</p>
      ) : !st ? (
        <p className="calsync-note">{T.loading}</p>
      ) : (
        <>
          {st.feeds.length > 0 && (
            <ul className="calsync-feeds">
              {st.feeds.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.label || f.host}</strong>
                    <small>{f.lastSyncedAt ? T.synced(when(f.lastSyncedAt), f.eventsCount) : T.never}</small>
                    {f.lastError && (
                      <small className="calsync-err">
                        {T.err} {f.lastError}
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="konto-link"
                    disabled={busy}
                    onClick={() => void import("@/utils/calendar.functions").then(({ removeCalendarFeed }) => run(removeCalendarFeed({ data: { id: f.id } })))}
                  >
                    {T.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="calsync-add">
            <label className="pe-field">
              <span className="pe-label">{T.url}</span>
              <input value={url} inputMode="url" placeholder={T.urlPh} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{T.label}</span>
              <input value={label} maxLength={60} placeholder={T.labelPh} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="calsync-row">
              <button
                type="button"
                className="btn-primary"
                disabled={busy || url.trim().length < 12}
                onClick={() =>
                  void import("@/utils/calendar.functions")
                    .then(({ addCalendarFeed }) => run(addCalendarFeed({ data: { url, label } })))
                    .then((ok) => {
                      if (ok) {
                        setUrl("");
                        setLabel("");
                      }
                    })
                }
              >
                {busy ? T.adding : T.add}
              </button>
              {st.feeds.length > 0 && (
                <button
                  type="button"
                  className="konto-link"
                  disabled={busy}
                  onClick={() => void import("@/utils/calendar.functions").then(({ syncMyCalendars }) => run(syncMyCalendars()))}
                >
                  {T.sync}
                </button>
              )}
            </div>
          </div>
          {st.upcomingExternal.length > 0 && (
            <div className="calsync-next">
              <strong>{T.next}</strong>
              <ul>
                {st.upcomingExternal.map((x, i) => (
                  <li key={i}>{x.allDay ? `${fmtDate(x.start.slice(0, 10))} · ${T.allDay}` : `${when(x.start)} – ${new Date(x.end).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`}</li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="calsync-h">
            <Icon name="calendar" /> {T.expH}
          </h3>
          <p className="calsync-p">{T.expP}</p>
          {exportUrl ? (
            <>
              <div className="calsync-export">
                <code>{exportUrl}</code>
                <button
                  type="button"
                  className="konto-link"
                  onClick={() => void navigator.clipboard?.writeText(exportUrl).then(() => toast(T.copied))}
                >
                  {T.copy}
                </button>
                <a className="konto-link" href={exportUrl.replace(/^https?:/, "webcal:")}>
                  {T.open}
                </a>
              </div>
              <p className="calsync-small">{T.expHow}</p>
              <button
                type="button"
                className="konto-link"
                disabled={busy}
                onClick={() => void import("@/utils/calendar.functions").then(({ rotateCalendarExport }) => run(rotateCalendarExport()))}
              >
                {T.expNew}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void import("@/utils/calendar.functions").then(({ rotateCalendarExport }) => run(rotateCalendarExport()))}
            >
              {T.expMake}
            </button>
          )}
        </>
      )}
      <details className="calsync-how">
        <summary>{T.howH}</summary>
        {T.how.map(([h, p]) => (
          <p key={h}>
            <strong>{h}:</strong> {p}
          </p>
        ))}
      </details>
    </section>
  );
}
