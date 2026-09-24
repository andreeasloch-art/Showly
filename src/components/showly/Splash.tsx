/* Startbild beim Öffnen der App, wie bei Kleinanzeigen: ein Foto mit
 * Künstlerinnen und Künstlern aus allen Sparten, in der Mitte das Logo.
 *
 * Es erscheint einmal pro App-Start (sessionStorage), steht zusammen mit dem
 * Ausblenden 3,5 Sekunden. Das Logo kommt dabei aus der Tiefe nach vorne:
 * klein, unscharf und durchsichtig, dann immer größer und klar. Ein Tippen schließt es sofort. Beim Wechsel
 * zwischen Seiten oder beim Neuladen innerhalb derselben Sitzung kommt es
 * nicht noch einmal.
 *
 * Das Bild wird schon auf dem Server mit ausgeliefert, damit es beim ersten
 * Aufbau sofort da ist und nicht erst die Startseite aufblitzt. */
import { useEffect, useState } from "react";

const KEY = "showly.splashShown";
const SHOW_MS = 3000;
const FADE_MS = 500;

/* Entscheidung einmal pro Seitenaufruf treffen. Der Effekt kann in der
   Entwicklung doppelt laufen; beim zweiten Mal stünde sonst schon "gezeigt"
   im Speicher und das Bild verschwände sofort. */
let showThisLoad: boolean | null = null;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    if (showThisLoad === null) {
      showThisLoad = true;
      try {
        showThisLoad = sessionStorage.getItem(KEY) !== "1";
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ohne Speicher einfach jedes Mal zeigen */
      }
    }
    if (!showThisLoad) {
      setPhase("gone");
      return;
    }
    const t1 = window.setTimeout(() => setPhase("fade"), SHOW_MS);
    const t2 = window.setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  function skip() {
    setPhase("fade");
    window.setTimeout(() => setPhase("gone"), FADE_MS);
  }

  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "fade" ? " out" : "")} onClick={skip} role="presentation" aria-hidden="true">
      <img className="splash-photo" src="/splash-acts.webp" alt="" decoding="async" fetchPriority="high" />
      <div className="splash-shade" />
      <div className="splash-logo">
        <img src="/splash-logo.webp" alt="Showly" />
      </div>
    </div>
  );
}
