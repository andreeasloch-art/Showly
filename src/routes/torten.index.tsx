import { seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { ImageWall } from "@/components/showly/ImageWall";
import { ShopAreas } from "@/components/showly/ShopAreas";
import {
  BakerCard,
  MyRequests,
  RequestModal,
  SweetCard,
  catName,
  useSweetsCopy,
} from "@/components/showly/Sweets";
import {
  BAKERS,
  SWEETS,
  SWEET_CATS,
  SWEET_CAT_ICON,
  bakerOf,
  sweetBg,
  type Sweet,
} from "@/showly/sweets";

export const Route = createFileRoute("/torten/")({
  head: () => seoHead("/torten", "/torten"),
  component: Sweets,
});

type Kind = "all" | "business" | "private";

function Sweets() {
  const { L, lang } = useShowly();
  const C = useSweetsCopy();
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState<Sweet | null>(null);

  const q = query.trim().toLowerCase();
  const bakerHit = (id: number) => {
    const b = bakerOf(id);
    if (!b) return false;
    if (kind !== "all" && b.kind !== kind) return false;
    return true;
  };
  const text = (parts: unknown[]) => parts.join(" ").toLowerCase();

  const offers = SWEETS.filter((s) => {
    if (cat !== "all" && s.cat !== cat) return false;
    if (!bakerHit(s.bakerId)) return false;
    if (!q) return true;
    const b = bakerOf(s.bakerId)!;
    return text([L(s.name), L(s.desc), catName(s.cat, lang), L(b.name), b.city]).includes(q);
  });
  const bakers = BAKERS.filter((b) => {
    if (kind !== "all" && b.kind !== kind) return false;
    if (cat !== "all" && !b.specialties.includes(cat as never) && !SWEETS.some((s) => s.bakerId === b.id && s.cat === cat))
      return false;
    if (!q) return true;
    return text([L(b.name), L(b.tagline), b.city, ...b.specialties.map((c) => catName(c, lang))]).includes(q)
      || offers.some((s) => s.bakerId === b.id);
  });
  const filtered = cat !== "all" || kind !== "all" || !!q;

  function reset() {
    setCat("all");
    setKind("all");
    setQuery("");
  }
  function scrollTo(sel: string) {
    setTimeout(() => document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
  function jumpTo(id: number) {
    reset();
    setTimeout(() => {
      const el = document.getElementById("sweet-" + id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }, 60);
  }

  return (
    <div className="page active ui26 shop26 sweets26">
      <section className="shop26-hero">
        <div className="shop26-hero-card">
          <div className="shop26-hero-inner">
            <div className="shop26-copy">
              <ShopAreas active="torten" />
              <div className="home-pill on-color rise" style={{ ["--d" as string]: "40ms" }}>
                <Icon name="gift" /> {C.eyebrow}
              </div>
              <h1 className="rise" style={{ ["--d" as string]: "70ms" }}>
                {C.h1}
              </h1>
              <p className="rise" style={{ ["--d" as string]: "140ms" }}>
                {C.sub}
              </p>
              <form
                className="shop26-search rise"
                style={{ ["--d" as string]: "210ms" }}
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  scrollTo(".sweets-offers-head");
                }}
              >
                <div className="shop-search">
                  <div className="shop-search-field">
                    <Icon name="search" />
                    <input
                      type="search"
                      value={query}
                      placeholder={C.ph}
                      aria-label={C.ph}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button type="button" className="shop-search-clear" onClick={() => setQuery("")} aria-label="✕">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </form>
              <ul className="shop26-trust rise" style={{ ["--d" as string]: "280ms" }}>
                <li>
                  <Icon name="mail" /> {C.trust1}
                </li>
                <li>
                  <Icon name="heart" /> {C.trust2}
                </li>
                <li>
                  <Icon name="shield" /> {C.trust3}
                </li>
              </ul>
            </div>
            <ImageWall
              light
              tiles={SWEETS.map((s) => ({
                key: String(s.id),
                style: sweetBg(s),
                title: String(L(s.name)),
                sub: catName(s.cat, lang),
                onClick: () => jumpTo(s.id),
              }))}
            />
          </div>
        </div>
      </section>

      <div className="home-browse">
        <nav className="cat-bar" aria-label={C.h1}>
          <div className="cat-bar-inner">
            {(["all", ...SWEET_CATS] as const).map((c) => (
              <button
                key={c}
                className={"cat-chip" + (c === cat ? " on" : "")}
                aria-pressed={c === cat}
                onClick={() => {
                  setCat(c);
                  scrollTo(".sweets-bakers-head");
                }}
              >
                <Icon name={c === "all" ? "all" : SWEET_CAT_ICON[c]} />
                <span>{c === "all" ? C.all : catName(c, lang)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="occ-row sweets-kind" role="group">
          {(
            [
              ["all", C.kindAll],
              ["business", C.businessP],
              ["private", C.privateP],
            ] as [Kind, string][]
          ).map(([k, label]) => (
            <button key={k} className={"occ-chip" + (kind === k ? " on" : "")} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k !== "all" && <Icon name={k === "private" ? "heart" : "crown"} />}
              {label}
            </button>
          ))}
        </div>

        <div className="home-grid-head sweets-bakers-head" data-reveal>
          <div>
            <h2>{C.bakers}</h2>
            <p>{C.bakersCount(bakers.length)}</p>
          </div>
          {filtered && (
            <button className="home-reset" onClick={reset}>
              <Icon name="close" />
              <span>{C.reset}</span>
            </button>
          )}
        </div>
        <div className="act-grid reveal-stagger">
          {bakers.map((b) => (
            <BakerCard b={b} key={b.id} />
          ))}
          {!bakers.length && <Empty />}
        </div>

        <div className="home-grid-head sweets-offers-head" data-reveal>
          <div>
            <h2>{cat === "all" ? C.offers : catName(cat as never, lang)}</h2>
            <p>{C.offersCount(offers.length)}</p>
          </div>
        </div>
        <div className="act-grid prod-grid reveal-stagger">
          {offers.map((s) => (
            <SweetCard s={s} key={s.id} onAsk={setAsking} />
          ))}
          {!offers.length && <Empty />}
        </div>

        <MyRequests />
      </div>

      <section className="home-join" data-reveal>
        <div className="home-join-card">
          <div className="home-join-text">
            <span className="home-eyebrow on-dark">{C.joinEyebrow}</span>
            <h2>{C.joinH2}</h2>
            <p>{C.joinP}</p>
            <div className="home-join-btns">
              <button className="home-btn light" onClick={() => navigate({ to: "/torten/anbieten" })}>
                {C.joinBtn}
                <Icon name="arrow" />
              </button>
              <button className="home-btn ghost" onClick={() => navigate({ to: "/shop", search: { bereich: "deko" } })}>
                {C.decoBtn}
              </button>
            </div>
          </div>
          <div className="home-join-art" aria-hidden="true">
            {SWEETS.slice(0, 6).map((s, k) => (
              <span className={"home-join-tile t" + k} key={s.id} style={sweetBg(s)} />
            ))}
          </div>
        </div>
      </section>
      <Footer />
      {asking && <RequestModal s={asking} onClose={() => setAsking(null)} />}
    </div>
  );
}

function Empty() {
  const C = useSweetsCopy();
  return (
    <div className="empty-state">
      <div className="ic">
        <Icon name="search" />
      </div>
      <h3>{C.emptyH}</h3>
      <p>{C.emptyP}</p>
    </div>
  );
}
