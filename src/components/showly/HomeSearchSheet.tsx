/* Suche am Handy und Tablet im Hochformat, angelehnt an Airbnb:
 *
 *   oben klein der Umschalter Künstler | Locations,
 *   darunter eine schlichte Suchleiste „Jetzt suchen“.
 *
 * Tippt man darauf, öffnet sich die Suche bildschirmfüllend und Schritt für
 * Schritt: Was? (mit Vorschlägen) → Wann? (Kalender) → Wo? (Stadt). Unten
 * „Alles löschen“ und „Suchen“. Die Werte sind dieselben wie in der großen
 * Suchkarte am Computer; die Startseite reicht sie nur durch. */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useShowly } from "@/showly/store";
import { CATS } from "@/showly/data";
import { CatIcon, Icon } from "@/showly/ui";
import { VENUE_KINDS } from "@/showly/locations";
import { DateField } from "./DateField";
import { CityAutocomplete } from "./CityAutocomplete";

type Mode = "acts" | "locations";
type Step = "was" | "wann" | "wo";

const COPY = {
  de: {
    acts: "Künstler",
    venues: "Locations",
    search: "Jetzt suchen",
    searchVenue: "Location suchen",
    was: "Was?",
    wann: "Wann?",
    wo: "Wo?",
    whatPh: "z. B. Zauberer, DJ, Clown",
    whatPhV: "z. B. Hochzeitssaal, Spielplatz",
    any: "Alles",
    addDate: "Datum hinzufügen",
    addCity: "Ort hinzufügen",
    cityPh: "Stadt oder PLZ",
    clear: "Alles löschen",
    go: "Suchen",
    close: "Schließen",
    sugg: "Beliebt",
    skip: "Überspringen",
    next: "Weiter",
  },
  en: {
    acts: "Artists",
    venues: "Venues",
    search: "Start searching",
    searchVenue: "Find a venue",
    was: "What?",
    wann: "When?",
    wo: "Where?",
    whatPh: "e.g. magician, DJ, clown",
    whatPhV: "e.g. wedding hall, playground",
    any: "Anything",
    addDate: "Add date",
    addCity: "Add place",
    cityPh: "City or postcode",
    clear: "Clear all",
    go: "Search",
    close: "Close",
    sugg: "Popular",
    skip: "Skip",
    next: "Next",
  },
  es: {
    acts: "Artistas",
    venues: "Lugares",
    search: "Buscar ahora",
    searchVenue: "Buscar lugar",
    was: "¿Qué?",
    wann: "¿Cuándo?",
    wo: "¿Dónde?",
    whatPh: "p. ej. mago, DJ, payaso",
    whatPhV: "p. ej. salón, parque infantil",
    any: "Todo",
    addDate: "Añadir fecha",
    addCity: "Añadir lugar",
    cityPh: "Ciudad o CP",
    clear: "Borrar todo",
    go: "Buscar",
    close: "Cerrar",
    sugg: "Populares",
    skip: "Saltar",
    next: "Siguiente",
  },
} as const;

export interface HomeSearchProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  /* Künstler */
  cat: string;
  query: string;
  onPickCat: (id: string) => void;
  onQuery: (q: string) => void;
  /* Locations */
  venueKind?: string | undefined;
  venueQ: string;
  onPickKind: (id: string, label: string) => void;
  onVenueQ: (q: string) => void;
  /* gemeinsam */
  date: string;
  setDate: (d: string) => void;
  city: string;
  setCity: (c: string) => void;
  onClear: () => void;
  onSearch: () => void;
}

