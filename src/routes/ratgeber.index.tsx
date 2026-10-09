/* Übersicht der Ratgeber-Artikel (showly/guides.ts) */
import { Link, createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/showly/Footer";
import { GUIDES } from "@/showly/guides";
import { seoHeadDe } from "@/showly/seo";
import { pageGraph } from "@/showly/schema";

const TITLE = "Ratgeber: Ideen und Tipps für dein Fest | Showly";

export const Route = createFileRoute("/ratgeber/")({
  head: () => ({
    ...seoHeadDe(
      "/ratgeber",
      TITLE,
      "Ideen für den Kindergeburtstag, Checkliste zum Künstler buchen, Tipps zur Motivtorte und Unterhaltung für die Hochzeit.",
    ),
    scripts: [{ type: "application/ld+json", children: pageGraph("de", "/ratgeber", TITLE, "Ratgeber") }],
  }),
  component: Guides,
});

function Guides() {
  return (
    <div className="page active ui26 help26 info26">
      <div className="help26-wrap">
        <div className="info26-crumbs" role="navigation" aria-label="Brotkrumen">
          <Link to="/">Showly</Link> <span aria-hidden="true">›</span> <span aria-current="page">Ratgeber</span>
        </div>
        <h1>Ratgeber für dein Fest</h1>
        <p className="info26-lead">Praktische Tipps rund um Kindergeburtstag, Hochzeit, Firmenfeier und Torte, damit am Tag selbst alles klappt.</p>
        <div className="guide-list">
          {GUIDES.map((g) => (
            <Link key={g.slug} to="/ratgeber/$slug" params={{ slug: g.slug }} className="guide-card">
              <h2>{g.title}</h2>
              <p>{g.description}</p>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
