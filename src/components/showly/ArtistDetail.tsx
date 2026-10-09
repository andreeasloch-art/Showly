/* Profilseite eines Künstlers (vorher direkt in routes/kuenstler.$id.tsx).
 * Angezeigt unter der sprechenden Adresse /kuenstler/<stadt>/<kategorie>/<name>-<id>;
 * die alte Adresse /kuenstler/<id> leitet mit 301 dorthin weiter. */
import { SITE, seoHead } from "@/showly/seo";
import { artistGraph, profileIndexable } from "@/showly/schema";
import { artistFromRow, upsertArtist } from "@/showly/cloudArtists";
import { catName } from "@/showly/catName";
import type { PublicArtistRow } from "@/utils/seo.functions";
import type { Lang } from "@/showly/data";
import { DemoBadge, DemoNote, demoBookable } from "@/components/showly/DemoBadge";
import { ProviderStatusNote } from "@/components/showly/ProviderNotices";
import { isBusiness } from "@/showly/providerStatus";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ARTISTS, SHOP_ITEMS, type Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, Icon, bgOf, hasImg, mediaBg, shopBg } from "@/showly/ui";
import { figName, figuresOf, realName } from "@/showly/figures";
import { radiusOf, travelLabel, travelShort } from "@/showly/travel";
import { Calendar, useCalendar } from "@/components/showly/Calendar";
import { AddOnShelf, EventBundle, suggestForArtist } from "@/components/showly/AddOns";
import { BookingModal } from "@/components/showly/BookingModal";
import { Footer } from "@/components/showly/Footer";
import { BookingModeNote } from "@/components/showly/BookingModeNote";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { ReviewComposer, UserReviewList } from "@/components/showly/Reviews";
import { ProfileVideos } from "@/components/showly/MediaView";
import type { MediaRef } from "@/showly/media";
import { TIERS, TIER_ICON, TIER_LABEL, isPlannerCat, type Tier } from "@/showly/plannerPackages";
import { GuaranteeBadge } from "@/components/showly/Guarantee";
import { CancelPolicyNote } from "@/components/showly/Fair";
import { cleanSurcharges, surchargeFor, withSurcharge } from "@/showly/surcharges";
import { freeCancelText } from "@/components/showly/Fair";
import { countView } from "@/showly/viewCount";
import { artistParams, artistPath } from "@/showly/slugs";

/* Titel, Beschreibung und strukturierte Daten je Profil. Beispielprofile
   und dünne Profile bleiben aus dem Suchindex (noindex), damit nur echte,
   gepflegte Angebote gefunden werden. */
export function artistHead(idParam: string, lang: Lang, row: PublicArtistRow | null) {
  const a = row ? artistFromRow(row) : ARTISTS.find((x) => x.id === Number(idParam));
  /* Kanonisch ist die sprechende Adresse (slugs.ts) */
  const path = a ? artistPath(a) : `/kuenstler/${idParam}`;
  const base = seoHead("/kuenstler/$id", path, lang);
  if (!a) return { ...base, meta: [...base.meta, { name: "robots", content: "noindex, follow" }] };
  const name = String((a.name as Record<string, string>)[lang] || (a.name as Record<string, string>)["de"] || a.name);
  const cat = catName(a.cat, lang);
  const desc = String((a.desc as Record<string, string>)[lang] || (a.desc as Record<string, string>)["de"] || "")
    .replace(/\s+/g, " ")
    .trim();
  const title =
    lang === "en" ? `${name} – book ${cat} | Showly` : lang === "es" ? `${name} – reservar ${cat} | Showly` : `${name} – ${cat} buchen | Showly`;
  const description = desc.length > 155 ? desc.slice(0, 152).replace(/\s\S*$/, "") + " …" : desc || base.meta[1]!.content!;
  const indexable = profileIndexable(a);
  const meta = base.meta.map((m) =>
    "title" in m
      ? { title }
      : m.name === "description" || m.property === "og:description" || m.name === "twitter:description"
        ? { ...m, content: description }
        : m.property === "og:title" || m.name === "twitter:title"
          ? { ...m, content: title }
          : m.property === "og:type"
            ? { ...m, content: "profile" }
            : /* Eigenes Foto als Vorschau beim Teilen (WhatsApp, Social Media) */
              a.id >= 100000 && (m.property === "og:image" || m.name === "twitter:image")
              ? { ...m, content: `${SITE}/api/bild/kuenstler/${a.id}` }
              : a.id >= 100000 && (m.property === "og:image:width" || m.property === "og:image:height")
                ? null
                : m.property === "og:image:alt"
                  ? { ...m, content: `${name} – ${cat}` }
                  : m,
  ).filter((m): m is NonNullable<typeof m> => m !== null);
  return {
    meta: indexable ? meta : [...meta, { name: "robots", content: "noindex, follow" }],
    links: base.links,
    ...(indexable ? { scripts: [{ type: "application/ld+json", children: artistGraph(a, lang, cat) }] } : {}),
  };
}

