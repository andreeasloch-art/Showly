/* Eintritts-Animationen für die ganze Seite.
 *
 * Elemente mit dem Attribut data-reveal oder der Klasse reveal-stagger starten
 * unsichtbar und werden eingeblendet, sobald sie in den sichtbaren Bereich
 * scrollen. Die Gestaltung dazu steht in showly.css (Abschnitt "Bewegung").
 *
 * Zwei Dinge sind hier wichtig:
 * 1. Beim Seitenwechsel meldet der Router den neuen Pfad, bevor der Inhalt im
 *    Baum steht. Ein Effekt am Pfad allein griffe ins Leere und die neue Seite
 *    bliebe unsichtbar. Darum werden Änderungen am Baum mitverfolgt.
 * 2. Bereits gemeldete Elemente stehen in einem WeakSet, nicht in einem
 *    Attribut am Element. Ein zusätzliches Attribut würde React beim ersten
 *    Abgleich mit der Server-Fassung als Abweichung melden.
 *
 * Ohne JavaScript bleibt alles sichtbar: das Ausblenden hängt an
 * html[data-js="1"], und dieses Attribut setzt erst das Startskript. */
import { useEffect } from "react";

const SELECTOR = "[data-reveal],.reveal-stagger";
const SCAN_DELAY_MS = 60;
const GUARD_MS = 1200;

export function RevealWatcher() {
  useEffect(() => {
    const bound = new WeakSet<Element>();
    let scanTimer = 0;
    let guardTimer = 0;

    const show = (el: Element) => el.classList.add("is-in");

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                show(entry.target);
                io?.unobserve(entry.target);
              }
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
          );

    /* Sicherheitsnetz: Was kurz darauf immer noch verborgen ist, obwohl es im
       Fenster liegt, wird sichtbar gemacht. Greift zum Beispiel, wenn der
       Beobachter in einem ausgeblendeten Fenster nicht auslöst. */
    const armGuard = () => {
      window.clearTimeout(guardTimer);
      guardTimer = window.setTimeout(() => {
        document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
          if (el.classList.contains("is-in")) return;
          if (el.getBoundingClientRect().top < window.innerHeight) show(el);
        });
      }, GUARD_MS);
    };

    const scan = () => {
      scanTimer = 0;
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (bound.has(el)) return;
        bound.add(el);
        if (io) io.observe(el);
        else show(el);
      });
      if (io) armGuard();
    };

    /* Zeitgeber statt Bildrahmen: In einem ausgeblendeten Fenster hält der
       Browser die Bildrahmen an, der Zeitgeber läuft weiter. */
    const queueScan = () => {
      if (scanTimer) return;
      scanTimer = window.setTimeout(scan, SCAN_DELAY_MS);
    };

    scan();

    /* Zweites Sicherheitsnetz: Beim Scrollen ohne Ereignisse, etwa in einem
       Fenster im Hintergrund oder bei Sprüngen per Skript, meldet sich der
       Beobachter nicht zuverlässig. Alle 700 Millisekunden wird deshalb
       nachgesehen, was inzwischen im Fenster oder darüber liegt, und das wird
       sichtbar gemacht. So bleibt kein Inhalt dauerhaft ausgeblendet. */
    const sweep = window.setInterval(() => {
      const limit = window.innerHeight * 1.1;
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.classList.contains("is-in")) return;
        if (el.getBoundingClientRect().top < limit) show(el);
      });
    }, 700);

    const mo = new MutationObserver(queueScan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io?.disconnect();
      window.clearTimeout(scanTimer);
      window.clearTimeout(guardTimer);
      window.clearInterval(sweep);
    };
  }, []);

  return null;
}
