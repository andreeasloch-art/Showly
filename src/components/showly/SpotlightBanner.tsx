import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  getSpotlightNear,
  daysLeft,
  subscribeSpotlights,
  trackSpotlightClick,
  clicksFor,
  type Spotlight,
} from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import stageImg from "@/assets/spotlight-stage.jpg";

const COPY = {
  de: {
    label: "Top Act der Woche",
    scope: (c: string) => `Für ${c} und Umgebung`,
    near: (c: string) => `In der Nähe von ${c}`,
    view: "Act ansehen",
    days: (n: number) => (n === 1 ? "noch 1 Tag online" : `noch ${n} Tage online`),
    info: "Bezahlte Platzierung",
    clicks: (n: number) => (n === 1 ? "1 Klick" : `${n} Klicks`),
  },
  en: {
    label: "Top act of the week",
    scope: (c: string) => `For ${c} and nearby`,
    near: (c: string) => `Near ${c}`,
    view: "View act",
    days: (n: number) => (n === 1 ? "1 day left online" : `${n} days left online`),
    info: "Paid placement",
    clicks: (n: number) => (n === 1 ? "1 click" : `${n} clicks`),
  },
  es: {
    label: "Top act de la semana",
    scope: (c: string) => `Para ${c} y alrededores`,
    near: (c: string) => `Cerca de ${c}`,
    view: "Ver act",
    days: (n: number) => (n === 1 ? "queda 1 día online" : `quedan ${n} días online`),
    info: "Colocación de pago",
    clicks: (n: number) => (n === 1 ? "1 clic" : `${n} clics`),
  },
} as const;

/** Breites Banner auf der Startseite – sichtbar, solange die Woche läuft. */
export function SpotlightBanner() {
  const { lang, catLabel } = useShowly() as any;
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const { city, country } = useViewerCity();
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [exact, setExact] = useState(true);
  const [clicks, setClicks] = useState(0);

  const refresh = useCallback(() => {
    const hit = getSpotlightNear(city, country);
    setSpot(hit?.spot ?? null);
    setExact(hit?.exact ?? true);
    setClicks(hit?.spot ? clicksFor(hit.spot.city, hit.spot.name) : 0);
  }, [city, country]);

  useEffect(() => {
    refresh();
    return subscribeSpotlights(refresh);
  }, [refresh]);

  if (!spot) return null;

  const catName = spot.cat ? (catLabel(spot.cat) as string) || spot.cat : "";
  const external = !!spot.link?.startsWith("http");

  function openAct(e: React.MouseEvent) {
    if (!spot?.link) return;
    trackSpotlightClick(spot.city || city || "", spot.name);
    if (external) return;
    e.preventDefault();
    navigate({ to: spot.link as any });
  }

  return (
    <section className="spot-banner" aria-label={T.label}>
      <a
        className="spot-banner-media"
        href={spot.link || "#"}
        onClick={(e) => (spot.link ? openAct(e) : e.preventDefault())}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        aria-label={`${T.view}: ${spot.name}`}
      >
        <img src={spot.image || stageImg} alt={spot.name} width={1280} height={720} />
      </a>
      <div className="spot-banner-body">
        <span className="spot-banner-label">
          <Icon name="trophy" /> {T.label}
        </span>
        <h2 className="spot-banner-name">
          {spot.link ? (
            <a
              href={spot.link}
              onClick={openAct}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
            >
              {spot.name}
            </a>
          ) : (
            spot.name
          )}
        </h2>
        <div className="spot-banner-meta">
          {catName && <span>{catName}</span>}
          {spot.city && (
            <span>
              <Icon name="pin" /> {spot.city}
            </span>
          )}
          <span>{T.days(daysLeft(spot))}</span>
          {city && <span>{exact ? T.scope(city) : T.near(city)}</span>}
          {clicks > 0 && <span>{T.clicks(clicks)}</span>}
        </div>
        {spot.tagline && <p className="spot-banner-tag">{spot.tagline}</p>}
        {spot.link && (
          <a
            className="spot-btn"
            href={spot.link}
            onClick={openAct}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {T.view}
          </a>
        )}
        <div className="spot-note">{T.info}</div>
      </div>
    </section>
  );
}
