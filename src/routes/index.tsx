import { rankingPenalty } from "@/showly/policies";
import { headLang, seoHead } from "@/showly/seo";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { ARTISTS, CATS } from "@/showly/data";
import { CatIcon, Icon, bgOf } from "@/showly/ui";
import { ArtistCard, matchArtist } from "@/components/showly/ArtistCard";
import { Footer } from "@/components/showly/Footer";
import { GradientText } from "@/components/showly/GradientText";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { ArtistAutocomplete } from "@/components/showly/ArtistAutocomplete";
import { DateField } from "@/components/showly/DateField";
import { CountUp } from "@/components/showly/ImageWall";
import { ActOfWeek } from "@/components/showly/ActOfWeek";
import { HeroReel } from "@/components/showly/HeroReel";
import { StageLight } from "@/components/showly/Motion";
import { GuaranteeSection } from "@/components/showly/Guarantee";
import { guaranteeCopy } from "@/showly/guarantee";
import { VenueAutocomplete, VenueCard, label as vLabel, useVenueCopy } from "@/components/showly/Venue";
import { VenueOfWeek } from "@/components/showly/VenueOfWeek";
import { VENUES } from "@/showly/venues";
import { OCCASIONS, VENUE_GROUPS, matchVenue } from "@/showly/locations";
import { todayISO } from "@/showly/ui";
import { VENUE_KINDS } from "@/showly/locations";

export const Route = createFileRoute("/")({
  /* ?zeige=kuenstler kommt vom Reiter "Künstler" unten: Acts wählen und zur Liste springen */
  validateSearch: (search: Record<string, unknown>): { zeige?: "kuenstler" } =>
    search["zeige"] === "kuenstler" ? { zeige: "kuenstler" } : {},
  head: (ctx) => seoHead("/", "/", headLang(ctx)),
  component: Home,
});

/* Texte, die es nur auf dieser Seite gibt. */
const COPY = {
  de: {
    pill: (n: number) => (n > 0 ? `${n} geprüfte Acts · Festpreise · sichere Zahlung` : "Festpreise · sichere Zahlung · ausweisgeprüfte Anbieter"),
    facts: "Showly in Zahlen",
    acts: "Acts auf Showly",
    cats: "Sparten",
    rating: (n: string) => `Ø Bewertung aus ${n} Stimmen`,
    cities: "Städte",
    joinEyebrow: "Für Künstler",
    moreEyebrow: "Mehr für dein Event",
    more: (n: number) => `${n} weitere zeigen`,
    moreH: "Alles für dein Event an einem Ort",
    moreP: "Kostüme, Deko und Torten gleich mit dazu.",
    tiles: [
      ["Kostüme", "Mieten oder kaufen"],
      ["Deko", "Ballons, Lichter, Tischdeko"],
      ["Torten & Süßes", "Von Konditoreien und Privatbäckern"],
    ],
  },
  en: {
    pill: (n: number) => (n > 0 ? `${n} verified acts · fixed prices · secure payment` : "Fixed prices · secure payment · ID-checked providers"),
    facts: "Showly in numbers",
    acts: "Acts on Showly",
    cats: "Categories",
    rating: (n: string) => `Average rating from ${n} reviews`,
    cities: "Cities",
    joinEyebrow: "For artists",
    moreEyebrow: "More for your event",
    more: (n: number) => `Show ${n} more`,
    moreH: "Everything for your event in one place",
    moreP: "Add costumes, decor and cakes too.",
    tiles: [
      ["Costumes", "Rent or buy"],
      ["Decor", "Balloons, lights, table decor"],
      ["Cakes & sweets", "From patisseries and home bakers"],
    ],
  },
  es: {
    pill: (n: number) => (n > 0 ? `${n} acts verificados · precios fijos · pago seguro` : "Precios fijos · pago seguro · proveedores con identidad verificada"),
    facts: "Showly en cifras",
    acts: "Acts en Showly",
    cats: "Categorías",
    rating: (n: string) => `Valoración media de ${n} opiniones`,
    cities: "Ciudades",
    joinEyebrow: "Para artistas",
    moreEyebrow: "Más para tu evento",
    more: (n: number) => `Ver ${n} más`,
    moreH: "Todo para tu evento en un solo lugar",
    moreP: "Añade también disfraces, decoración y tartas.",
    tiles: [
      ["Disfraces", "Alquilar o comprar"],
      ["Decoración", "Globos, luces, mesa"],
      ["Tartas y dulces", "De pastelerías y particulares"],
    ],
  },
} as const;

