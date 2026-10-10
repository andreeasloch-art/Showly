import { seoHeadDe } from "@/showly/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, todayISO } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { DateField } from "@/components/showly/DateField";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { VenueAutocomplete, VenueCard, VenueVisual, label, useVenueCopy } from "@/components/showly/Venue";
import { OCCASIONS, VENUE_GROUPS, VENUE_KINDS, kindOf, matchVenue } from "@/showly/locations";
import { VENUES } from "@/showly/venues";
import { useHydrated } from "@/showly/useHydrated";

type Search = {
  q?: string | undefined;
  typ?: string | undefined;
  gruppe?: string | undefined;
  anlass?: string | undefined;
  stadt?: string | undefined;
  datum?: string | undefined;
  gaeste?: number | undefined;
};

export const Route = createFileRoute("/locations/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const str = (k: string, max = 60) => (typeof s[k] === "string" && s[k] ? String(s[k]).slice(0, max) : undefined);
    const g = Number(s["gaeste"]);
    return {
      ...(str("q") ? { q: str("q") } : {}),
      ...(str("typ") && VENUE_KINDS.some((k) => k.id === s["typ"]) ? { typ: str("typ") } : {}),
      ...(str("gruppe") && VENUE_GROUPS.some((k) => k.id === s["gruppe"]) ? { gruppe: str("gruppe") } : {}),
      ...(str("anlass") && OCCASIONS.some((k) => k.id === s["anlass"]) ? { anlass: str("anlass") } : {}),
      ...(str("stadt") ? { stadt: str("stadt") } : {}),
      ...(str("datum", 10) && /^\d{4}-\d{2}-\d{2}$/.test(String(s["datum"])) ? { datum: str("datum", 10) } : {}),
      ...(g > 0 && g <= 2000 ? { gaeste: Math.round(g) } : {}),
    };
  },
  head: () =>
    seoHeadDe(
      "/locations",
      "Event-Locations mieten – Indoor-Spielplatz, Saal, Restaurant | Showly",
      "Locations für Kindergeburtstag, Hochzeit und Firmenfeier: Indoor-Spielplätze, Wasserparks, Säle und Restaurants mit freien Terminen, Festpreis und sicherer Zahlung.",
    ),
  component: Locations,
});

