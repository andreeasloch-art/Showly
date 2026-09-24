/* Startbild beim Öffnen der App, wie bei Kleinanzeigen: ein Foto mit
 * Künstlerinnen und Künstlern aus allen Sparten, in der Mitte das Logo.
 *
 * Es erscheint einmal pro App-Start (sessionStorage), bleibt gut 3 Sekunden
 * stehen und blendet dann aus. Ein Tippen schließt es sofort. Beim Wechsel
 * zwischen Seiten oder beim Neuladen innerhalb derselben Sitzung kommt es
 * nicht noch einmal.
 *
 * Das Bild wird schon auf dem Server mit ausgeliefert, damit es beim ersten
 * Aufbau sofort da ist und nicht erst die Startseite aufblitzt. */
import { useEffect, useState } from "react";

const KEY = "showly.splashShown";
const SHOW_MS = 3400;
const FADE_MS = 550;

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ohne Speicher einfach jedes Mal zeigen */
    }
    if (seen) {
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
        <img src="/logo-showly@2x.png" alt="Showly" />
      </div>
    </div>
  );
}
