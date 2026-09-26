/* Schutz vor Missbrauch und Verwaltungsrechte, nur auf dem Server.
 *
 * allow(): zählt, wie oft eine Person (oder, ohne Anmeldung, eine
 * Internetadresse) eine Aktion in einem Zeitfenster auslöst. Wird die Grenze
 * überschritten, lehnt die Serverfunktion ab. Gezählt wird in der Datenbank
 * (Funktion hit_rate_limit), damit die Grenze auch über mehrere Server
 * hinweg gilt.
 *
 * requireAdmin(): prüft die Rolle "admin" direkt in der Datenbank. */
import { getRequestHeader } from "@tanstack/react-start/server";
import { adminClient, requireUser } from "./supabase.server";

/** Grenzen je Aktion: [höchstens, je Sekunden] */
export const LIMITS = {
  cart: [10, 600],
  action: [60, 600],
  signup: [3, 86400],
  message: [30, 600],
  support: [5, 3600],
  error: [30, 3600],
  report: [20, 86400],
  connect: [10, 3600],
  offer: [60, 3600],
} as const satisfies Record<string, readonly [number, number]>;

export type LimitKey = keyof typeof LIMITS;

/** Internetadresse der Anfrage (hinter dem Proxy aus X-Forwarded-For) */
export function clientIp(): string {
  const fwd = getRequestHeader("x-forwarded-for") || "";
  return fwd.split(",")[0]?.trim() || getRequestHeader("x-real-ip") || "unknown";
}

/** true: erlaubt. Bei einer Störung der Datenbank wird nicht blockiert,
 *  damit echte Kunden nicht an einem Zählerfehler scheitern. */
export async function allow(key: LimitKey, who: string): Promise<boolean> {
  const [max, seconds] = LIMITS[key];
  try {
    const { data, error } = await adminClient().rpc("hit_rate_limit", {
      p_bucket: `${key}:${who}`,
      p_max: max,
      p_seconds: seconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export const TOO_MANY = "Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich noch einmal.";

/** Nur für die Verwaltung. Wirft, wenn die Person kein Admin ist. */
export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile?.role !== "admin") throw new Error("Keine Berechtigung");
  return ctx;
}
