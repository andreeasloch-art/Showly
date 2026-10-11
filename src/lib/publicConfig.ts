/* Öffentliche Angaben zur Datenbank: Adresse und öffentlicher Schlüssel.
 *
 * Beide dürfen im Browser stehen (was damit erlaubt ist, regeln die
 * Zugriffsregeln der Datenbank). Sie kommen auf zwei Wegen an:
 *
 *  1. beim Bauen als VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, wie bisher
 *  2. zur Laufzeit vom Server: Er liest sie aus seinen Umgebungsvariablen und
 *     schreibt sie beim Ausliefern der Seite als window.__SHOWLY_SB ins HTML
 *     (routes/__root.tsx).
 *
 * Weg 2 ist nötig, weil Lovable Cloud die Angaben dem Server gibt, aber
 * nicht immer schon beim Bauen. Ohne ihn lief die veröffentlichte App im
 * Übungsbetrieb ohne Datenbank. Lovable nennt den Schlüssel außerdem
 * "PUBLISHABLE_KEY" statt "ANON_KEY"; beide Namen werden gelesen. */

export type PublicSupabase = { url: string; key: string };

const URL_NAMES = ["VITE_SUPABASE_URL", "SUPABASE_URL"];
const KEY_NAMES = ["VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"];
const ID_NAMES = ["VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"];

function pick(src: Record<string, unknown> | undefined, names: string[]): string | undefined {
  if (!src) return undefined;
  for (const n of names) {
    const v = src[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function fromEnv(src: Record<string, unknown> | undefined): PublicSupabase | null {
  const id = pick(src, ID_NAMES);
  const url = pick(src, URL_NAMES) || (id ? `https://${id}.supabase.co` : undefined);
  const key = pick(src, KEY_NAMES);
  return url && key ? { url, key } : null;
}

/** Auf dem Server: aus den Umgebungsvariablen (Laufzeit, dann Build) */
export function serverPublicSupabase(): PublicSupabase | null {
  const proc = typeof process !== "undefined" ? (process.env as Record<string, unknown>) : undefined;
  return fromEnv(proc) || fromEnv(import.meta.env as unknown as Record<string, unknown>);
}

/** Im Browser: aus dem Build, sonst aus dem, was der Server ins HTML schrieb */
export function browserPublicSupabase(): PublicSupabase | null {
  const built = fromEnv(import.meta.env as unknown as Record<string, unknown>);
  if (built) return built;
  if (typeof window === "undefined") return null;
  const w = (window as { __SHOWLY_SB?: unknown }).__SHOWLY_SB as Partial<PublicSupabase> | undefined;
  return w && typeof w.url === "string" && typeof w.key === "string" && /^https:\/\//.test(w.url) ? { url: w.url, key: w.key } : null;
}

/** Für das HTML: als Skript-Zeile, sicher gegen "</script>" */
export function publicSupabaseScript(cfg: PublicSupabase | null): string {
  return `window.__SHOWLY_SB=${JSON.stringify(cfg).replace(/</g, "\\u003c")};`;
}
