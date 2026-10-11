/* Showly Offline-Speicher (Service Worker).
 *
 * Ziel: Die App öffnet sich auch bei schlechtem oder fehlendem Netz sofort,
 * ohne dass je eine alte Version hängen bleibt. Deshalb streng getrennt:
 *
 *   Seiten (HTML)          immer zuerst aus dem Netz. Nur ohne Netz kommt
 *                          die zuletzt gesehene Fassung, sonst die Startseite.
 *                          Online sieht also jeder sofort die neue Version.
 *   /assets/*              Programmcode und Design. Der Name enthält einen
 *                          Prüfwert und ändert sich bei jeder neuen Version;
 *                          eine Datei mit demselben Namen ist immer gleich.
 *                          Daher zuerst aus dem Speicher.
 *   Bilder, Schriften,     sofort aus dem Speicher, im Hintergrund erneuert
 *   Video                  (ein ausgetauschtes Bild kommt beim nächsten Mal).
 *   alles andere           gar nicht: Datenbank, Server-Funktionen, /api,
 *                          Zahlung, fremde Adressen, alles außer GET.
 *
 * Notbremse: Wird diese Datei durch eine ersetzt, die nur
 *   self.addEventListener("install",()=>self.skipWaiting());
 *   self.addEventListener("activate",e=>e.waitUntil(self.registration.unregister()));
 * enthält, meldet sich der Speicher bei allen Besuchern beim nächsten Aufruf ab.
 *
 * VERSION hochzählen, wenn sich an den Regeln hier etwas ändert; alte
 * Speicher werden dann gelöscht. */
const VERSION = "v1";
const PAGES = `showly-pages-${VERSION}`;
const ASSETS = `showly-assets-${VERSION}`;
const MEDIA = `showly-media-${VERSION}`;
const KEEP = [PAGES, ASSETS, MEDIA];

/* Höchstzahl je Speicher, damit er auf dem Handy nicht endlos wächst */
const LIMIT = { [PAGES]: 30, [ASSETS]: 200, [MEDIA]: 250 };

const MEDIA_PATH = /^\/(acts|shop|sweets|venues|icons|fonts|textures)\/|^\/(wort-|splash|logo-|wordmark-|og-showly|favicon)/;
const NEVER = /^\/(api|_serverFn|_server|auth|checkout|konto|dashboard|admin|portal|anmelden|passwort)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.add(new Request("/", { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("showly-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name) {
  const c = await caches.open(name);
  const keys = await c.keys();
  const max = LIMIT[name] || 100;
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function put(name, req, res) {
  if (!res || !res.ok || res.type === "opaque" || res.headers.has("set-cookie")) return;
  const c = await caches.open(name);
  await c.put(req, res);
  void trim(name);
}

async function pageFirstNetwork(event) {
  const req = event.request;
  try {
    const res = await fetch(req);
    event.waitUntil(put(PAGES, req, res.clone()));
    return res;
  } catch (err) {
    const hit = (await caches.match(req, { cacheName: PAGES })) || (await caches.match("/", { cacheName: PAGES }));
    if (hit) return hit;
    throw err;
  }
}

async function assetFirstCache(event) {
  const hit = await caches.match(event.request, { cacheName: ASSETS });
  if (hit) return hit;
  const res = await fetch(event.request);
  event.waitUntil(put(ASSETS, event.request, res.clone()));
  return res;
}

async function mediaStaleWhileRevalidate(event) {
  const hit = await caches.match(event.request, { cacheName: MEDIA });
  const fresh = fetch(event.request)
    .then((res) => {
      event.waitUntil(put(MEDIA, event.request, res.clone()));
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  const res = await fresh;
  return res || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Videos werden stückweise geladen (Range); das überlassen wir dem Browser */
  if (req.headers.has("range")) return;
  if (NEVER.test(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(pageFirstNetwork(event));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(assetFirstCache(event));
  } else if (MEDIA_PATH.test(url.pathname)) {
    event.respondWith(mediaStaleWhileRevalidate(event));
  }
});
