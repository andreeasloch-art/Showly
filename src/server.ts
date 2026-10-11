import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { PAGE_TTL, edgeCache, pageCacheKey } from "./lib/pageCache";

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

declare const __SHOWLY_BUILD__: string;

function waitUntil(ctx: unknown, p: Promise<unknown>) {
  const w = (ctx as { waitUntil?: (p: Promise<unknown>) => void } | null)?.waitUntil;
  if (typeof w === "function") w.call(ctx, p);
  else void p;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const build = typeof __SHOWLY_BUILD__ === "string" ? __SHOWLY_BUILD__ : "dev";
      const key = pageCacheKey(request, build);
      const edge = key ? edgeCache() : null;
      if (key && edge) {
        const hit = await edge.match(key).catch(() => undefined);
        if (hit) {
          /* Für den Browser nicht merken (siehe unten) */
          const out = new Response(hit.body, hit);
          out.headers.set("Cache-Control", "no-cache");
          return out;
        }
      }
      const handler = await getServerEntry();
      const response = withSecurityHeaders(await normalizeCatastrophicSsrResponse(await handler.fetch(request, env, ctx)));
      if (key && edge && response.status === 200 && !response.headers.has("set-cookie")) {
        /* Im Speicher 5 Minuten; der Browser selbst fragt jedes Mal nach,
           damit er nach einer neuen Version sofort die neue Seite bekommt */
        const stored = new Response(response.clone().body, response);
        stored.headers.set("Cache-Control", `public, max-age=${PAGE_TTL}`);
        waitUntil(ctx, edge.put(key, stored).catch(() => undefined));
        response.headers.set("Cache-Control", "no-cache");
      }
      return response;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
