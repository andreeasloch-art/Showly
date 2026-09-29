import { useEffect } from "react";

/** Fenster mit der Escape-Taste schließen (Tastaturbedienung, BFSG) */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [active, onEscape]);
}
