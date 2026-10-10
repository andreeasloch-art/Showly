import { useEffect, useState } from "react";

/** true nach dem ersten Rendern im Browser: Daten aus dem Browser-Speicher
 *  (eigene Locations, Warenkorb) erst dann zeigen, damit Server und Browser
 *  zunächst dasselbe ausgeben */
export function useHydrated() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return on;
}
