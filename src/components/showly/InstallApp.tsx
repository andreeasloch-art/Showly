/* "Showly als App installieren".
 *
 * Android, Chrome und Edge bieten ein eigenes Installationsfenster
 * (beforeinstallprompt). Safari auf iPhone/iPad kennt das nicht; dort zeigen
 * wir die zwei Handgriffe (Teilen, "Zum Home-Bildschirm"). Läuft Showly schon
 * als installierte App, erscheint der Knopf nicht. */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { useEscape } from "@/showly/useEscape";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const COPY = {
  de: {
    btn: "Showly als App installieren",
    sub: "Mit eigenem Symbol auf dem Home-Bildschirm, ohne Browserleiste. Kostenlos, ohne App Store.",
    iosH: "Showly auf dem iPhone installieren",
    ios1: "Tippe unten in Safari auf „Teilen“",
    ios2: "Wähle „Zum Home-Bildschirm“",
    ios3: "Tippe auf „Hinzufügen“. Showly erscheint mit eigenem Symbol.",
    otherH: "Showly installieren",
    other: "Öffne das Menü deines Browsers (⋮) und wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.",
    close: "Schließen",
    done: "Showly ist installiert",
  },
  en: {
    btn: "Install Showly as an app",
    sub: "With its own icon on your home screen, without the browser bar. Free, no app store needed.",
    iosH: "Install Showly on iPhone",
    ios1: "Tap “Share” at the bottom of Safari",
    ios2: "Choose “Add to Home Screen”",
    ios3: "Tap “Add”. Showly appears with its own icon.",
    otherH: "Install Showly",
    other: "Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.",
    close: "Close",
    done: "Showly is installed",
  },
  es: {
    btn: "Instalar Showly como app",
    sub: "Con su propio icono en la pantalla de inicio y sin barra del navegador. Gratis, sin tienda de apps.",
    iosH: "Instalar Showly en el iPhone",
    ios1: "Toca «Compartir» abajo en Safari",
    ios2: "Elige «Añadir a pantalla de inicio»",
    ios3: "Toca «Añadir». Showly aparece con su propio icono.",
    otherH: "Instalar Showly",
    other: "Abre el menú del navegador (⋮) y elige «Instalar app» o «Añadir a pantalla de inicio».",
    close: "Cerrar",
    done: "Showly está instalada",
  },
} as const;

let deferred: PromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
  });
}

function standalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallApp({ compact = false }: { compact?: boolean }) {
  const { lang, toast } = useShowly();
  const C = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<"" | "ios" | "other">("");
  useEscape(help !== "", () => setHelp(""));

  useEffect(() => {
    setInstalled(standalone());
    const fn = () => setInstalled(true);
    window.addEventListener("appinstalled", fn);
    return () => window.removeEventListener("appinstalled", fn);
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const r = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
      deferred = null;
      if (r.outcome === "accepted") toast(C.done);
      return;
    }
    setHelp(isIOS() ? "ios" : "other");
  }

  return (
    <>
      <button type="button" className={"install-app" + (compact ? " compact" : "")} onClick={() => void install()}>
        <img src="/icons/icon-96.webp" alt="" width={40} height={40} />
        <span>
          <b>{C.btn}</b>
          {!compact && <small>{C.sub}</small>}
        </span>
      </button>
      {help && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setHelp("")}>
          <div className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-h">
            <img src="/icons/icon-192.png" alt="" width={72} height={72} />
            <h2 id="install-h">{help === "ios" ? C.iosH : C.otherH}</h2>
            {help === "ios" ? (
              <ol>
                <li>
                  <Icon name="send" /> {C.ios1}
                </li>
                <li>
                  <Icon name="plus" /> {C.ios2}
                </li>
                <li>
                  <Icon name="check" /> {C.ios3}
                </li>
              </ol>
            ) : (
              <p>{C.other}</p>
            )}
            <button type="button" className="install-close" autoFocus onClick={() => setHelp("")}>
              {C.close}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
