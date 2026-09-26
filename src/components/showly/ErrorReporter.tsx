/* Fehler in der App an den Server melden (Fehlerprotokoll im Admin-Bereich).
 *
 * Nur mit hinterlegter Datenbank. Je Seitenaufruf höchstens 10 Meldungen und
 * jede gleiche Meldung nur einmal, damit eine Endlosschleife nicht den
 * Server flutet. Inhalte von Eingabefeldern werden nie mitgeschickt. */
import { useEffect } from "react";
import { isBackendConfigured } from "@/lib/supabase";
import { logClientError } from "@/utils/support.functions";

const MAX = 10;

export function ErrorReporter() {
  useEffect(() => {
    if (!isBackendConfigured()) return;
    const seen = new Set<string>();
    const send = (message: string, stack?: string) => {
      if (seen.size >= MAX || seen.has(message)) return;
      /* Ladefehler fremder Seiten (Werbeblocker, Erweiterungen) übergehen */
      if (/^Script error\.?$/.test(message) || /ResizeObserver loop/.test(message)) return;
      seen.add(message);
      void logClientError({
        data: {
          message,
          ...(stack ? { stack } : {}),
          url: location.pathname + location.hash,
          ua: navigator.userAgent,
        },
      }).catch(() => undefined);
    };
    const onError = (e: ErrorEvent) => send(e.message || "Fehler", e.error instanceof Error ? e.error.stack : undefined);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : String(r ?? "Unbehandelte Ablehnung"), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
