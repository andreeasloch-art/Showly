/* Offline-Speicher anmelden (public/sw.js).
 *
 * Nur auf der echten, direkt geöffneten Seite: nicht beim Entwickeln, nicht
 * ohne HTTPS und nicht eingebettet (Lovable-Editor, Vorschau). Angemeldet
 * wird erst nach dem Laden, damit der erste Besuch nicht langsamer wird. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV || location.protocol !== "https:") return;
  try {
    if (window.top !== window) return;
  } catch {
    return;
  }
  const go = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
