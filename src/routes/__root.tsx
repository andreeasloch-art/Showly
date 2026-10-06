import { langFromUrl } from "@/showly/store";
import { useRouterState } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { countryFromHeaders, serverCountry } from "@/showly/geoLang";
import { COUNTRY_LANG } from "@/showly/country";
import { siteJsonLd } from "@/showly/seo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ShowlyProvider } from "@/showly/store";
import { Header } from "@/components/showly/Header";
import { CartDrawer } from "@/components/showly/CartDrawer";
import { Splash } from "@/components/showly/Splash";
import { ErrorReporter } from "@/components/showly/ErrorReporter";
import { ConsentBanner } from "@/components/showly/ConsentBanner";
import { CardLights } from "@/components/showly/Motion";

import { Toast, TabBar } from "@/components/showly/Chrome";
import { SeoLang } from "@/components/showly/SeoLang";
import { RevealWatcher } from "@/showly/reveal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Diese Seite konnte nicht geladen werden
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte versuche es erneut oder gehe zurück zur Startseite.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}

const GOOGLE_VERIFY = String(import.meta.env["VITE_GOOGLE_SITE_VERIFICATION"] || "").trim();
const BING_VERIFY = String(import.meta.env["VITE_BING_SITE_VERIFICATION"] || "").trim();

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Showly – Künstler & Event-Acts buchen" },
      {
        name: "description",
        content:
          "Showly: Künstler, Walking Acts und Eventplaner mit Live-Kalender online buchen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0B0618" },
      /* Als App auf dem Home-Bildschirm: ohne Browserleiste, eigener Name */
      { name: "application-name", content: "Showly" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Showly" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      /* Inhaberschaft für Google Search Console und Bing Webmaster Tools.
         Den Code aus der Search Console (Methode "HTML-Tag", nur der Wert
         von content) in Lovable unter Secrets als
         VITE_GOOGLE_SITE_VERIFICATION eintragen, für Bing
         VITE_BING_SITE_VERIFICATION. Ohne Wert entfällt das Tag. */
      ...(GOOGLE_VERIFY ? [{ name: "google-site-verification", content: GOOGLE_VERIFY }] : []),
      ...(BING_VERIFY ? [{ name: "msvalidate.01", content: BING_VERIFY }] : []),
    ],
    /* Name, Logo und Social-Media-Profile für das Google-Suchergebnis */
    scripts: [{ type: "application/ld+json", children: siteJsonLd() }],
    links: [
      { rel: "stylesheet", href: appCss },
      /* Outfit, die Schrift der Wortmarke, liegt im Projekt und wird in
         showly.css eingebunden. Kein Aufruf zu Google mehr: das spart zwei
         Verbindungsaufbauten und ein Stylesheet, das das Zeichnen aufhält. */
      { rel: "preload", href: "/fonts/Outfit-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/* Verhindert kurzes Aufblitzen der Standardsprache vor der Erkennung */
const LANG_BOOT_SCRIPT = `(function(){try{
/* Zeigt der Gestaltung, dass JavaScript laeuft. Nur dann starten Elemente
   unsichtbar und werden beim Scrollen eingeblendet. */
document.documentElement.setAttribute('data-js','1');
var q='';try{q=(new URLSearchParams(location.search).get('lang')||'').toLowerCase()}catch(e){}
var s=null;try{s=localStorage.getItem('showly.lang')}catch(e){}
var l=(q==='de'||q==='en'||q==='es')?q:s;
if(l!=='de'&&l!=='en'&&l!=='es'){
  /* Land der Internetadresse vom Server (siehe geoLang.ts); Suchmaschinen
     bleiben bei Deutsch. Die genaue Erkennung macht danach der Store. */
  var g=window.__SHOWLY_GEO, m=__GEO_MAP__;
  l=(!/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp/i.test(navigator.userAgent)&&g&&m[g])||'';
  if(!l){l='de';
  var ls=(navigator.languages||[navigator.language||'']);
  for(var i=0;i<ls.length;i++){var c=String(ls[i]||'').toLowerCase().slice(0,2);if(c==='de'||c==='en'||c==='es'){l=c;break;}}}
}
if(l!=='de'){document.documentElement.setAttribute('data-lang-boot','1');}
}catch(e){}})();`;

/* Land der Anfrage: auf dem Server aus der Kopfzeile des Hosters
   (CF-IPCountry), im Browser aus dem, was der Server ins HTML geschrieben hat */
const requestCountry = createIsomorphicFn()
  .server(() => countryFromHeaders((h) => getRequestHeader(h)))
  .client(() => serverCountry());

const BOOT = LANG_BOOT_SCRIPT.replace("__GEO_MAP__", JSON.stringify(COUNTRY_LANG));

function RootShell({ children }: { children: ReactNode }) {
  const geo = requestCountry();
  /* Sprachfassung aus ?lang=en|es schon im HTML des Servers (für Google) */
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const htmlLang = langFromUrl(searchStr) ?? "de";
  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{ __html: `window.__SHOWLY_GEO=${JSON.stringify(geo ?? "")};` }}
        />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body data-theme="home">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ShowlyProvider>
        <SeoLang />
        <RevealWatcher />
        <Header />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <CartDrawer />
        <TabBar />
        <Toast />
        <Splash />
        <ErrorReporter />
        <ConsentBanner />
        <CardLights />
      </ShowlyProvider>
    </QueryClientProvider>
  );
}
