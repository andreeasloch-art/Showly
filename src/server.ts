import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/* Sicherheits-Header, die nichts kaputt machen können: kein MIME-Raten,
   sparsame Referrer, nur HTTPS, kein Mikrofon, kein fremdes Einbetten der
   Seite (Clickjacking), keine Plugins, kein Umbiegen von <base> und
   Formularen. Eine Skript-Whitelist (script-src) fehlt bewusst noch: Sie muss
   auf Supabase, Stripe, Turnstile und Komoot abgestimmt und im Live-Betrieb
   getestet werden; XSS verhindert bis dahin React (kein ungeprüftes HTML aus
   Nutzereingaben). */
const CSP = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app https://*.lovableproject.com",
  "upgrade-insecure-requests",
].join("; ");
function withSecurityHeaders(res: Response): Response {
  try {
    const h = new Headers(res.headers);
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    h.set("Permissions-Policy", "microphone=(), interest-cohort=()");
    if (!h.has("Content-Security-Policy")) h.set("Content-Security-Policy", CSP);
    h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch {
    return res;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
