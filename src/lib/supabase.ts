/* Zugang zur Datenbank und zur Anmeldung, Browser-Seite.
 *
 * Wichtig für die Sicherheit: Die Sitzung liegt in Cookies, nicht im
 * localStorage. Damit ist sie für fremdes JavaScript auf der Seite nicht mehr
 * einfach auslesbar, und der Server kann bei jeder Anfrage selbst prüfen, wer
 * fragt. Vorher war die Sitzung ein bearbeitbarer Eintrag im Browserspeicher.
 *
 * Der hier verwendete Schlüssel ist der öffentliche. Er darf im Browser stehen;
 * was damit erlaubt ist, entscheiden die Zugriffsregeln in der Datenbank. */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

/** Ist eine Datenbank hinterlegt? Ohne Schlüssel läuft die App im örtlichen
 *  Übungsbetrieb weiter, damit nichts kaputtgeht, bevor das Projekt steht. */
export function isBackendConfigured(): boolean {
  return !!url && !!anonKey;
}

let client: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  if (!isBackendConfigured()) {
    throw new Error(
      "Supabase ist nicht eingerichtet. VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen.",
    );
  }
  if (!client) {
    client = createBrowserClient<Database>(url!, anonKey!, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/** Adresse, auf die Google und die Mail-Bestätigung zurückspringen. */
export function authRedirectTo(next = "/konto"): string {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/auth/rueckkehr?next=${encodeURIComponent(next)}`;
}