export function HomeSearch(p: HomeSearchProps) {
  const { lang, catLabel } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const L = (o: Record<string, string>) => o[lang] || o["de"] || "";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("was");

  /* Beim Öffnen hinten nicht mitscrollen */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const acts = p.mode === "acts";
  const whatText = acts
    ? p.query || (p.cat !== "all" ? catLabel(p.cat) : "")
    : p.venueQ;
  const datePretty = p.date
    ? new Date(p.date + "T00:00:00").toLocaleDateString(
        lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-GB",
        {
          weekday: "short",
          day: "numeric",
          month: "short",
        },
      )
    : "";
  const summary = [whatText, p.city.trim(), datePretty]
    .filter(Boolean)
    .join(" · ");

  /* Vorschläge unter „Was?“, gefiltert nach dem Eingetippten */
  const needle = (acts ? p.query : p.venueQ).trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (acts) {
      return CATS.filter((c: { id: string }) => c.id !== "all")
        .map((c: { id: string }) => ({
          id: c.id,
          label: catLabel(c.id),
          icon: null as string | null,
        }))
        .filter((c) => !needle || c.label.toLowerCase().includes(needle));
    }
    return VENUE_KINDS.map((k) => ({
      id: k.id,
      label: L(k.label as Record<string, string>),
      icon: k.icon as string | null,
    })).filter((k) => !needle || k.label.toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acts, needle, lang]);

  function openAt(s: Step) {
    setStep(s);
    setOpen(true);
  }
  function go() {
    setOpen(false);
    p.onSearch();
  }

  const Row = ({
    s,
    title,
    value,
    empty,
  }: {
    s: Step;
    title: string;
    value: string;
    empty: string;
  }) => (
    <button type="button" className="hs-row" onClick={() => setStep(s)}>
      <span className="hs-row-t">{title.replace("?", "")}</span>
      <span className={"hs-row-v" + (value ? " set" : "")}>
        {value || empty}
      </span>
    </button>
  );

  return (
    <div className="hs">
      {/* Kleiner Umschalter über der Leiste */}
      <div className="hs-mode" role="tablist">
        {(
          [
            ["acts", "mask", T.acts],
            ["locations", "venue", T.venues],
          ] as const
        ).map(([m, ic, txt]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={p.mode === m}
            className={"hs-mode-btn" + (p.mode === m ? " on" : "")}
            onClick={() => p.setMode(m)}
          >
            <Icon name={ic} /> {txt}
          </button>
        ))}
      </div>

      {/* Die schlichte Suchleiste */}
      <button
        type="button"
        className="hs-pill"
        onClick={() => openAt("was")}
        aria-haspopup="dialog"
      >
        <Icon name="search" />
        <span className={"hs-pill-txt" + (summary ? " set" : "")}>
          {summary || (acts ? T.search : T.searchVenue)}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="hs-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={acts ? T.search : T.searchVenue}
          >
            <div className="hs-top">
              <div className="hs-tabs" role="tablist">
                {(
                  [
                    ["acts", "mask", T.acts],
                    ["locations", "venue", T.venues],
                  ] as const
                ).map(([m, ic, txt]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={p.mode === m}
                    className={"hs-tab" + (p.mode === m ? " on" : "")}
                    onClick={() => {
                      p.setMode(m);
                      setStep("was");
                    }}
                  >
                    <span className="hs-tab-ic">
                      <Icon name={ic} />
                    </span>
                    <span>{txt}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hs-close"
                onClick={() => setOpen(false)}
                aria-label={T.close}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="hs-body">
              {/* Schritt 1: Was? */}
              {step === "was" ? (
                <section className="hs-card">
                  <h2>{T.was}</h2>
                  <label className="hs-input">
                    <Icon name="search" />
                    <input
                      autoFocus
                      value={
                        acts
                          ? p.query || (p.cat !== "all" ? catLabel(p.cat) : "")
                          : p.venueQ
                      }
                      onChange={(e) =>
                        acts
                          ? p.onQuery(e.target.value)
                          : p.onVenueQ(e.target.value)
                      }
                      placeholder={acts ? T.whatPh : T.whatPhV}
                      enterKeyHint="next"
                      onKeyDown={(e) => e.key === "Enter" && setStep("wann")}
                    />
                  </label>
                  <div className="hs-sugg-h">{T.sugg}</div>
                  <ul className="hs-sugg">
                    {suggestions.slice(0, 12).map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (acts) p.onPickCat(s.id);
                            else p.onPickKind(s.id, s.label);
                            setStep("wann");
                          }}
                        >
                          <span className="hs-sugg-ic">
                            {s.icon ? (
                              <Icon name={s.icon} />
                            ) : (
                              <CatIcon id={s.id} />
                            )}
                          </span>
                          <span>{s.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <Row s="was" title={T.was} value={whatText} empty={T.any} />
              )}

              {/* Schritt 2: Wann? */}
              {step === "wann" ? (
                <section className="hs-card">
                  <h2>{T.wann}</h2>
                  <DateField
                    inline
                    value={p.date}
                    label={T.wann}
                    onChange={(d) => {
                      p.setDate(d);
                      if (d) setStep("wo");
                    }}
                  />
                  <div className="hs-card-foot">
                    <button
                      type="button"
                      className="hs-link"
                      onClick={() => setStep("wo")}
                    >
                      {p.date ? T.next : T.skip}
                    </button>
                  </div>
                </section>
              ) : (
                <Row
                  s="wann"
                  title={T.wann}
                  value={datePretty}
                  empty={T.addDate}
                />
              )}

              {/* Schritt 3: Wo? */}
              {step === "wo" ? (
                <section className="hs-card">
                  <h2>{T.wo}</h2>
                  <div className="hs-input hs-city">
                    <Icon name="pin" />
                    <CityAutocomplete
                      value={p.city}
                      onChange={p.setCity}
                      placeholder={T.cityPh}
                      onSelect={() => undefined}
                    />
                  </div>
                </section>
              ) : (
                <Row
                  s="wo"
                  title={T.wo}
                  value={p.city.trim()}
                  empty={T.addCity}
                />
              )}
            </div>

            <div className="hs-foot">
              <button type="button" className="hs-clear" onClick={p.onClear}>
                {T.clear}
              </button>
              <button type="button" className="hs-go" onClick={go}>
                <Icon name="search" /> {T.go}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
