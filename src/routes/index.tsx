import { seoHead } from "@/showly/seo";
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
import { SpotlightBanner } from "@/components/showly/SpotlightBanner";
import { CountUp } from "@/components/showly/ImageWall";
import { ActOfWeek } from "@/components/showly/ActOfWeek";
import { HeroReel } from "@/components/showly/HeroReel";

export const Route = createFileRoute("/")({
  head: () => seoHead("/", "/"),
  component: Home,
});

/* Texte, die es nur auf dieser Seite gibt. */
const COPY = {
  de: {
    pill: (n: number) => `${n} geprüfte Acts · Festpreise · sichere Zahlung`,
    facts: "Showly in Zahlen",
    acts: "Acts auf Showly",
    cats: "Sparten",
    rating: (n: string) => `Ø Bewertung aus ${n} Stimmen`,
    cities: "Städte",
    joinEyebrow: "Für Künstler",
    moreEyebrow: "Mehr für dein Event",
    moreH: "Alles für dein Event an einem Ort",
    moreP: "Kostüme, Deko und Torten gleich mit dazu.",
    tiles: [
      ["Kostüme", "Mieten oder kaufen"],
      ["Deko", "Ballons, Lichter, Tischdeko"],
      ["Torten & Süßes", "Von Konditoreien und Privatbäckern"],
    ],
  },
  en: {
    pill: (n: number) => `${n} verified acts · fixed prices · secure payment`,
    facts: "Showly in numbers",
    acts: "Acts on Showly",
    cats: "Categories",
    rating: (n: string) => `Average rating from ${n} reviews`,
    cities: "Cities",
    joinEyebrow: "For artists",
    moreEyebrow: "More for your event",
    moreH: "Everything for your event in one place",
    moreP: "Add costumes, decor and cakes too.",
    tiles: [
      ["Costumes", "Rent or buy"],
      ["Decor", "Balloons, lights, table decor"],
      ["Cakes & sweets", "From patisseries and home bakers"],
    ],
  },
  es: {
    pill: (n: number) => `${n} acts verificados · precios fijos · pago seguro`,
    facts: "Showly en cifras",
    acts: "Acts en Showly",
    cats: "Categorías",
    rating: (n: string) => `Valoración media de ${n} opiniones`,
    cities: "Ciudades",
    joinEyebrow: "Para artistas",
    moreEyebrow: "Más para tu evento",
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
  const { t, L, num, lang, catLabel } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");

  const list = useMemo(
    () =>
      ARTISTS.filter((a) =>
        matchArtist(a, {
          cat,
          query: query.trim().toLowerCase(),
          city: city.trim().toLowerCase(),
          L,
          catLabel,
        }),
      ),
    [cat, query, city, L, catLabel],
  );
  const filtered = cat !== "all" || query || city;

  /* Kennzahlen aus den echten Daten. Vorher standen hier feste Werte wie
     "2.400+ Künstler" und "18.700+ Events", bei 25 Profilen auf der Seite.
     Solche Zahlen fallen Kunden auf und sind im Wettbewerbsrecht heikel. */
  const facts = useMemo(() => {
    const reviews = ARTISTS.reduce((s, a) => s + (a.reviews || 0), 0);
    const rating = reviews
      ? ARTISTS.reduce((s, a) => s + a.rating * (a.reviews || 0), 0) / reviews
      : 0;
    const cities = new Set(ARTISTS.map((a) => String(L(a.loc)))).size;
    const cats = CATS.filter((c) => c.id !== "all").length;
    return { acts: ARTISTS.length, reviews, rating, cities, cats };
  }, [L]);

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
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-pill rise" style={{ ["--d" as string]: "0ms" }}>
              <span className="home-pill-dot" aria-hidden="true" />
              {C.pill(facts.acts)}
            </div>

            <h1 className="home-h1">
              <span className="rise" style={{ ["--d" as string]: "60ms" }}>
                {t("hero.h1a")}
              </span>
              <span className="rise" style={{ ["--d" as string]: "140ms" }}>
                <GradientText text={t("hero.h1b")} />
              </span>
            </h1>

            <p className="home-lead rise" style={{ ["--d" as string]: "220ms" }}>
              {t("hero.sub")}
            </p>

            <div className="search-wrap home-search rise" style={{ ["--d" as string]: "300ms" }}>
              <div className="search-field" style={{ flex: 1.5 }}>
                <Icon name="search" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="search-field-lbl">{t("search.what")}</div>
                  <ArtistAutocomplete
                    value={query}
                    onChange={typeQuery}
                    onPickCat={pickCatFromSearch}
                    placeholder={t("search.ph")}
                  />
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
                    onSelect={() => setTimeout(scrollToGrid, 60)}
                  />
                </div>
              </div>
              <button className="search-btn" onClick={scrollToGrid}>
                <span>{t("search.btn")}</span>
                <Icon name="arrow" />
              </button>
            </div>

            <div className="home-popular rise" style={{ ["--d" as string]: "380ms" }}>
              <span className="home-popular-lbl">{t("hero.popular")}</span>
              {(["fairy", "magician", "santa", "dj"] as const).map((id) => (
                <button className="home-chip" key={id} onClick={() => pickCat(id)}>
                  <CatIcon id={id} />
                  <span>{catLabel(id)}</span>
                </button>
              ))}
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
                <span>{t("hero.usp3")}</span>
              </li>
            </ul>
          </div>

          <ActOfWeek />
        </div>
      </section>

      {/* Der gebuchte Top Act der Woche. Erscheint nur, wenn für die Stadt
          des Besuchers wirklich einer gebucht ist, und steht dann direkt
          unter dem Kopfbereich, noch vor dem Raster. */}
      <SpotlightBanner />

      <section className="home-more">
        <div className="home-how-inner">
          <div className="home-sec-head" data-reveal>
            <span className="home-eyebrow">{C.moreEyebrow}</span>
            <h2>{C.moreH}</h2>
            <p>{C.moreP}</p>
          </div>
          <div className="more-tiles reveal-stagger">
            <Link className="more-tile" to="/shop">
              <MoreTile img="/shop/1.svg" icon="mask" text={C.tiles[0]!} />
            </Link>
            <Link className="more-tile" to="/shop" search={{ bereich: "deko" }}>
              <MoreTile img="/shop/16.svg" icon="party" text={C.tiles[1]!} />
            </Link>
            <Link className="more-tile" to="/torten">
              <MoreTile img="/sweets/1.svg" icon="gift" text={C.tiles[2]!} />
            </Link>
          </div>
        </div>
      </section>

      {/* Kategorieleiste, Überschrift und Raster stehen in einem eigenen
          Rahmen. Die Leiste klebt beim Scrollen unter der Kopfzeile, aber nur
          so lange, wie das Raster zu sehen ist. */}
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
            list.map((a) => <ArtistCard a={a} key={a.id} />)
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
      </div>

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
          <div className="home-fact">
            <b>
              <CountUp value={facts.rating} format={(n) => num(n, 2)} />
              <span className="home-fact-star" aria-hidden="true">
                ★
              </span>
            </b>
            <span>{C.rating(facts.reviews.toLocaleString(lang === "en" ? "en" : "de"))}</span>
          </div>
          <div className="home-fact">
            <b>
              <CountUp value={facts.cities} format={(n) => String(Math.round(n))} />
            </b>
            <span>{C.cities}</span>
          </div>
        </div>
      </section>

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