function Face({ a }: { a: Artist }) {
  if (hasImg(a)) return null;
  return (
    <span className="img-fallback">
      <CatIcon id={a.cat} />
    </span>
  );
}

/** Profilseite eines Künstlers; die Routen unter /kuenstler/ zeigen sie an */
export function ArtistDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { t, lang, L, fmt, num, fmtDate, favorites, toggleFav, toast, session, catLabel, standing } =
    useShowly();
  const cal = useCalendar();
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [figure, setFigure] = useState<string | null>(null);
  const [guests, setGuests] = useState("");
  const [loc, setLoc] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  const a = useMemo(() => ARTISTS.find((x) => x.id === Number(id)), [id]);
  useEffect(() => countView("artist", Number(id)), [id]);

  /* Markiert die Seite als Profilseite. Daran haengt unter anderem der
     Buchungsbalken, der auf dem Handy unten stehen bleibt. */
  useEffect(() => {
    document.body.setAttribute("data-theme", "detail");
    return () => document.body.setAttribute("data-theme", "home");
  }, []);

  if (!a) {
    return (
      <div className="page active">
        <div className="empty-state">
          <h3>{t("grid.emptyH")}</h3>
          <button className="btn-primary" onClick={() => navigate({ to: "/" })}>
            {t("grid.emptyBtn")}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const pkgs = (a as { packages?: any[] }).packages || [];
  /* Planer rechnen nur pro Paket ab: ohne Auswahl gilt das beliebte bzw. erste */
  const plannerOnly = isPlannerCat(a.cat) && pkgs.length > 0;
  const curPkg = pkgs.find((p) => p.id === pkgId) || (plannerOnly ? pkgs.find((p) => p.popular) || pkgs[0] : null) || null;
  /* Die Gage gilt immer pro Stunde. Der Kunde wählt die Dauer, mindestens
     so viele Stunden, wie der Künstler im Profil festgelegt hat. Nur Planer
     mit festen Paketen rechnen pro Paket ab; dann entfällt die Stundenwahl. */
  const minHours = Math.max(1, Number(a["minHours"]) || 1);
  const maxHours = 12;
  const h = Math.min(maxHours, Math.max(minHours, hours ?? Math.max(minHours, 2)));
  /* Wochenendzuschlag oder Saisonpreis für das gewählte Datum (surcharges.ts) */
  const sc = cleanSurcharges(a.surcharges);
  const scInfo = surchargeFor(sc, cal.sel.date || undefined);
  const hourly = withSurcharge(a.price, sc, cal.sel.date || undefined);
  const base = curPkg ? withSurcharge(curPkg.price, sc, cal.sel.date || undefined) : hourly * h;
  /* Endpreis für den Kunden, ohne Aufschlag */
  const total = base;
  const media = (a["photos"] as MediaRef[] | undefined) || [];
  /* Galerie oben nur mit Fotos; Videos stehen darunter in eigener Reihe */
  const photos = media.filter((m) => m.kind !== "video").slice(0, 3);
  const figImages = (a["figureImages"] as Record<string, { id: string }> | undefined) || {};
  const figs = figuresOf(a);
  const km = radiusOf(a);
  /* Gespielte Shows über Showly (echte Zählung, siehe 0011_shows_zaehlen) */
  const shows = a.demo ? 0 : Math.max(0, Math.round(a.events ?? 0));
  const showsLabel = shows === 1 ? t("card.show1") : t("card.shows", { n: shows });
  const real = realName(a);
  const owns = !!(session && session.providerId === a.id);
  const costumes = (a.shopIds || [])
    .map((i) => SHOP_ITEMS.find((s) => s.id === i))
    .filter(Boolean) as (typeof SHOP_ITEMS)[number][];
  let similar = ARTISTS.filter((x) => x.id !== a.id && x.cat === a.cat);
  if (similar.length < 6)
    similar = similar
      .concat(ARTISTS.filter((x) => x.id !== a.id && x.cat !== a.cat).sort((p, q) => q.rating - p.rating))
      .slice(0, 6);

  const picked = !!(cal.sel.date && cal.sel.slot);
  const chooseLbl = lang === "en" ? "Pick a date" : lang === "es" ? "Elegir fecha" : "Termin wählen";
  function scrollToCal() {
    if (typeof document === "undefined") return;
    document.getElementById("cal-detail")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="page active detail-page">
      {/* Bewusst ein div: ein nav-Element erbt hier die Gestaltung der
          fixierten Kopfzeile und legte sich dann ueber sie. */}
      <div className="detail-crumbs">
        <button className="crumb" onClick={() => navigate({ to: "/" })}>
          {t("nav.artists")}
        </button>
        <span className="crumb-sep">›</span>
        <span className="crumb-cat">{catLabel(a.cat)}</span>
        <span className="crumb-sep">›</span>
        <span className="crumb-current">{L(a.name)}</span>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {owns && (
            <div className="owner-bar">
              <Icon name="user" /> {t("own.this")}
              <button
                className="action-btn"
                onClick={() => navigate({ to: "/dashboard", search: { tab: "edit" } as never })}
              >
                <Icon name="sparkle" /> {t("own.edit")}
              </button>
              <button className="action-btn" onClick={() => navigate({ to: "/dashboard" })}>
                {t("own.manage")}
              </button>
            </div>
          )}

          {/* Ohne eigene Fotos nur ein Bild: dreimal dieselbe Figur in
              verschiedenen Ausschnitten sah nach Auswahl aus, war aber keine. */}
          <div className={"gallery" + (photos.length >= 2 ? "" : " single")}>
            {/* Der Ausschnitt sitzt etwas hoeher, sonst schneidet das breite
                Format den Kopf der Figur ab. */}
            <div className="gallery-main" style={{ ...bgOf(a, "center 32%"), viewTransitionName: `act-${a.id}` }}>
              <Face a={a} />
            </div>
            {photos.length >= 2 ? (
              <div className="gallery-side">
                <div className="gallery-thumb" style={mediaBg(photos[1]!.id) ?? bgOf(a)} />
                <div
                  className="gallery-thumb"
                  style={(photos[2] && mediaBg(photos[2].id)) || mediaBg(photos[0]!.id) || bgOf(a)}
                />
              </div>
            ) : null}
          </div>

          <ProfileVideos items={media} title={lang === "en" ? "Videos" : lang === "es" ? "Vídeos" : "Videos"} />

          <header className="detail-head">
            <div className="detail-head-row">
              <div className="detail-head-text">
                <div className="detail-kicker">
                  <span className="detail-cat">
                    <CatIcon id={a.cat} /> {catLabel(a.cat)}
                  </span>
                  {a.superhost && (
                    <span className="detail-flag detail-flag-top">
                      <Icon name="trophy" /> {t("detail.superhost")}
                    </span>
                  )}
                  {a.verified && (
                    <span className="detail-flag detail-flag-ok">✓ {t("card.verified")}</span>
                  )}
                  {a.demo && <DemoBadge />}
                </div>
                <h1 className="detail-h1">{L(a.name)}</h1>
                <div className="detail-meta">
                  <span className="meta-item">
                    {a.reviews > 0 ? (
                      <>
                        <span className="star">★</span> <strong>{num(a.rating)}</strong> · {a.reviews}{" "}
                        {t("misc.reviews")}
                      </>
                    ) : (
                      <strong>{t("card.new")}</strong>
                    )}
                  </span>
                  {shows > 0 && (
                    <span className="meta-item">
                      <Icon name="mic" /> <strong>{showsLabel}</strong> {t("misc.viaShowly")}
                    </span>
                  )}
                  <span className="meta-item">
                    <Icon name="pin" /> {L(a.loc)}
                  </span>
                  <span className="meta-item">
                    <Icon name="radius" /> {travelShort(km, lang)}
                  </span>
                  {real && (
                    <span className="meta-item">
                      <Icon name="user" /> {t("fig.behind")}: <strong>{real}</strong>
                    </span>
                  )}
                  <span className="meta-item">
                    <Icon name="clock" /> {t("detail.respond", { t: L(a.responseTime) })}
                  </span>
                </div>
              </div>
              <div className="detail-actions">
                <button className="action-btn" onClick={() => toggleFav(a.id)}>
                  <Icon name={favorites.includes(a.id) ? "heartOn" : "heart"} />{" "}
                  {t(favorites.includes(a.id) ? "detail.saved" : "detail.save")}
                </button>
                <button className="action-btn" onClick={() => toast(t("toast.shared"))}>
                  <Icon name="mail" /> {t("detail.share")}
                </button>
              </div>
            </div>
            {(L(a.tags) ?? []).length > 0 && (
              <div className="detail-tags">
                {(L(a.tags) ?? []).map((x: string) => (
                  <span className="tag" key={x}>
                    {x}
                  </span>
                ))}
              </div>
            )}
            {a.demo ? <DemoNote /> : <ProviderStatusNote business={isBusiness(a)} />}
          </header>

          <div className="stats-grid">
            {/* Echte Zahl aus der Datenbank: nur Buchungen über Showly, bei
                denen der Auftritt per Check-in bestätigt ist (0011_shows_zaehlen) */}
            <div className="stat-item">
              <div className="stat-val">{shows > 0 ? shows : t("card.new")}</div>
              <div className="stat-lbl">{t("detail.events")}</div>
            </div>
            <div className="stat-item">
              <div className="stat-val">
                {parseInt(L(a.exp), 10) + (lang === "de" ? " J." : lang === "es" ? " años" : " yrs")}
              </div>
              <div className="stat-lbl">{t("detail.exp")}</div>
            </div>
            <div className="stat-item">
              <div className="stat-val">{L(a.responseTime)}</div>
              <div className="stat-lbl">{t("detail.time")}</div>
            </div>
          </div>

          <section className="detail-block">
            <h2 className="detail-section-title">{t("detail.about", { name: L(a.name) })}</h2>
            <p className="detail-text">{L(a.desc)}</p>
            <p className="travel-line">
              <Icon name="radius" /> {travelLabel(km, lang, L(a.loc))}
            </p>
            <p className="detail-text">
              {t(shows > 0 ? "detail.aboutP" : "detail.aboutPNew", {
                exp: L(a.exp),
                ev: showsLabel,
                name: L(a.name),
                langs: (L(a.langs) ?? []).join(", "),
              })}
            </p>
          </section>

          {/* Leistung und Technik standen vorher als drei einzelne Abschnitte
              untereinander. Zusammengefasst liest sich das Profil ruhiger. */}
          <section className="detail-block">
            <h2 className="detail-section-title">{t("detail.included")}</h2>
            <div className="includes-grid">
              {(L(a.includes) ?? []).map((i: string) => (
                <div className="include-item" key={i}>
                  <span className="include-icon">✓</span>
                  {i}
                </div>
              ))}
            </div>
            {(L(a["specs"]) ?? []).length > 0 && (
              <>
                <h3 className="detail-sub">{t("detail.specs")}</h3>
                <div className="spec-chips">
                  {(L(a["specs"]) ?? []).map((s: string) => (
                    <span className="spec-chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {figs.length > 0 && (
            <section className="detail-block">
              <h2 className="detail-section-title">
                <Icon name="mask" /> {t("fig.h")}
              </h2>
              <p className="detail-lead">{t("fig.p")}</p>
              <div className="fig-list">
                {figs.map((v) => (
                  <button
                    className={"fig-chip" + (figure === v ? " on" : "")}
                    key={v}
                    onClick={() => setFigure(figure === v ? null : v)}
                    aria-pressed={figure === v}
                  >
                    {figImages[v] && mediaBg(figImages[v]!.id) && (
                      <span className="fig-chip-img" style={mediaBg(figImages[v]!.id)!} />
                    )}
                    {figName(a.cat, v, lang)}
                    {figure === v ? " ✓" : ""}
                  </button>
                ))}
              </div>
              {figure ? (
                <div className="sel-banner">
                  <Icon name="mask" /> {t("fig.chosen", { f: figName(a.cat, figure, lang) })}
                </div>
              ) : (
                <div className="mini-note">{t("fig.pickHint")}</div>
              )}
            </section>
          )}

          {pkgs.length > 0 && (
            <section className="detail-block">
              <h2 className="detail-section-title">
                <Icon name="gift" /> {t("pkg.h")}
              </h2>
              <p className="detail-lead">{t("pkg.p")}</p>
              <div className="pkg-grid">
                {pkgs.map((p) => {
                  const on = curPkg?.id === p.id;
                  return (
                    <button
                      className={"pkg-card" + (on ? " on" : "")}
                      key={p.id}
                      onClick={() => setPkgId(on && !plannerOnly ? null : p.id)}
                      aria-pressed={on}
                    >
                      {p.popular && <span className="pkg-tag">★ {t("pkg.popular")}</span>}
                      <span className="pkg-emoji">
                        <Icon name={p.icon || TIER_ICON[p.id as Tier] || "gift"} />
                      </span>
                      {(TIERS as readonly string[]).includes(p.id) && (
                        <span className={"pkg-tier tier-" + p.id}>{TIER_LABEL[p.id as Tier][(lang as "de" | "en" | "es") ?? "de"]}</span>
                      )}
                      <div className="pkg-name">{L(p.name)}</div>
                      <div className="pkg-dur">{L(p.dur || "")}</div>
                      <div className="pkg-price">
                        {fmt(p.price)} <small>{t("pkg.fixed")}</small>
                      </div>
                      <ul className="pkg-list">
                        {L(p.inc || []).map((x: string) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      {p.text && <p className="pkg-text">{L(p.text)}</p>}
                      <span className="pkg-pick">{on ? t("pkg.chosen") : t("pkg.choose") + " →"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="detail-block">
            <h2 className="detail-section-title">
              <Icon name="calendar" /> {t("cal.h")}
            </h2>
            <p className="detail-lead">{t("cal.sub")}</p>
            <Calendar id="cal-detail" providerId={a.id} hours={h} {...cal} />
          </section>

          {costumes.length > 0 && (
            <div className="bridge">
              <div className="bridge-head">
                <span className="bridge-icon">
                  <Icon name="mask" />
                </span>
                <h3>{t("detail.bridgeH")}</h3>
              </div>
              <p className="bridge-sub">{t("detail.bridgeP")}</p>
              <div className="bridge-items">
                {costumes.map((c) => (
                  <button
                    className="bridge-item"
                    key={c.id}
                    onClick={() => navigate({ to: "/shop" })}
                  >
                    <span className="bridge-emoji" style={shopBg(c)} />
                    <span>
                      <span className="bridge-name">{L(c.name)}</span>
                      <span className="bridge-price">
                        {c.rent > 0
                          ? t("shop.fromDay", { p: fmt(c.rent) })
                          : t("shop.buy", { p: fmt(c.buy) })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="bridge-foot">
                <button className="action-btn" onClick={() => navigate({ to: "/shop" })}>
                  {t("detail.bridgeAll")}
                </button>
              </div>
            </div>
          )}

          <section className="detail-block" id="bewertungen">
            <h2 className="detail-section-title">{t("detail.reviews", { n: a.reviews })}</h2>
            {a.reviews > 0 ? (
            <div className="rev-summary">
              <div className="rev-score">{num(a.rating)}</div>
              <div>
                <div className="rev-stars">★★★★★</div>
                <div className="rev-count">
                  {a.reviews} {t("misc.reviews")}
                </div>
              </div>
            </div>
            ) : (
              <p className="detail-lead">{t("detail.noReviews")}</p>
            )}
            {/* Erst die Stimmen der Gaeste mit ihren Event-Fotos, darunter
                die bereits vorhandenen Bewertungen. */}
            <ReviewComposer artistId={a.id} />
            <UserReviewList artistId={a.id} />
            <div className="rev-list">
              {(a.rev || []).map((r, k) => (
                <div className="review-card" key={k}>
                  <div className="rev-head">
                    <div className="rev-avatar">
                      <Icon name="user" />
                    </div>
                    <div>
                      <div className="rev-name">{r.n}</div>
                      <div className="rev-date">{L(r.d)}</div>
                    </div>
                    <div className="rev-mark">{"★".repeat(r.r)}</div>
                  </div>
                  <p className="rev-text">{L(r.t)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-block">
            <h2 className="detail-section-title">{t("detail.similarH")}</h2>
            <p className="detail-lead">{t("detail.similarP", { cat: catLabel(a.cat) })}</p>
            <div className="similar-grid similar-row" role="list">
              {similar.slice(0, 10).map((s) => (
                <button
                  className="similar-card"
                  role="listitem"
                  key={s.id}
                  onClick={() => navigate({ to: "/kuenstler/$stadt/$kategorie/$name", params: artistParams(s) })}
                >
                  <div className="similar-img" style={bgOf(s, "center 30%")}>
                    <Face a={s} />
                  </div>
                  <div className="similar-body">
                    <div className="similar-name">{L(s.name)}</div>
                    <div className="similar-meta">
                      {s.reviews > 0 ? `★ ${num(s.rating, 1)} · ` : `${t("card.new")} · `}{fmt(s.price)}{" "}
                      {t(((s as { packages?: unknown[] }).packages || []).length ? "card.pkgUnit" : "card.hour")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-side">
          {!standing(a.id).bookable ? (
            <div className="booking-widget booking-off">
              <Icon name="calendar" />
              <b>{lang === "en" ? "Currently not bookable" : lang === "es" ? "No reservable por ahora" : "Derzeit nicht buchbar"}</b>
              <p>
                {lang === "en"
                  ? "This profile can't be booked at the moment. Have a look at similar acts."
                  : lang === "es"
                    ? "Este perfil no se puede reservar por ahora. Echa un vistazo a artistas parecidos."
                    : "Dieses Profil kann gerade nicht gebucht werden. Schau dir ähnliche Acts an."}
              </p>
            </div>
          ) : (
          <div className="booking-widget">
            <div className="booking-price">
              <div className="price-main">
                {curPkg ? (
                  <>
                    {fmt(total)} <span className="price-unit">{t("pkg.fixed")}</span>
                  </>
                ) : (
                  <>
                    {fmt(hourly)}{" "}
                    <span className="price-unit">{t("book.perHour")}</span>
                  </>
                )}
              </div>
              <div className="price-sub">
                {curPkg ? (
                  <>
                    <Icon name="gift" /> {L(curPkg.name)}
                  </>
                ) : figure ? (
                  <>
                    <Icon name="mask" /> {figName(a.cat, figure, lang)}
                  </>
                ) : (
                  t("book.baseH", { p: fmt(hourly) })
                )}
              </div>
              {scInfo.pct !== 0 && <div className="price-note sc-note">{scInfo.reasons.join(" · ")}</div>}
              {!cal.sel.date && sc && (
                <div className="price-note sc-note">
                  {[sc.weekend ? `Wochenende +${sc.weekend} %` : "", ...sc.seasons.map((x) => `${x.label || "Saison"} ${x.from.split("-").reverse().join(".")}.–${x.to.split("-").reverse().join(".")}. ${x.pct > 0 ? "+" : "−"}${Math.abs(x.pct)} %`)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              <div className="price-note">✓ {freeCancelText(a.cancelTier, lang)}</div>
            </div>
            <BookingModeNote artist={a} />

            <div className="booking-fields">
              <button
                className={"book-field book-field-btn" + (cal.sel.date ? " on" : "")}
                onClick={scrollToCal}
              >
                <span className="book-icon">
                  <Icon name="calendar" />
                </span>
                <span className="book-field-body">
                  <span className="book-field-lbl">
                    {t("book.date")} & {t("book.slot")}
                  </span>
                  <span className={"book-field-val" + (cal.sel.date ? " set" : "")}>
                    {cal.sel.date
                      ? `${fmtDate(cal.sel.date)} · ${cal.sel.slot || "–"} ${t("misc.uhr")}`
                      : t("book.toCal")}
                  </span>
                </span>
              </button>
              {!curPkg && (
                <div className="book-field book-hours">
                  <span className="book-icon">
                    <Icon name="clock" />
                  </span>
                  <span className="book-field-body">
                    <span className="book-field-lbl">
                      {t("book.hours")}
                      {minHours > 1 && (
                        <span className="book-hours-min"> · {t("book.minH", { n: minHours })}</span>
                      )}
                    </span>
                    <span className="book-hours-row">
                      <button
                        type="button"
                        className="book-hours-btn"
                        onClick={() => setHours(Math.max(minHours, h - 1))}
                        disabled={h <= minHours}
                        aria-label={t("book.fewer")}
                      >
                        −
                      </button>
                      <output className="book-hours-val" aria-live="polite">
                        {t("book.hoursVal", { n: h })}
                      </output>
                      <button
                        type="button"
                        className="book-hours-btn"
                        onClick={() => setHours(Math.min(maxHours, h + 1))}
                        disabled={h >= maxHours}
                        aria-label={t("book.more")}
                      >
                        +
                      </button>
                    </span>
                  </span>
                </div>
              )}
              <label className="book-field">
                <span className="book-icon">
                  <Icon name="user" />
                </span>
                <span className="book-field-body">
                  <span className="book-field-lbl">{t("book.guests")}</span>
                  <input
                    type="number"
                    min={1}
                    placeholder={t("book.guestsPh")}
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  />
                </span>
              </label>
              <div className="book-field">
                <span className="book-icon">
                  <Icon name="pin" />
                </span>
                <span className="book-field-body">
                  <span className="book-field-lbl">{t("book.loc")}</span>
                  <CityAutocomplete
                    value={loc}
                    onChange={setLoc}
                    placeholder={t("book.locPh")}
                    showScopeToggle={false}
                  />
                </span>
              </div>
            </div>

            <div className="price-breakdown">
              {curPkg && (
                <div className="pb-row">
                  <span>{t("book.pkgLbl")}</span>
                  <span className="pb-strong">{L(curPkg.name)}</span>
                </div>
              )}
              <div className="pb-row">
                <span>
                  {curPkg ? L(curPkg.name) : t("book.timesH", { p: fmt(hourly), n: h })}
                </span>
                <span>{fmt(base)}</span>
              </div>
              <div className="pb-row">
                <span>{t("book.total")}</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            <button
              className="btn-primary book-cta"
              disabled={!!a.demo && !demoBookable()}
              onClick={() => (picked ? setModal(true) : scrollToCal())}
            >
              {picked ? t("book.now") : chooseLbl}
            </button>
            <div className="trust-row">
              <Icon name="lock" /> {t("book.secure")}
            </div>
            <div className="book-contact">
              <button
                className="action-btn"
                onClick={() => toast(t("msg.sent", { t: L(a.responseTime) }))}
              >
                <Icon name="mail" /> {t("book.contact")}
              </button>
            </div>
          </div>
          )}
          <GuaranteeBadge className="in-side" />
          <CancelPolicyNote tier={a.cancelTier} cancelRate={a.cancelRate} />
        </aside>
      </div>

      {/* Passende Extras direkt unter dem Profil */}
      <div className="ui26 addon-zone">
        <EventBundle a={a} artistTotal={total} hours={h} onBook={scrollToCal} />
        <AddOnShelf
          title={lang === "en" ? "More for this occasion" : lang === "es" ? "Más para esta ocasión" : "Mehr für diesen Anlass"}
          deco={suggestForArtist(a, String(L(a.loc))).deco.slice(2)}
          sweets={suggestForArtist(a, String(L(a.loc))).sweets.slice(1)}
        />
      </div>

      {modal && (
        <BookingModal
          artist={a}
          date={cal.sel.date!}
          slot={cal.sel.slot!}
          figure={figure}
          pkg={curPkg}
          hours={h}
          guests={guests}
          loc={loc}
          onClose={() => setModal(false)}
        />
      )}

      <div className="m-cta">
        <div className="m-cta-price">
          <b>{fmt(total)}</b>
          <span>
            {curPkg ? "" : t("book.hoursVal", { n: h }) + " · "}
            {cal.sel.date
              ? `${fmtDate(cal.sel.date)} · ${cal.sel.slot || "–"} ${t("misc.uhr")}`
              : t("book.toCal")}
          </span>
        </div>
        <button onClick={() => (picked ? setModal(true) : scrollToCal())}>
          {picked ? t("book.now") : chooseLbl}
        </button>
      </div>
      <Footer />
    </div>
  );
}
