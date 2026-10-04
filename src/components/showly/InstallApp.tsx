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
    soon: "Bald im",
    soonPlay: "Bald bei",
    andH: "Showly auf Android installieren",
    andP: "Öffne das Menü von Chrome (⋮) und wähle „App installieren“. Showly erscheint mit eigenem Symbol.",
    interim: "Bis Showly im Store ist, kannst du die App so direkt installieren:",
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
    soon: "Coming soon to the",
    soonPlay: "Coming soon on",
    andH: "Install Showly on Android",
    andP: "Open the Chrome menu (⋮) and choose “Install app”. Showly appears with its own icon.",
    interim: "Until Showly is in the store, you can install the app directly like this:",
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
    soon: "Pronto en el",
    soonPlay: "Pronto en",
    andH: "Instalar Showly en Android",
    andP: "Abre el menú de Chrome (⋮) y elige «Instalar app». Showly aparece con su propio icono.",
    interim: "Hasta que Showly esté en la tienda, puedes instalar la app directamente así:",
  },
} as const;

/* Adressen der Store-Einträge. Solange sie leer sind, steht auf den
   Knöpfen „Bald im …“ und ein Tipp installiert Showly direkt als App
   (ohne Store). Nach der Freigabe durch Apple bzw. Google hier eintragen. */
const STORES = {
  apple: "",
  google: "",
};

/* Die beiden Markenzeichen: Apple einfarbig, Google Play in vier festen Farben. */
function AppleMark() {
  return (
    <svg className="store-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.9 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4 0-.1-2.3-.9-2.3-3.3Z" />
      <path d="M14.8 6.2c.6-.7 1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.6 2.7-1.4Z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg className="store-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.7 2.1c-.4.3-.6.8-.6 1.4v17c0 .6.2 1.1.6 1.4l9.4-9.9z" fill="#00D1FF" />
      <path d="M16.6 15.4 13.1 12l3.5-3.4 3.7 2.1c1.1.6 1.1 1.7 0 2.4z" fill="#FFCE00" />
      <path d="M16.6 15.4 13.1 12l-9.4 9.9c.5.4 1.1.4 1.8 0z" fill="#FF3A44" />
      <path d="M16.6 8.6 13.1 12 3.7 2.1c.7-.4 1.3-.4 1.8 0z" fill="#00E676" />
    </svg>
  );
}

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

export function InstallApp({ compact = false, stores = false }: { compact?: boolean; stores?: boolean }) {
  const { lang, toast, t } = useShowly();
  const C = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<"" | "ios" | "android" | "other">("");
  const [interim, setInterim] = useState(false);
  useEscape(help !== "", () => setHelp(""));

  useEffect(() => {
    setInstalled(standalone());
    const fn = () => setInstalled(true);
    window.addEventListener("appinstalled", fn);
    return () => window.removeEventListener("appinstalled", fn);
  }, []);

  if (installed && !stores) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const r = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
      deferred = null;
      if (r.outcome === "accepted") toast(C.done);
      return;
    }
    setInterim(false);
    setHelp(isIOS() ? "ios" : "other");
  }

  /* Store-Knopf ohne Store-Eintrag: direkt installieren, passend zum Gerät */
  async function storeTap(which: "apple" | "google") {
    if (which === "google" && deferred) return install();
    setInterim(true);
    setHelp(which === "apple" ? "ios" : "android");
  }

  const badge = (which: "apple" | "google") => {
    const url = STORES[which];
    const top = url
      ? which === "apple"
        ? t("foot.appStoreTop")
        : t("foot.playTop")
      : which === "apple"
        ? C.soon
        : C.soonPlay;
    const name = which === "apple" ? "App Store" : "Google Play";
    const inner = (
      <>
        {which === "apple" ? <AppleMark /> : <PlayMark />}
        <span className="store-text">
          <small>{top}</small>
          <strong>{name}</strong>
        </span>
      </>
    );
    return url ? (
      <a key={which} className="store-badge" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${top} ${name}`}>
        {inner}
      </a>
    ) : (
      <button key={which} type="button" className="store-badge" aria-label={`${top} ${name}`} onClick={() => void storeTap(which)}>
        {inner}
      </button>
    );
  };

  return (
    <>
      {stores && <div className="store-row">{badge("apple")}{badge("google")}</div>}
      {/* In der Fußzeile nur die beiden Store-Knöpfe, ohne den Balken */}
      {!installed && !stores && (
      <button type="button" className={"install-app" + (compact ? " compact" : "")} onClick={() => void install()}>
        <img src="/icons/icon-96.webp" alt="" width={40} height={40} />
        <span>
          <b>{C.btn}</b>
          {!compact && <small>{C.sub}</small>}
        </span>
      </button>
      )}
      {help && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setHelp("")}>
          <div className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-h">
            <img src="/icons/icon-192.png" alt="" width={72} height={72} />
            <h2 id="install-h">{help === "ios" ? C.iosH : help === "android" ? C.andH : C.otherH}</h2>
            {interim && <p>{C.interim}</p>}
            {help === "android" ? (
              <p>{C.andP}</p>
            ) : help === "ios" ? (
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
