import { seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
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

export const Route = createFileRoute("/kuenstler/$id")({
  head: ({ params }) => seoHead("/kuenstler/$id", `/kuenstler/${params.id}`),
  component: Detail,
});

function Face({ a }: { a: Artist }) {
  if (hasImg(a)) return null;
  return (
    <span className="img-fallback">
      <CatIcon id={a.cat} />
    </span>
  );
}

function Detail() {
  const { id } = useParams({ from: "/kuenstler/$id" });
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
  const curPkg = pkgs.find((p) => p.id === pkgId) || null;
  /* Die Gage gilt immer pro Stunde. Der Kunde wählt die Dauer, mindestens
     so viele Stunden, wie der Künstler im Profil festgelegt hat. Nur Planer
     mit festen Paketen rechnen pro Paket ab; dann entfällt die Stundenwahl. */
  const minHours = Math.max(1, Number(a["minHours"]) || 1);
  const maxHours = 12;
  const h = Math.min(maxHours, Math.max(minHours, hours ?? Math.max(minHours, 2)));
  const hourly = a.price;
  const base = curPkg ? curPkg.price : hourly * h;
  const fee = Math.round(base * 0.2);
  const total = base + fee;
  const photos = ((a["photos"] as { id: string }[] | undefined) || []).slice(0, 3);
  const figImages = (a["figureImages"] as Record<string, { id: string }> | undefined) || {};
  const figs = figuresOf(a);
  const km = radiusOf(a);
  const real = realName(a);
  const owns = !!(session && session.providerId === a.id);
  const costumes = (a.shopIds || [])
    .map((i) => SHOP_ITEMS.find((s) => s.id === i))
    .filter(Boolean) as (typeof SHOP_ITEMS)[number][];
  let similar = ARTISTS.filter((x) => x.id !== a.id && x.cat === a.cat);
  if (similar.length < 3)
    similar = similar
      .concat(ARTISTS.filter((x) => x.id !== a.id && x.cat !== a.cat).sort((p, q) => q.rating - p.rating))
      .slice(0, 4);

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

          <div className="gallery">
            {/* Der Ausschnitt sitzt etwas hoeher, sonst schneidet das breite
                Format den Kopf der Figur ab. */}
            <div className="gallery-main" style={bgOf(a, "center 32%")}>
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
            ) : (
            <div className="gallery-side">
              <div
                className="gallery-thumb"
                style={
                  hasImg(a)
                    ? { ...bgOf(a, "center 20%"), backgroundSize: "200%", fontSize: 50 }
                    : { background: a.color, opacity: 0.75, fontSize: 50 }
                }
              >
                <Face a={a} />
              </div>
              <div
                className="gallery-thumb"
                style={
                  hasImg(a)
                    ? { ...bgOf(a, "center 78%"), backgroundSize: "180%", fontSize: 40 }
                    : { background: a.color, opacity: 0.5, fontSize: 40 }
                }
              >
                <Face a={a} />
              </div>
            </div>
            )}
          </div>

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
          </header>

          <div className="stats-grid">
            {(a.events ?? 0) > 0 && (
              <div className="stat-item">
                <div className="stat-val">{a.events}+</div>
                <div className="stat-lbl">{t("detail.events")}</div>
              </div>
            )}
            <div className="stat-item">
              <div className="stat-val">
                {parseInt(L(a.exp), 10) + (lang === "de" ? " J." : lang === "es" ? " años" : " yrs")}
              </div>
              <div className="stat-lbl">{t("detail.exp")}</div>
            </div>
            {a.responseRate && (
              <div className="stat-item">
                <div className="stat-val">{a.responseRate}</div>
                <div className="stat-lbl">{t("detail.rate")}</div>
              </div>
            )}
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
              {t((a.events ?? 0) > 0 ? "detail.aboutP" : "detail.aboutPNew", {
                exp: L(a.exp),
                ev: a.events ?? 0,
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
                  const on = pkgId === p.id;
                  return (
                    <button
                      className={"pkg-card" + (on ? " on" : "")}
                      key={p.id}
                      onClick={() => setPkgId(on ? null : p.id)}
                      aria-pressed={on}
                    >
                      {p.popular && <span className="pkg-tag">★ {t("pkg.popular")}</span>}
                      <span className="pkg-emoji">
                        <Icon name={p.icon || "gift"} />
                      </span>
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
            <Calendar id="cal-detail" providerId={a.id} {...cal} />
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

          <section className="detail-block">
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
            <div className="similar-grid reveal-stagger">
              {similar.slice(0, 4).map((s) => (
                <button
                  className="similar-card"
                  key={s.id}
                  onClick={() => navigate({ to: "/kuenstler/$id", params: { id: String(s.id) } })}
                >
                  <div className="similar-img" style={bgOf(s, "center 30%")}>
                    <Face a={s} />
                  </div>
                  <div className="similar-body">
                    <div className="similar-name">{L(s.name)}</div>
                    <div className="similar-meta">
                      {s.reviews > 0 ? `★ ${num(s.rating, 1)} · ` : `${t("card.new")} · `}{fmt(Math.round(s.price * 1.2))}{" "}
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
                    {fmt(Math.round(hourly * 1.2))}{" "}
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
              <div className="price-note">✓ {t("book.freeCancel")}</div>
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
                <span>{t("book.fee")}</span>
                <span>{fmt(fee)}</span>
              </div>
              <div className="pb-row">
                <span>{t("book.total")}</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            <button
              className="btn-primary book-cta"
              onClick={() => {
                if (!cal.sel.date || !cal.sel.slot) {
                  toast(t("book.pickFirst"));
                  scrollToCal();
                  return;
                }
                setModal(true);
              }}
            >
              {t("book.now")}
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
        </aside>
      </div>

      {/* Wie im Online-Shop: passende Extras direkt unter dem Profil */}
      <div className="ui26 addon-zone">
        <EventBundle a={a} artistTotal={total} hours={h} onBook={scrollToCal} />
        <AddOnShelf
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
        <button onClick={() => (cal.sel.date && cal.sel.slot ? setModal(true) : scrollToCal())}>
          {t("book.now")}
        </button>
      </div>
      <Footer />
    </div>
  );
}
