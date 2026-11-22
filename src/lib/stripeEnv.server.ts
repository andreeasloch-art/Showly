/* Test- oder Live-Zahlung entscheidet allein der Server.
 *
 * Früher kam die Umgebung vom Browser. Nach der Live-Schaltung hätte jemand
 * eine Zahlungsseite im Testmodus anlegen, mit einer Testkarte „bezahlen“
 * und die Buchung als bezahlt verbuchen lassen können. Deshalb wird der Wert
 * aus dem Browser überall durch diesen ersetzt. */
export type ServerStripeEnv = "sandbox" | "live";

export function serverStripeEnv(): ServerStripeEnv {
  return process.env["STRIPE_LIVE_API_KEY"] && process.env["NODE_ENV"] === "production" ? "live" : "sandbox";
}

/* Läuft die App mit Datenbank? Dann gibt es für jede Zahlung einen Weg, auf
 * dem der Server die Beträge selbst ausrechnet. Die alten Wege, die Beträge
 * oder Mailtexte vom Browser übernehmen, bleiben dann gesperrt und dienen nur
 * noch dem Übungsbetrieb ohne Datenbank. */
export function backendOnServer(): boolean {
  return !!process.env["SUPABASE_SERVICE_ROLE_KEY"];
}

/* Rücksprung nach dem Bezahlen nur auf diese App, nie auf fremde Seiten.
 * Erlaubt sind die eigene Adresse der Anfrage und die eingestellte
 * Seitenadresse (VITE_SITE_URL). */
export function sameSiteUrl(url: string, requestHost: string | undefined): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host))) return false;
  const allowed = new Set<string>();
  if (requestHost) allowed.add(requestHost.toLowerCase());
  const site = process.env["VITE_SITE_URL"];
  if (site) {
    try {
      allowed.add(new URL(site).host.toLowerCase());
    } catch {
      /* ungültige Einstellung ignorieren */
    }
  }
  return allowed.has(u.host.toLowerCase());
}
