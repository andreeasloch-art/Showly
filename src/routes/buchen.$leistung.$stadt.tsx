/* Lokale Landingpage, z. B. /buchen/zauberer/berlin („Zauberer buchen in
 * Berlin“) oder /buchen/motivtorte/muenchen.
 *
 * Eigener Text je Leistung (landing.ts), dazu echte Daten aus der Stadt:
 * Anbieter, die dort wohnen oder hinkommen, Preisspanne, Bewertungen,
 * Nachbarstädte. In den Suchindex nur mit mindestens MIN_INDEX echten
 * Anbietern; vorher noindex (keine leeren Stadtseiten). */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArtistCard } from "@/components/showly/ArtistCard";
import { BakerCard } from "@/components/showly/Sweets";
import { Footer } from "@/components/showly/Footer";
import { ARTISTS } from "@/showly/data";
import { BAKERS, fromPrice } from "@/showly/sweets";
import { artistFromRow, upsertArtist } from "@/showly/cloudArtists";
import { upsertPublicBaker } from "@/showly/cloudProviders";
import { MIN_INDEX, SERVICES, cityBySlug, landingPath, nearbyCities, serves, serviceBySlug } from "@/showly/landing";
import { artistPath, slugify } from "@/showly/slugs";
import { radiusOf } from "@/showly/travel";
import { seoHeadDe } from "@/showly/seo";
import { landingGraph } from "@/showly/schema";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

export const Route = createFileRoute("/buchen/$leistung/$stadt")({
  loader: async ({ params }) => {
    const svc = serviceBySlug(params.leistung);
    const city = cityBySlug(params.stadt);
    if (!svc || !city) throw notFound();
    const { landingData, parseBakers } = await import("@/utils/seo.functions");
    const d = await landingData({ data: { service: svc.slug, city: city.slug } }).catch(() => null);
    const items: { name: string; url: string }[] = [];
    for (const r of d?.artists || []) {
      const a = artistFromRow(r);
      upsertArtist(a);
      items.push({ name: String((a.name as Record<string, string>)["de"] || ""), url: artistPath(a) });
    }
    for (const pb of parseBakers(d?.bakers)) {
      const b = upsertPublicBaker(pb.provider, pb.offers);
      items.push({ name: String((b.name as Record<string, string>)["de"] || ""), url: `/torten/${b.id}` });
    }
    return { real: items };
  },
  head: (ctx) => {
    const svc = serviceBySlug(ctx.params.leistung);
    const city = cityBySlug(ctx.params.stadt);
    if (!svc || !city) return {};
    const real = ctx.loaderData?.real ?? [];
    const path = landingPath(svc.slug, city.slug);
    const title = `${svc.verb} in ${city.name} | Showly`;
    const description = real.length
      ? `${real.length} ${svc.plural} für ${city.name} auf Showly: Profile mit Fotos, Preisen und freien Terminen vergleichen und direkt ${svc.cat === "cake" ? "bestellen" : "buchen"}.`
      : `${svc.verb} in ${city.name}: ${svc.intro.split(". ")[0]}.`;
    const h = seoHeadDe(path, title, description.slice(0, 160), { noindex: real.length < MIN_INDEX });
    return {
      ...h,
      ...(real.length >= MIN_INDEX
        ? {
            scripts: [
              {
                type: "application/ld+json",
                children: landingGraph(path, title.replace(" | Showly", ""), real, [
                  ["In deiner Stadt", "/buchen"],
                  [`${svc.verb} in ${city.name}`, path],
                ]),
              },
            ],
          }
        : {}),
    };
  },
  component: Landing,
});

