import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { CATS, ICON, type Artist } from "@/showly/data";
import { CatIcon, Html, Icon, bgOf, hasImg } from "@/showly/ui";
import { radiusOf, travelShort } from "@/showly/travel";

/* Karte im Raster der Startseite.
 *
 * Bewusst knapp: Bild, Name mit Bewertung, Sparte und Ort, Preis. Vorher
 * standen auf jeder Karte elf Dinge, darunter Beschreibung, Stichworte und
 * ein Hinweis auf Kostüme. Das gehört ins Profil. Im Raster soll man in
 * einer Sekunde sehen, wer, wo und was es kostet.
 *
 * Die ganze Karte ist anklickbar, aber über einen echten Verweis am Namen und
 * nicht über einen Klick auf den Kasten. So erreicht man sie auch mit der
 * Tastatur, und ein Mittelklick öffnet das Profil in einem neuen Tab. Der
 * Verweis spannt sich per ::after über die Karte; das Herz liegt darüber. */
export function ArtistCard({ a }: { a: Artist }) {
  const { t, L, lang, fmt, num, catLabel, favorites, toggleFav } = useShowly();
  const fav = favorites.includes(a.id);
  const hasPackages = (a["packages"] || []).length > 0;

  return (
    <article className="act-card">
      <div className="act-card-media">
        <div className="act-card-img" style={bgOf(a)}>
          {!hasImg(a) && (
            <span className="img-fallback">
              <CatIcon id={a.cat} />
            </span>
          )}
        </div>
        {a.superhost && (
          <span className="act-card-badge">
            <Icon name="trophy" /> {t("card.superhost")}
          </span>
        )}
        <button
          type="button"
          className={"act-card-fav" + (fav ? " on" : "")}
          onClick={() => toggleFav(a.id)}
          aria-label={t("card.fav")}
          aria-pressed={fav}
        >
          <Html html={fav ? ICON["heartOn"]! : ICON["heart"]!} />
        </button>
      </div>

      <div className="act-card-body">
        <div className="act-card-row">
          <h3 className="act-card-name">
            <Link className="act-card-link" to="/kuenstler/$id" params={{ id: String(a.id) }}>
              {L(a.name)}
            </Link>
          </h3>
          {a.reviews > 0 ? (
            <span className="act-card-rating">
              <span className="star" aria-hidden="true">
                ★
              </span>
              {num(a.rating)}
              <span className="act-card-count">({a.reviews})</span>
            </span>
          ) : (
            <span className="act-card-rating new">{t("card.new")}</span>
          )}
        </div>

        <div className="act-card-meta">
          <CatIcon id={a.cat} />
          <span>{catLabel(a.cat)}</span>
          <span aria-hidden="true">·</span>
          <span>{L(a.loc)}</span>
        </div>

        {/* Eigene Zeile: die Sparte und der Ort sollen nicht abgeschnitten
            werden, nur weil die Anfahrt dazukommt. */}
        <div className="act-card-travel">
          <Icon name="radius" />
          <span>{travelShort(radiusOf(a), lang)}</span>
        </div>

        <div className="act-card-row act-card-foot">
          <span className="act-card-price">
            {hasPackages && <small>{t("pkg.from")} </small>}
            <b>{fmt(Math.round(a.price * 1.2))}</b>{" "}
            <small>{t(hasPackages ? "card.pkgUnit" : "card.hour")}</small>
          </span>
          {a.verified && (
            <span className="act-card-ok">
              <Icon name="check" /> {t("card.verified")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function matchArtist(
  a: Artist,
  opts: { cat: string; query: string; city: string; L: (v: any) => any; catLabel: (id: string) => string },
) {
  const { cat, query, city, L, catLabel } = opts;
  if (cat !== "all" && a.cat !== cat) return false;
  if (city && !String(L(a.loc)).toLowerCase().includes(city)) return false;
  if (query) {
    const hay = [L(a.name), L(a.desc), catLabel(a.cat), L(a.loc)]
      .concat(L(a.tags) || [])
      .concat(L(a["specs"]) || [])
      .join(" ")
      .toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

export { CATS };