function Home() {
  const { t, L, num, lang, catLabel, standing } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  /* Suche nach Acts oder nach Locations */
  const [mode, setMode] = useState<"acts" | "locations">("acts");
  const V = useVenueCopy();
  const [venueQ, setVenueQ] = useState("");
  const [venueKind, setVenueKind] = useState<string | undefined>();
  const [venueOcc, setVenueOcc] = useState<string | undefined>();
  const [venueGroup, setVenueGroup] = useState<string | undefined>();
  const venueList = useMemo(
    () =>
      VENUES.filter((v) =>
        matchVenue(
          v,
          {
            kind: venueKind,
            group: venueGroup,
            occasion: venueOcc,
            q: !venueKind && !venueOcc && venueQ.trim() ? venueQ.trim() : undefined,
            city: city.trim() || undefined,
            date: date || undefined,
          },
          todayISO(),
        ),
      ).sort((a, b) => Number(!!a.demo) - Number(!!b.demo) || b.rating - a.rating),
    [venueKind, venueGroup, venueOcc, venueQ, city, date],
  );
  const venueFiltered = !!(venueKind || venueGroup || venueOcc || venueQ.trim() || city.trim() || date);
  function resetVenues() {
    setVenueKind(undefined);
    setVenueGroup(undefined);
    setVenueOcc(undefined);
    setVenueQ("");
    setCity("");
    setDate("");
  }
  function searchVenues(over: { typ?: string | undefined; anlass?: string | undefined } = {}) {
    const typ = over.typ ?? venueKind;
    const anlass = over.anlass ?? venueOcc;
    const q = !typ && !anlass ? venueQ.trim() : "";
    void navigate({
      to: "/locations",
      search: {
        ...(typ ? { typ } : {}),
        ...(anlass ? { anlass } : {}),
        ...(q ? { q } : {}),
        ...(city.trim() ? { stadt: city.trim() } : {}),
        ...(date ? { datum: date } : {}),
      },
    });
  }
  /* Erst zwölf Profile, der Rest auf Wunsch: die Seite wird kürzer */
  const [shown, setShown] = useState(12);

  const list = useMemo(
    () =>
      ARTISTS.filter(
        (a) =>
          /* Gesperrte oder entfernte Profile nicht zeigen (AGB § 23) */
          standing(a.id).bookable &&
          matchArtist(a, {
            cat,
            query: query.trim().toLowerCase(),
            city: city.trim().toLowerCase(),
            L,
            catLabel,
          }),
      )
        /* Nach einem Verstoß 30 Tage weiter unten (AGB § 23); eine hohe
           Stornoquote kostet zusätzlich Plätze (policies.ts) */
        .sort(
          (x, y) =>
            Number(standing(x.id).demoted) - Number(standing(y.id).demoted) ||
            rankingPenalty(x.cancelRate ?? 0) - rankingPenalty(y.cancelRate ?? 0),
        ),
    [cat, query, city, L, catLabel, standing],
  );
  const filtered = cat !== "all" || query || city;
  useEffect(() => setShown(12), [cat, query, city]);

  /* Kennzahlen aus den echten Daten. Vorher standen hier feste Werte wie
     "2.400+ Künstler" und "18.700+ Events", bei 25 Profilen auf der Seite.
     Solche Zahlen fallen Kunden auf und sind im Wettbewerbsrecht heikel. */
  /* Beispielprofile zählen nicht mit: Zahlen nur aus echten Profilen. */
  const facts = useMemo(() => {
    const real = ARTISTS.filter((a) => !a.demo);
    const reviews = real.reduce((s, a) => s + (a.reviews || 0), 0);
    const rating = reviews ? real.reduce((s, a) => s + a.rating * (a.reviews || 0), 0) / reviews : 0;
    const cities = new Set(real.map((a) => String(L(a.loc)))).size;
    const cats = CATS.filter((c) => c.id !== "all").length;
    const verified = real.filter((a) => a.verified).length;
    return { acts: real.length, reviews, rating, cities, cats, verified };
  }, [L]);

  const { zeige } = Route.useSearch();
  useEffect(() => {
    if (zeige !== "kuenstler") return;
    setMode("acts");
    const id = setTimeout(scrollToGrid, 150);
    return () => clearTimeout(id);
  }, [zeige]);

  function scrollToGrid() {
    if (typeof document === "undefined") return;
    document.querySelector(".grid-head")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickCat(id: string) {
    /* Kam die Kategorie aus dem Suchfeld, steht dort noch ihr Name. Bei
       einer anderen Kategorie würde er alles wegfiltern. */
    if (catFromSearch.current) {
      catFromSearch.current = false;
      setQuery("");
    }
    setCat(id);
    setTimeout(scrollToGrid, 60);
  }

  /* Vorschlag im Suchfeld: Kategorie setzen, aber nicht wegscrollen, damit
     man danach noch Datum und Ort eintragen kann. */
  const catFromSearch = useRef(false);
  function pickCatFromSearch(id: string) {
    catFromSearch.current = true;
    setCat(id);
    /* wie bei der Stadt: gleich zu den Treffern, sonst passiert am Handy
       sichtbar nichts */
    setTimeout(scrollToGrid, 60);
  }
  /* Tippt man nach der Auswahl weiter, gilt wieder nur der Text */
  function typeQuery(v: string) {
    if (catFromSearch.current) {
      catFromSearch.current = false;
      setCat("all");
    }
    setQuery(v);
  }

  /* Aus dem Shop führt "Künstler in dieser Kategorie" auf /#fairy und
     ähnliche Adressen. Die Kategorie hinter dem # wird hier gewählt und das
     Raster angesprungen; vorher landete man einfach oben auf der Startseite. */
  useEffect(() => {
    const apply = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && CATS.some((c) => c.id === id)) {
        setCat(id);
        setTimeout(scrollToGrid, 120);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function reset() {
    catFromSearch.current = false;
    setCat("all");
    setQuery("");
    setCity("");
  }

  return (
    <div className="page active home ui26">
      <section className="home-hero">
        <HeroReel />
        <StageLight />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            {/* Die Plakette oben wiederholte die drei Versprechen unter der
                Suche und ist deshalb entfallen. */}

            <h1 className="home-h1 h1-lockup">
              <span className="rise" style={{ ["--d" as string]: "60ms" }}>
                {mode === "acts" ? t("hero.h1a") : lang === "en" ? "Book your" : lang === "es" ? "Reserva tu" : "Buche deine"}
              </span>
              <span className="rise" style={{ ["--d" as string]: "140ms" }}>
                <GradientText
                  key={mode}
                  word={mode}
                  text={mode === "acts" ? t("hero.h1b") : lang === "en" ? "venue" : lang === "es" ? "lugar" : "Location"}
                />
              </span>
            </h1>

            <p className="home-lead rise" style={{ ["--d" as string]: "220ms" }}>
              {mode === "acts"
                ? t("hero.sub")
                : lang === "en"
                  ? "Halls, playgrounds and gardens for your party – easily and safely booked online."
                  : lang === "es"
                    ? "Salones, parques infantiles y jardines para tu fiesta – reservados online, fácil y seguro."
                    : "Säle, Spielplätze und Gärten für deine Feier – einfach und sicher online gebucht."}
            </p>

            {/* Suchkarte: oben die Reiter Acts | Locations, darunter die Felder */}
            <div className={"search-card rise" + (mode === "locations" ? " is-venues" : "")} style={{ ["--d" as string]: "300ms" }}>
            <div className="search-mode" role="tablist" aria-label={t("search.what")}>
              {(
                [
                  ["acts", "mask", lang === "en" ? "Acts" : lang === "es" ? "Artistas" : "Künstler"],
                  ["locations", "venue", V.tab],
                ] as const
              ).map(([m, ic, txt]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className={"search-mode-btn" + (mode === m ? " on" : "")}
                  onClick={() => setMode(m)}
                >
                  <Icon name={ic} /> {txt}
                </button>
              ))}
            </div>
            <div className="search-wrap home-search">
              <div className="search-field" style={{ flex: 1.5 }}>
                <Icon name={mode === "acts" ? "search" : "venue"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="search-field-lbl">{mode === "acts" ? t("search.what") : V.what}</div>
                  {mode === "acts" ? (
                    <ArtistAutocomplete
                      value={query}
                      onChange={typeQuery}
                      onPickCat={pickCatFromSearch}
                      placeholder={t("search.ph")}
                    />
                  ) : (
                    <VenueAutocomplete
                      value={venueQ}
                      onChange={(v) => {
                        setVenueQ(v);
                        setVenueKind(undefined);
                        setVenueOcc(undefined);
                      }}
                      placeholder={V.whatPh}
                      onPick={(sug) => {
                        if (sug.type === "venue") {
                          void navigate({ to: "/locations/$id", params: { id: sug.id } });
                          return;
                        }
                        if (sug.type === "kind") {
                          setVenueKind(sug.id);
                          setVenueOcc(undefined);
                        } else {
                          setVenueOcc(sug.id);
                          setVenueKind(undefined);
                        }
                        setVenueQ(sug.label);
                        setTimeout(scrollToGrid, 60);
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="search-divider" />
              <div className="search-field" style={{ flex: 1 }}>
                <span className="book-icon">
                  <Icon name="calendar" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DateField value={date} onChange={setDate} label={t("search.date")} />
                </div>
              </div>
              <div className="search-divider" />
              <div className="search-field" style={{ flex: 1 }}>
                <Icon name="pin" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="search-field-lbl">{t("search.where")}</div>
                  <CityAutocomplete
                    value={city}
                    onChange={setCity}
                    placeholder={t("search.cityph")}
                    onSelect={() => (mode === "acts" ? setTimeout(scrollToGrid, 60) : undefined)}
                  />
                </div>
              </div>
              <button className="search-btn" onClick={() => scrollToGrid()}>
                <span>{mode === "acts" ? t("search.btn") : V.search}</span>
                <Icon name="arrow" />
              </button>
            </div>
            </div>

            <div className="home-popular rise" style={{ ["--d" as string]: "380ms" }}>
              <span className="home-popular-lbl">{t("hero.popular")}</span>
              {mode === "acts"
                ? (["fairy", "magician", "santa", "dj"] as const).map((id) => (
                    <button className="home-chip" key={id} onClick={() => pickCat(id)}>
                      <CatIcon id={id} />
                      <span>{catLabel(id)}</span>
                    </button>
                  ))
                : ["indoorspielplatz", "wasserpark", "hochzeitssaal", "restaurant"].map((id) => {
                    const k = VENUE_KINDS.find((x) => x.id === id)!;
                    return (
                      <button className="home-chip" key={id} onClick={() => {
                          setVenueKind(id);
                          setVenueOcc(undefined);
                          setVenueQ(k.label[(lang as "de" | "en" | "es") ?? "de"] || k.label.de);
                          setTimeout(scrollToGrid, 60);
                        }}>
                        <Icon name={k.icon} />
                        <span>{k.label[(lang as "de" | "en" | "es") ?? "de"] || k.label.de}</span>
                      </button>
                    );
                  })}
            </div>

            <ul className="home-trust rise" style={{ ["--d" as string]: "440ms" }}>
              <li>
                <Icon name="calendar" />
                <span>{t("hero.usp1")}</span>
              </li>
              <li>
                <Icon name="money" />
                <span>{t("hero.usp2")}</span>
              </li>
              <li>
                <Icon name="shield" />
                <a
                  href="#sicher-buchen"
                  className="hero-guar-link"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("sicher-buchen")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >{guaranteeCopy(lang).short}</a>
              </li>
            </ul>
          </div>

          {mode === "acts" ? <ActOfWeek /> : <VenueOfWeek />}
        </div>
      </section>


      <section className="home-more">
        <div className="home-how-inner">
          <div className="home-sec-head" data-reveal>
            <span className="home-eyebrow">{C.moreEyebrow}</span>
            <h2>{C.moreH}</h2>
            <p>{C.moreP}</p>
          </div>
          <div className="more-tiles reveal-stagger">
            <Link className="more-tile" to="/shop">
              <MoreTile img="/shop/1.webp" icon="mask" text={C.tiles[0]!} />
            </Link>
            <Link className="more-tile" to="/shop" search={{ bereich: "deko" }}>
              <MoreTile img="/shop/16.webp" icon="party" text={C.tiles[1]!} />
            </Link>
            <Link className="more-tile" to="/torten">
              <MoreTile img="/sweets/1.webp" icon="gift" text={C.tiles[2]!} />
            </Link>
          </div>
        </div>
      </section>

      {/* Kategorieleiste, Überschrift und Raster stehen in einem eigenen
          Rahmen. Die Leiste klebt beim Scrollen unter der Kopfzeile, aber nur
          so lange, wie das Raster zu sehen ist. */}
      {mode === "acts" && (
      <div className="home-browse">
        <nav className="cat-bar" aria-label={t("grid.all")}>
          <div className="cat-bar-inner">
            {CATS.map((c) => (
              <button
                key={c.id}
                className={"cat-chip" + (c.id === cat ? " on" : "")}
                aria-pressed={c.id === cat}
                onClick={() => pickCat(c.id)}
              >
                <CatIcon id={c.id} />
                <span>{catLabel(c.id)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="grid-head home-grid-head" data-reveal>
          <div>
            <h2>{cat === "all" ? t("grid.allP") : catLabel(cat)}</h2>
            <p>{list.length === 1 ? t("grid.countOne2") : t("grid.count2", { n: list.length })}</p>
          </div>
          {filtered && (
            <button className="home-reset" onClick={reset}>
              <Icon name="close" />
              <span>{t("grid.reset")}</span>
            </button>
          )}
        </div>

        <div className="act-grid reveal-stagger">
          {list.length ? (
            list.slice(0, shown).map((a) => <ArtistCard a={a} key={a.id} />)
          ) : (
            <div className="empty-state">
              <div className="ic">
                <Icon name="search" />
              </div>
              <h3>{t("grid.emptyH")}</h3>
              <p>{t("grid.emptyP")}</p>
              <button className="btn-primary" onClick={reset}>
                {t("grid.emptyBtn")}
              </button>
            </div>
          )}
        </div>
        {list.length > shown && (
          <div className="home-more-btn">
            <button className="btn-secondary" onClick={() => setShown((n) => n + 12)}>
              {C.more(Math.min(12, list.length - shown))}
            </button>
          </div>
        )}
      </div>
      )}

      {mode === "locations" && (
        <div className="home-browse vn-home-browse">
          <nav className="cat-bar" aria-label={V.kinds}>
            <div className="cat-bar-inner">
              <button
                className={"cat-chip" + (!venueGroup && !venueKind ? " on" : "")}
                onClick={() => {
                  setVenueGroup(undefined);
                  setVenueKind(undefined);
                }}
              >
                <Icon name="venue" />
                <span>{V.all}</span>
              </button>
              {VENUE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  className={"cat-chip" + (venueGroup === g.id ? " on" : "")}
                  aria-pressed={venueGroup === g.id}
                  onClick={() => {
                    setVenueGroup(venueGroup === g.id ? undefined : g.id);
                    setVenueKind(undefined);
                  }}
                >
                  <Icon name={g.icon} />
                  <span>{vLabel(g, lang)}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="occ-row vn-occ-row" role="group" aria-label={V.occasions}>
            {OCCASIONS.map((o) => (
              <button
                key={o.id}
                className={"occ-chip" + (venueOcc === o.id ? " on" : "")}
                aria-pressed={venueOcc === o.id}
                onClick={() => setVenueOcc(venueOcc === o.id ? undefined : o.id)}
              >
                {vLabel(o, lang)}
              </button>
            ))}
          </div>
          <div className="grid-head home-grid-head">
            <div>
              <h2>{V.places}</h2>
              <p>{V.results(venueList.length)}</p>
            </div>
            {venueFiltered && (
              <button className="home-reset" onClick={resetVenues}>
                <Icon name="close" />
                <span>{V.reset}</span>
              </button>
            )}
          </div>
          {venueList.length ? (
            <div className="vn-grid">
              {venueList.map((v) => (
                <VenueCard key={v.id} v={v} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="ic">
                <Icon name="venue" />
              </div>
              <p>{V.none}</p>
              <button className="btn-secondary" onClick={resetVenues}>
                {V.reset}
              </button>
            </div>
          )}
          <div className="home-more-btn">
            <Link className="btn-secondary" to="/locations">
              {V.search} <Icon name="arrow" />
            </Link>
          </div>
        </div>
      )}

      {/* Werbeversprechen: Ersatz oder Geld zurück (showly/guarantee.ts) */}
      <GuaranteeSection />

      {/* Nur echte Profile; solange es keine gibt, keine Zahlen */}
      {facts.acts > 0 && (
      <section className="home-facts" aria-label={C.facts} data-reveal>
        <div className="home-facts-inner">
          <div className="home-fact">
            <b>
              <CountUp value={facts.acts} format={(n) => String(Math.round(n))} />
            </b>
            <span>{C.acts}</span>
          </div>
          <div className="home-fact">
            <b>
              <CountUp value={facts.cats} format={(n) => String(Math.round(n))} />
            </b>
            <span>{C.cats}</span>
          </div>
          {facts.reviews > 0 && (
          <div className="home-fact">
            <b>
              <CountUp value={facts.rating} format={(n) => num(n, 2)} />
              <span className="home-fact-star" aria-hidden="true">
                ★
              </span>
            </b>
            <span>{C.rating(facts.reviews.toLocaleString(lang === "en" ? "en" : "de"))}</span>
          </div>
          )}
          <div className="home-fact">
            <b>
              <CountUp value={facts.cities} format={(n) => String(Math.round(n))} />
            </b>
            <span>{C.cities}</span>
          </div>
        </div>
      </section>
      )}

      <section className="home-how">
        <div className="home-how-inner">
          <div className="home-sec-head" data-reveal>
            <span className="home-eyebrow">{t("how.eyebrow")}</span>
            <h2>{t("how.h2")}</h2>
            <p>{t("how.sub")}</p>
          </div>
          <ol className="home-steps reveal-stagger">
            {[1, 2, 3, 4].map((n) => (
              <li className="home-step" key={n}>
                <span className="home-step-num">{n}</span>
                <h3>{t(`how.s${n}t`)}</h3>
                <p>{t(`how.s${n}p`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-join" data-reveal>
        <div className="home-join-card">
          <div className="home-join-text">
            <span className="home-eyebrow on-dark">{C.joinEyebrow}</span>
            <h2>{t("cta.h2")}</h2>
            <p>{t("cta.p")}</p>
            <div className="home-join-btns">
              <button className="home-btn light" onClick={() => navigate({ to: "/mitmachen" })}>
                {t("cta.b1")}
                <Icon name="arrow" />
              </button>
              <button className="home-btn ghost" onClick={() => navigate({ to: "/shop" })}>
                {t("cta.b2")}
              </button>
            </div>
          </div>
          <div className="home-join-art" aria-hidden="true">
            {ARTISTS.slice(0, 6).map((a, i) => (
              <span className={"home-join-tile t" + i} key={a.id} style={bgOf(a)} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function MoreTile({ img, icon, text }: { img: string; icon: string; text: readonly string[] }) {
  return (
    <>
      <span className="more-tile-img" style={{ backgroundImage: `url('${img}')` }} />
      <span className="more-tile-text">
        <span className="more-tile-ic">
          <Icon name={icon} />
        </span>
        <b>{text[0]}</b>
        <small>{text[1]}</small>
      </span>
      <span className="more-tile-go">
        <Icon name="arrow" />
      </span>
    </>
  );
}
