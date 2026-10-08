/* Captcha-Prüfung auf dem Server (Cloudflare Turnstile, siehe
 * showly/captcha.ts). Ohne TURNSTILE_SECRET_KEY ist sie ausgeschaltet und
 * lässt alles durch; die übrigen Bremsen (guard.server.ts) gelten immer. */
import { clientIp } from "./guard.server";

export function captchaRequired(): boolean {
  return !!process.env["TURNSTILE_SECRET_KEY"];
}

export async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return true;
  if (!token || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    const ip = clientIp();
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}
