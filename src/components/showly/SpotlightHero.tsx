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
  SPOTLIGHT_PRICE,
  type Spotlight,
} from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import stageImg from "@/assets/spotlight-stage.jpg";

const COPY = {
  de: {
    label: "Top Act der Woche",
    inCity: (c: string) => `in ${c}`,
    nearCity: (c: string) => `in der Nähe von ${c}`,
    freeCity: (c: string) => `Noch frei in ${c} und Umgebung`,
    freeName: "Dein Act – hier oben",
    freeTag: "Sichere dir den prominentesten Platz auf Showly. Sieben Tage lang ganz oben.",
    book: `Platz buchen · ${SPOTLIGHT_PRICE} €/Woche`,
    view: "Act ansehen",
    days: (n: number) => (n === 1 ? "noch 1 Tag" : `noch ${n} Tage`),
    info: "Bezahlte Platzierung",
    live: "Live auf der Startseite",
    pickH: "Stadt wählen",
    pickP: "Standort nicht freigegeben? Wähle deine Stadt aus der Liste.",
    useGeo: "Standort verwenden",
    change: "Stadt ändern",
    clicks: (n: number) => (n === 1 ? "1 Klick" : `${n} Klicks`),
  },
  en: {
    label: "Top act of the week",
    inCity: (c: string) => `in ${c}`,
    nearCity: (c: string) => `near ${c}`,
    freeCity: (c: string) => `Still available in ${c} and nearby`,
    freeName: "Your act – right here",
    freeTag: "Grab the most prominent spot on Showly. Seven days at the very top.",
    book: `Book this spot · €${SPOTLIGHT_PRICE}/week`,
    view: "View act",
    days: (n: number) => (n === 1 ? "1 day left" : `${n} days left`),
    info: "Paid placement",
    live: "Live on the homepage",
    pickH: "Choose your city",
    pickP: "Location not shared? Pick your city from the list.",
    useGeo: "Use my location",
    change: "Change city",
    clicks: (n: number) => (n === 1 ? "1 click" : `${n} clicks`),
  },
  es: {
    label: "Top act de la semana",
    inCity: (c: string) => `en ${c}`,
    nearCity: (c: string) => `cerca de ${c}`,
    freeCity: (c: string) => `Aún libre en ${c} y alrededores`,
    freeName: "Tu act – justo aquí",
    freeTag: "Consigue el lugar más visible de Showly. Siete días arriba del todo.",
    book: `Reservar este lugar · ${SPOTLIGHT_PRICE} €/semana`,
    view: "Ver act",
    days: (n: number) => (n === 1 ? "queda 1 día" : `quedan ${n} días`),
    info: "Colocación de pago",
    live: "En directo en la portada",
    pickH: "Elige tu ciudad",
    pickP: "¿Sin permiso de ubicación? Elige tu ciudad de la lista.",
    useGeo: "Usar mi ubicación",
    change: "Cambiar ciudad",
    clicks: (n: number) => (n === 1 ? "1 clic" : `${n} clics`),
  },
} as const;

export function SpotlightHero() {
  const { lang, catLabel, session } = useShowly() as any;
  const isArtist = session?.role === "artist";
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const { city, country, cities, needsPick, setCity, askLocation } = useViewerCity();
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [exact, setExact] = useState(true);
  const [clicks, setClicks] = useState(0);
  const [pick, setPick] = useState(false);

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

  const img = spot?.image || stageImg;
  const catName = spot?.cat ? (catLabel(spot.cat) as string) || spot.cat : "";
  const showPicker = pick || needsPick;

  function openAct(e: React.MouseEvent) {
    if (!spot?.link) return;
    trackSpotlightClick(spot.city || city || "", spot.name);
    if (spot.link.startsWith("http")) return; // externer Link öffnet normal
    e.preventDefault();
    navigate({ to: spot.link as any });
  }

  return (
    <div className="spot-card">
      <div className="spot-glow" aria-hidden="true" />
      <a
        className="spot-media"
        href={spot?.link || "#"}
        onClick={(e) => (spot?.link ? openAct(e) : e.preventDefault())}
        aria-label={spot ? `${T.view}: ${spot.name}` : T.label}
        target={spot?.link?.startsWith("http") ? "_blank" : undefined}
        rel={spot?.link?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        <img src={img} alt={spot?.name ?? ""} width={1280} height={960} />
        <span className="spot-label">
          <Icon name="trophy" /> {T.label}
        </span>
        {spot && <span className="spot-days">{T.days(daysLeft(spot))}</span>}
        {city && (
          <span className="spot-city">
            <Icon name="pin" /> {spot && !exact ? T.nearCity(city) : T.inCity(city)}
          </span>
        )}
      </a>
      <div className="spot-body">
        <div className="spot-name">
          {spot?.link ? (
            <a
              href={spot.link}
              onClick={openAct}
              target={spot.link.startsWith("http") ? "_blank" : undefined}
              rel={spot.link.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {spot.name}
            </a>
          ) : (
            (spot?.name ?? T.freeName)
          )}
        </div>
        <div className="spot-meta">
          {spot ? (
            <>
              {catName && <span>{catName}</span>}
              {spot.city && (
                <span>
                  <Icon name="pin" /> {spot.city}
                </span>
              )}
              {clicks > 0 && <span>{T.clicks(clicks)}</span>}
            </>
          ) : (
            <span>{city ? T.freeCity(city) : T.live}</span>
          )}
        </div>
        <p className="spot-tag">{spot ? spot.tagline : T.freeTag}</p>

        {showPicker ? (
          <div className="spot-pick">
            <strong>{T.pickH}</strong>
            <p>{T.pickP}</p>
            <div className="spot-pick-row">
              <select
                value={city ?? ""}
                aria-label={T.pickH}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPick(false);
                }}
              >
                <option value="" disabled>
                  {T.pickH}
                </option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="spot-btn ghost"
                onClick={() => askLocation().then(() => setPick(false))}
              >
                <Icon name="pin" /> {T.useGeo}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="spot-linkbtn" onClick={() => setPick(true)}>
            <Icon name="pin" /> {T.change}
          </button>
        )}

        <div className="spot-actions">
          {spot?.link ? (
            <a
              className="spot-btn"
              href={spot.link}
              onClick={openAct}
              target={spot.link.startsWith("http") ? "_blank" : undefined}
              rel={spot.link.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {T.view}
            </a>
          ) : null}
          {isArtist && (
            <button
              className="spot-btn ghost"
              onClick={() =>
                navigate({ to: "/top-act", search: city ? ({ city } as any) : ({} as any) })
              }
            >
              {T.book}
            </button>
          )}
        </div>
        <div className="spot-note">{T.info}</div>
      </div>
    </div>
  );
}