function Locations() {
  const { lang } = useShowly();
  const C = useVenueCopy();
  const navigate = useNavigate({ from: "/locations/" });
  const search = Route.useSearch();
  const hydrated = useHydrated();
  const [text, setText] = useState(search.q ?? (search.typ ? label(kindOf(search.typ), lang) : ""));
  const [city, setCity] = useState(search.stadt ?? "");
  const [date, setDate] = useState(search.datum ?? "");
  const [guests, setGuests] = useState(search.gaeste ? String(search.gaeste) : "");
  useEffect(() => setCity(search.stadt ?? ""), [search.stadt]);

  const set = (patch: Partial<Search>) =>
    navigate({ search: (s: Search) => Object.fromEntries(Object.entries({ ...s, ...patch }).filter(([, v]) => v !== undefined && v !== "")) as Search, replace: true });

  const today = todayISO();
  /* Eigene, im Browser angelegte Locations kommen erst nach dem Laden dazu */
  const list = useMemo(
    () =>
      VENUES.filter((v) =>
        matchVenue(
          v,
          {
            q: search.q,
            kind: search.typ,
            group: search.gruppe,
            occasion: search.anlass,
            city: search.stadt,
            guests: search.gaeste,
            date: search.datum,
          },
          today,
        ),
      ).sort((a, b) => Number(!!a.demo) - Number(!!b.demo) || b.rating - a.rating),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, today, hydrated],
  );
  const filtered = Object.keys(search).length > 0;

  function scrollToGrid() {
    setTimeout(() => document.querySelector(".vn-grid-head")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
  function submit() {
    const q = text.trim();
    const kindHit = VENUE_KINDS.find((k) => label(k, lang).toLowerCase() === q.toLowerCase());
    set({
      q: kindHit ? undefined : q || undefined,
      typ: kindHit ? kindHit.id : search.typ && q === label(kindOf(search.typ), lang) ? search.typ : undefined,
      stadt: city.trim() || undefined,
      datum: date || undefined,
      gaeste: Number(guests) > 0 ? Number(guests) : undefined,
    });
    scrollToGrid();
  }
  function reset() {
    setText("");
    setCity("");
    setDate("");
    setGuests("");
    navigate({ search: {}, replace: true });
  }

  return (
    <div className="page active ui26 vn-page">
      <section className="vn-hero">
        <div className="vn-hero-inner">
          <span className="home-eyebrow on-color rise" style={{ ["--d" as string]: "40ms" }}>
            <Icon name="venue" /> {C.eyebrow}
          </span>
          <h1 className="vn-h1 rise" style={{ ["--d" as string]: "80ms" }}>
            {C.h1a} <span className="vn-h1-grad">{C.h1b}</span>
          </h1>
          <p className="vn-lead rise" style={{ ["--d" as string]: "140ms" }}>
            {C.lead}
          </p>

          <div className="search-wrap home-search vn-search rise" style={{ ["--d" as string]: "200ms" }}>
            <div className="search-field" style={{ flex: 1.5 }}>
              <Icon name="search" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="search-field-lbl">{C.what}</div>
                <VenueAutocomplete
                  value={text}
                  onChange={setText}
                  placeholder={C.whatPh}
                  onPick={(s) => {
                    if (s.type === "venue") {
                      void navigate({ to: "/locations/$id", params: { id: s.id } });
                      return;
                    }
                    set(s.type === "kind" ? { typ: s.id, q: undefined } : { anlass: s.id, q: undefined });
                    if (s.type === "occasion") setText("");
                    scrollToGrid();
                  }}
                />
              </div>
            </div>
            <div className="search-divider" />
            <div className="search-field" style={{ flex: 1 }}>
              <span className="book-icon">
                <Icon name="calendar" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DateField value={date} onChange={(d) => { setDate(d); set({ datum: d || undefined }); }} label={C.when} />
              </div>
            </div>
            <div className="search-divider" />
            <div className="search-field vn-guests-field" style={{ flex: 0.6 }}>
              <Icon name="users" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="search-field-lbl">{C.guests}</div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={2000}
                  value={guests}
                  placeholder="20"
                  onChange={(e) => setGuests(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => set({ gaeste: Number(guests) > 0 ? Number(guests) : undefined })}
                />
              </div>
            </div>
            <div className="search-divider" />
            <div className="search-field" style={{ flex: 1 }}>
              <Icon name="pin" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="search-field-lbl">{C.where}</div>
                <CityAutocomplete
                  value={city}
                  onChange={setCity}
                  placeholder={C.wherePh}
                  onSelect={(v) => {
                    set({ stadt: v || undefined });
                    scrollToGrid();
                  }}
                />
              </div>
            </div>
            <button className="search-btn" onClick={submit}>
              <span>{C.search}</span>
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      </section>

      <div className="home-browse vn-browse">
        <nav className="cat-bar" aria-label={C.kinds}>
          <div className="cat-bar-inner">
            <button className={"cat-chip" + (!search.gruppe && !search.typ ? " on" : "")} onClick={() => set({ gruppe: undefined, typ: undefined })}>
              <Icon name="venue" />
              <span>{C.all}</span>
            </button>
            {VENUE_GROUPS.map((g) => (
              <button
                key={g.id}
                className={"cat-chip" + (search.gruppe === g.id ? " on" : "")}
                aria-pressed={search.gruppe === g.id}
                onClick={() => set({ gruppe: search.gruppe === g.id ? undefined : g.id, typ: undefined })}
              >
                <Icon name={g.icon} />
                <span>{label(g, lang)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="occ-row vn-occ-row" role="group" aria-label={C.occasions}>
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              className={"occ-chip" + (search.anlass === o.id ? " on" : "")}
              aria-pressed={search.anlass === o.id}
              onClick={() => set({ anlass: search.anlass === o.id ? undefined : o.id })}
            >
              {label(o, lang)}
            </button>
          ))}
        </div>

        <div className="home-grid-head vn-grid-head">
          <h2>
            {search.typ ? label(kindOf(search.typ), lang) : C.results(list.length)}
            {search.typ && <small> · {C.results(list.length)}</small>}
          </h2>
          {filtered && (
            <button className="home-reset" onClick={reset}>
              {C.reset}
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <div className="empty-state">
            <div className="ic">
              <Icon name="venue" />
            </div>
            <p>{C.none}</p>
            <button className="btn-secondary" onClick={reset}>
              {C.reset}
            </button>
          </div>
        ) : (
          <div className="vn-grid">
            {list.map((v) => (
              <VenueCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </div>

      <section className="home-join vn-join">
        <div className="home-join-card">
          <div className="home-join-text">
            <span className="home-eyebrow on-dark">{C.eyebrow}</span>
            <h2>{C.offerH}</h2>
            <p>{C.offerP}</p>
            <div className="home-join-btns">
              <button className="home-btn light" onClick={() => navigate({ to: "/locations/anbieten" })}>
                {C.offerBtn} <Icon name="arrow" />
              </button>
            </div>
          </div>
          <div className="home-join-art vn-join-art" aria-hidden="true">
            {VENUES.slice(0, 3).map((v, k) => (
              <span className={"home-join-tile t" + k} key={v.id}>
                <VenueVisual v={v} />
              </span>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
