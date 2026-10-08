/* Schutz vor Bots und Fake-Konten: Cloudflare Turnstile.
 *
 * Nur aktiv, wenn VITE_TURNSTILE_SITE_KEY gesetzt ist; sonst gibt
 * captchaToken() nichts zurück und alles läuft wie bisher. Turnstile zeigt
 * normalen Menschen meist gar nichts an (kein Bilderrätsel) und fragt nur bei
 * Verdacht kurz nach. Das Token geht an Supabase Auth (Anmeldung per Code,
 * Passwort, SMS, Passwort vergessen), das es selbst bei Cloudflare prüft, wenn
 * im Supabase-Dashboard „Captcha protection“ mit demselben Dienst
 * eingeschaltet ist, und an eigene Formulare (Hilfe), die es auf dem Server
 * prüfen (lib/captcha.server.ts). */

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

const SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

export function captchaEnabled(): boolean {
  return !!SITE_KEY && typeof window !== "undefined";
}

let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  const w = window as unknown as { turnstile?: Turnstile };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error("turnstile")));
      s.onerror = () => {
        loading = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(s);
    });
  return loading;
}

/** Frisches Einmal-Token oder undefined, wenn kein Captcha eingerichtet ist */
export async function captchaToken(lang = "de"): Promise<string | undefined> {
  if (!captchaEnabled()) return undefined;
  const ts = await load();
  const box = document.createElement("div");
  box.className = "captcha-box";
  document.body.appendChild(box);
  try {
    return await new Promise<string>((resolve, reject) => {
      const id = ts.render(box, {
        sitekey: SITE_KEY,
        language: lang,
        appearance: "interaction-only",
        callback: (t: string) => resolve(t),
        "error-callback": () => reject(new Error("captcha")),
        "timeout-callback": () => reject(new Error("captcha")),
      });
      window.setTimeout(() => reject(new Error("captcha")), 120_000);
      void id;
    });
  } finally {
    window.setTimeout(() => box.remove(), 0);
  }
}

/** Optionen für Supabase-Auth-Aufrufe: { captchaToken } oder {} */
export async function captchaOptions(lang?: string): Promise<{ captchaToken?: string }> {
  const t = await captchaToken(lang).catch(() => undefined);
  return t ? { captchaToken: t } : {};
}
