/* Übersicht aller Stadtseiten (/buchen): verlinkt jede Leistung in jeder
 * Stadt, damit Suchmaschinen die Stadtseiten finden. Die Seite selbst ist
 * indexierbar; ob eine einzelne Stadtseite in den Index kommt, entscheidet
 * sie selbst (landing.ts, MIN_INDEX). */
import { Link, createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/showly/Footer";
import { CITIES, SERVICES } from "@/showly/landing";
import { seoHeadDe } from "@/showly/seo";
import { pageGraph } from "@/showly/schema";

const PATH = "/buchen";
const TITLE = "Künstler, Torten und mehr in deiner Stadt | Showly";

export const Route = createFileRoute("/buchen/")({
  head: () => ({
    ...seoHeadDe(
      PATH,
      TITLE,
      "Zauberer, Clowns, DJs, Superhelden, Motivtorten und mehr in Berlin, Hamburg, München, Köln und weiteren Städten: Anbieter vergleichen und direkt buchen.",
    ),
    scripts: [{ type: "application/ld+json", children: pageGraph("de", PATH, TITLE, "In deiner Stadt") }],
  }),
  component: Hub,
});

function Hub() {
  return (
    <div className="page active ui26 help26 info26 land26">
      <div className="help26-wrap">
        <div className="info26-crumbs" role="navigation" aria-label="Brotkrumen">
          <Link to="/">Showly</Link> <span aria-hidden="true">›</span> <span aria-current="page">In deiner Stadt</span>
        </div>
        <h1>Künstler, Torten und mehr in deiner Stadt</h1>
        <p className="info26-lead">
          Wähle, was du suchst, und deine Stadt. Auf jeder Seite stehen die Anbieter, die dort wohnen oder mit ihrem Umkreis hinkommen.
        </p>
        {SERVICES.map((s) => (
          <section key={s.slug} className="info26-sec land26-hub">
            <h2 id={s.slug}>{s.verb}</h2>
            <ul>
              {CITIES.map((c) => (
                <li key={c.slug}>
                  <Link to="/buchen/$leistung/$stadt" params={{ leistung: s.slug, stadt: c.slug }}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Footer />
    </div>
  );
}
