/* Location der Woche im Kopfbereich der Startseite, wenn oben „Locations“
 * gewählt ist. Gleicher Aufbau wie „Act der Woche“ (ActOfWeek.tsx): fünf
 * Karten, alle fünf Sekunden die nächste, Balken zum Springen.
 *
 * Zuerst die gebuchten „Locations der Woche“ (bis zu fünf je Stadt, 99 € je
 * Woche, als Anzeige gekennzeichnet), dann füllt die Wochenauswahl auf. */
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { DemoBadge } from "@/components/showly/DemoBadge";
import { getSpotlightsNear, loadCloudSpotlights, subscribeSpotlights, SPOTLIGHT_SLOTS, type Spotlight } from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import { capacityOf, kindOf, type Venue } from "@/showly/locations";
import { VENUES } from "@/showly/venues";
import { label, priceText, useVenueCopy, venueBg } from "./Venue";

const COPY = {
  de: { label: "Location der Woche", top: "Locations der Woche", paid: "Location · Anzeige", of: (i: number, n: number) => `Location ${i} von ${n}`, view: "Ansehen" },
  en: { label: "Venue of the week", top: "Venues of the week", paid: "Venue · Ad", of: (i: number, n: number) => `Venue ${i} of ${n}`, view: "View" },
  es: { label: "Lugar de la semana", top: "Lugares de la semana", paid: "Lugar · Anuncio", of: (i: number, n: number) => `Lugar ${i} de ${n}`, view: "Ver" },
} as const;

const SHOW_MS = 5000;

/** Wochenauswahl: wechselt jede Kalenderwoche (UTC), für Server und Browser gleich */
function picksForWeek(): Venue[] {
  const pool = [...VENUES].sort((a, b) => a.id - b.id);
  if (pool.length <= SPOTLIGHT_SLOTS) return pool;
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  const start = (week * SPOTLIGHT_SLOTS) % pool.length;
  return Array.from({ length: SPOTLIGHT_SLOTS }, (_, k) => pool[(start + k) % pool.length]!);
}

type Slide = { key: string; venue: Venue; paid: boolean };

const venueOfSpot = (sp: Spotlight) =>
  VENUES.find((v) => (sp.venueId && v.id === sp.venueId) || (sp.link && sp.link === `/locations/${v.id}`)) ?? null;

export function VenueOfWeek() {
  const { lang, fmt } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const V = useVenueCopy();
  const weekly = useMemo(picksForWeek, []);
  const { city, country } = useViewerCity();
  const [spots, setSpots] = useState<Spotlight[]>([]);

  useEffect(() => {
    void loadCloudSpotlights();
    const load = () => setSpots(getSpotlightsNear(city, country, "location").map((h) => h.spot));
    load();
    return subscribeSpotlights(load);
  }, [city, country]);

  const picks = useMemo<Slide[]>(() => {
    const paid = spots
      .map((sp) => venueOfSpot(sp))
      .filter((v): v is Venue => !!v)
      .map((v) => ({ key: "top-" + v.id, venue: v, paid: true }));
    const taken = new Set(paid.map((p) => p.venue.id));
    const fill = weekly.filter((v) => !taken.has(v.id)).map((v) => ({ key: "v-" + v.id, venue: v, paid: false }));
    return [...paid, ...fill].slice(0, SPOTLIGHT_SLOTS);
  }, [spots, weekly]);
  const n = picks.length;
  const hasPaid = picks.some((p) => p.paid);

  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const elapsed = useRef(0);

  useEffect(() => {
    setCur(0);
    setPrev(null);
    elapsed.current = 0;
  }, [n, hasPaid]);

  function go(next: number) {
    if (next === cur) return;
    elapsed.current = 0;
    setPrev(cur);
    setCur(next);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    if (n < 3) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (paused || document.hidden) return;
      elapsed.current += delta;
      if (elapsed.current >= SHOW_MS) {
        elapsed.current = 0;
        setCur((c) => {
          setPrev(c);
          return (c + 1) % n;
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [paused, n]);

  return (
    <div
      className={"aotw vnotw" + (paused ? " paused" : "") + (still ? " still-all" : "")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="aotw-head">
        <span className="aotw-label">
          <Icon name="venue" /> {hasPaid ? C.top : C.label}
        </span>
        <div className="aotw-bars">
          {picks.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className={"aotw-bar" + (i < cur ? " done" : "") + (i === cur ? " on" : "")}
              onClick={() => go(i)}
              aria-label={C.of(i + 1, n)}
              aria-current={i === cur}
            >
              <i key={i === cur ? "run-" + cur : "idle"} />
            </button>
          ))}
        </div>
      </div>

      <div className="aotw-stage">
        {picks.map((p, i) => {
          const slot = i === cur ? 0 : i === prev ? 1 : -1;
          const v = p.venue;
          const k = kindOf(v.kind);
          const pr = priceText(v, fmt, V);
          const cap = Math.max(capacityOf(v), ...v.packages.map((x) => x.maxGuests));
          return (
            <Link
              key={p.key}
              to="/locations/$id"
              params={{ id: String(v.id) }}
              className={"aotw-card" + (slot === -1 ? " wait" : "")}
              style={{ ["--slot" as string]: slot }}
              tabIndex={slot === 0 ? 0 : -1}
              aria-hidden={slot !== 0}
            >
              <span className="aotw-img" style={venueBg(v)}>
                <span className="aotw-chip">
                  <Icon name={k.icon} /> {label(k, lang)}
                </span>
                {p.paid && (
                  <span className="aotw-chip gold">
                    <Icon name="trophy" /> {C.paid}
                  </span>
                )}
                {v.demo && !p.paid && <DemoBadge className="on-card" />}
              </span>
              <span className="aotw-body">
                <span className="aotw-row">
                  <b className="aotw-name">{v.name}</b>
                  <span className="aotw-rating">{V.isNew}</span>
                </span>
                <span className="aotw-meta">
                  <Icon name="pin" /> {[v.district, v.city].filter(Boolean).join(", ")}
                  {cap > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Icon name="users" /> {V.upTo(cap)}
                    </>
                  )}
                </span>
                <span className="aotw-desc">{v.tagline}</span>
                <span className="aotw-foot">
                  <span className="aotw-price">
                    <small>{pr.from} </small>
                    <b>{pr.price}</b> <small>{pr.unit}</small>
                  </span>
                  <span className="aotw-go">
                    {C.view} <Icon name="arrow" />
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