function Landing() {
  const { leistung, stadt } = Route.useParams();
  const { fmt } = useShowly();
  const svc = serviceBySlug(leistung)!;
  const city = cityBySlug(stadt)!;
  const cake = svc.cat === "cake";

  /* Katalog nach dem Laden: echte Profile aus der Datenbank und, in der
     Vorschau, die Beispiele (als solche gekennzeichnet) */
  const artists = useMemo(
    () =>
      cake
        ? []
        : ARTISTS.filter((a) => a.cat === svc.cat && serves(slugify(String((a.loc as Record<string, string>)?.["de"] || "")), radiusOf(a), city)).sort(
            (a, b) => Number(!!a.demo) - Number(!!b.demo) || b.reviews - a.reviews,
          ),
    [cake, svc.cat, city],
  );
  const bakers = useMemo(
    () => (cake ? BAKERS.filter((b) => serves(slugify(b.city), b.radiusKm, city)).sort((a, b) => Number(!!a.demo) - Number(!!b.demo)) : []),
    [cake, city],
  );
  const prices = cake ? bakers.map((b) => fromPrice(b.id)?.price ?? 0).filter((p) => p > 0) : artists.map((a) => a.price).filter((p) => p > 0);
  const real = cake ? bakers.filter((b) => !b.demo).length : artists.filter((a) => !a.demo).length;
  const count = cake ? bakers.length : artists.length;
  const reviewed = cake ? bakers.filter((b) => b.reviews > 0).length : artists.filter((a) => a.reviews > 0).length;
  const near = nearbyCities(city);
  const others = SERVICES.filter((s) => s.slug !== svc.slug).slice(0, 12);

  return (
    <div className="page active ui26 help26 info26 land26">
      <div className="help26-wrap">
        <div className="info26-crumbs" role="navigation" aria-label="Brotkrumen">
          <Link to="/">Showly</Link> <span aria-hidden="true">›</span> <Link to="/buchen">In deiner Stadt</Link>{" "}
          <span aria-hidden="true">›</span> <span aria-current="page">{city.name}</span>
        </div>
        <h1>
          {svc.verb} in {city.name}
        </h1>
        <p className="info26-lead">
          {real > 0
            ? `${real} ${real === 1 ? "Profil" : "Profile"} für ${city.name} und Umgebung (${city.region}). Fotos, Preise und freie Termine siehst du direkt im Profil; ${cake ? "bestellt" : "gebucht"} und bezahlt wird über Showly.`
            : `Für ${city.name} sind hier noch keine echten Profile freigeschaltet. ${count ? "Die Karten unten sind Beispiele und zeigen, wie ein Angebot aussieht." : ""} Du bietest das selbst an? Dann trag dich ein.`}
        </p>
        {prices.length > 0 && (
          <p className="land26-facts">
            <Icon name="money" />{" "}
            {cake
              ? `Angebote ab ${fmt(Math.min(...prices))} laut Profilen`
              : Math.min(...prices) === Math.max(...prices)
                ? `Preis ${fmt(prices[0]!)} pro Stunde laut Profil`
                : `Preise von ${fmt(Math.min(...prices))} bis ${fmt(Math.max(...prices))} pro Stunde laut Profilen`}
            {reviewed > 0 ? ` · ${reviewed} mit Bewertungen` : ""}
          </p>
        )}

        {count > 0 && (
          <div className="act-grid land26-grid">
            {cake ? bakers.map((b) => <BakerCard b={b} key={b.id} />) : artists.map((a) => <ArtistCard a={a} key={a.id} />)}
          </div>
        )}

        <section className="info26-sec">
          <h2>
            {svc.plural} für dein Fest in {city.name}
          </h2>
          <p>{svc.intro}</p>
        </section>
        <section className="info26-sec">
          <h2>Worauf du achten solltest</h2>
          <ul>
            {svc.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="info26-sec">
          <h2>Typische Anlässe</h2>
          <p>{svc.occasions.join(" · ")}</p>
        </section>
        <section className="info26-sec">
          <h2>So läuft es über Showly</h2>
          <ul>
            <li>{cake ? "Angebot wählen, Wunschtag und Motiv angeben, abschicken." : "Profil öffnen, Datum, Uhrzeit und Dauer im Kalender wählen."}</li>
            <li>Bezahlt wird über Showly. Bei Anfragen erst, wenn der Anbieter zusagt.</li>
            <li>Kontakt und Absprachen laufen über den Chat in deinem Konto.</li>
          </ul>
        </section>

        <div className="info26-cta">
          <Link to={cake ? "/torten" : "/"} className="home-btn primary">
            {cake ? "Alle Torten & Süßes" : "Alle Künstler ansehen"}
          </Link>
          <Link to={cake ? "/torten/anbieten" : "/mitmachen"} className="home-btn">
            {cake ? "Torten anbieten" : "Als Künstler mitmachen"}
          </Link>
        </div>

        <section className="info26-sec info26-links">
          <h2>{svc.plural} in der Nähe</h2>
          <ul>
            {near.map((c) => (
              <li key={c.slug}>
                <Link to="/buchen/$leistung/$stadt" params={{ leistung: svc.slug, stadt: c.slug }}>
                  <Icon name="arrow" /> {svc.verb} in {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="info26-sec info26-links">
          <h2>Mehr für dein Fest in {city.name}</h2>
          <ul>
            {others.map((s) => (
              <li key={s.slug}>
                <Link to="/buchen/$leistung/$stadt" params={{ leistung: s.slug, stadt: city.slug }}>
                  <Icon name="arrow" /> {s.verb} in {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Footer />
    </div>
  );
}
