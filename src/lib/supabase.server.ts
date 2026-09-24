/* Zugang zur Datenbank, Server-Seite.
 *
 * Zwei getrennte Wege, das ist Absicht:
 *
 *  serverClient()  liest die Sitzung aus den Cookies der Anfrage und arbeitet
 *                  mit den Rechten der angemeldeten Person. Alle Zugriffsregeln
 *                  der Datenbank gelten.
 *
 *  adminClient()   umgeht die Zugriffsregeln und ist nur für Dinge gedacht, die
 *                  niemand selbst dürfen darf: Prüfsiegel setzen, Buchung nach
 *                  bestätigter Zahlung anlegen, Rolle ändern. Der Schlüssel
 *                  dafür verlässt den Server nie.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import type { Database } from "./database.types";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} ist nicht gesetzt`);
  return v;
}

function parseCookies(header: string | undefined) {
  if (!header) return [];
  return header.split(";").map((part) => {
    const i = part.indexOf("=");
    const name = decodeURIComponent(part.slice(0, i).trim());
    const value = decodeURIComponent(part.slice(i + 1).trim());
    return { name, value };
  });
}

/** Arbeitet mit den Rechten der angemeldeten Person. */
export function serverClient(): SupabaseClient<Database> {
  const url = env("VITE_SUPABASE_URL");
  const key = env("VITE_SUPABASE_ANON_KEY");
  const pending: string[] = [];

  const client = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => parseCookies(getRequestHeader("cookie")),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          const bits = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
          if (process.env["NODE_ENV"] === "production") bits.push("Secure");
          if (options?.maxAge) bits.push(`Max-Age=${options.maxAge}`);
          pending.push(bits.join("; "));
        }
        if (pending.length) setResponseHeader("set-cookie", pending);
      },
    },
  });
  return client;
}

/** Nur für Vorgänge, die der Browser nicht selbst auslösen darf. */
export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Die angemeldete Person samt Rolle, direkt aus der Datenbank geprüft.
 *  Nichts davon kommt aus dem Browser. */
export async function requireUser() {
  const sb = serverClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("Nicht angemeldet");

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, display_name, email")
    .eq("id", data.user.id)
    .single();

  return { user: data.user, profile, sb };
}

/** Wie requireUser, verlangt aber zusätzlich eine bestimmte Rolle. */
export async function requireRole(...roles: Array<"customer" | "artist" | "planner" | "admin">) {
  const ctx = await requireUser();
  if (!ctx.profile || !roles.includes(ctx.profile.role)) {
    throw new Error("Keine Berechtigung");
  }
  return ctx;
}
