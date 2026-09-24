/* Setzt eine Klasse auf die Kopfzeile, sobald die Seite gescrollt ist.
 * Liegt in einer eigenen Datei, weil eine Datei mit Komponente und Hook
 * gemischt das schnelle Neuladen im Entwicklungsmodus aushebelt. */
import { useEffect } from "react";

export function useScrolled(threshold = 12) {
  useEffect(() => {
    const nav = document.querySelector("nav");
    if (!nav) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      nav.classList.toggle("is-scrolled", window.scrollY > threshold);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
}
