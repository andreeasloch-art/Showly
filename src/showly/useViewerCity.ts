import { useCallback, useEffect, useState } from "react";
import {
  countryForCity,
  detectCity,
  detectCountry,
  forgetCity,
  geoCity,
  geoPermission,
  nearbyCities,
  rememberCity,
  requestGeoCity,
  savedCity,
} from "./country";

export type GeoState = "idle" | "asking" | "granted" | "denied" | "unavailable";

/**
 * Stadt des Besuchers: gespeicherte Wahl, sonst Zeitzone/Land, optional per
 * GPS genauer. Wird der Standort abgelehnt, liefert `cities` eine Liste
 * nahegelegener Städte zur manuellen Auswahl.
 */
export function useViewerCity() {
  const [city, setCityState] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const c = detectCity();
    setCityState(c);
    setCountry(detectCountry());
    setManual(!!savedCity());
    let alive = true;
    geoPermission().then((p) => {
      if (!alive) return;
      if (p === "unavailable") setGeo("unavailable");
      else if (p === "denied") setGeo("denied");
      else if (p === "granted") setGeo("granted");
    });
    geoCity()
      .then((g) => {
        if (alive && g) {
          setCityState(g);
          setCountry(countryForCity(g) ?? detectCountry());
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** Stadt manuell wählen (Fallback ohne Standortfreigabe). */
  const setCity = useCallback((next: string) => {
    const v = (next || "").trim();
    if (!v) return;
    rememberCity(v);
    setCityState(v);
    setCountry(countryForCity(v) ?? detectCountry());
    setManual(true);
  }, []);

  /** Auswahl zurücksetzen (wieder automatisch erkennen). */
  const resetCity = useCallback(() => {
    forgetCity();
    setManual(false);
    setCityState(detectCity());
    setCountry(detectCountry());
  }, []);

  /** Standort aktiv anfragen – nur auf Nutzerklick. */
  const askLocation = useCallback(async () => {
    setGeo("asking");
    const c = await requestGeoCity();
    if (c) {
      setCityState(c);
      setCountry(countryForCity(c) ?? detectCountry());
      setManual(true);
      setGeo("granted");
      return c;
    }
    setGeo("denied");
    return null;
  }, []);

  const cities = nearbyCities(country as any, city);
  const needsPick = !city || geo === "denied" || geo === "unavailable";

  return { city, country, cities, geo, manual, needsPick, setCity, resetCity, askLocation };
}
