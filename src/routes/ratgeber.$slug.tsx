/* Ratgeber-Artikel (Inhalte in showly/guides.ts), nur auf Deutsch */
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Footer } from "@/components/showly/Footer";
import { GUIDES, guideBySlug } from "@/showly/guides";
import { seoHeadDe } from "@/showly/seo";
import { articleGraph } from "@/showly/schema";
import { Icon } from "@/showly/ui";

export const Route = createFileRoute("/ratgeber/$slug")({
  loader: ({ params }) => {
    if (!guideBySlug(params.slug)) throw notFound();
    return null;
  },
  head: ({ params }) => {
    const g = guideBySlug(params.slug);
    if (!g) return {};
    const path = `/ratgeber/${g.slug}`;
    return {
      ...seoHeadDe(path, `${g.title} | Showly Ratgeber`, g.description, { type: "article" }),
      scripts: [{ type: "application/ld+json", children: articleGraph(path, g.title, g.description, g.updated) }],
    };
  },
  component: Article,
});

function Article() {
  const { slug } = Route.useParams();
  const g = guideBySlug(slug)!;
  const more = GUIDES.filter((x) => x.slug !== g.slug);
  return (
    <div className="page active ui26 help26 info26">
      <article className="help26-wrap">
        <div className="info26-crumbs" role="navigation" aria-label="Brotkrumen">
          <Link to="/">Showly</Link> <span aria-hidden="true">›</span> <Link to="/ratgeber">Ratgeber</Link>{" "}
          <span aria-hidden="true">›</span> <span aria-current="page">{g.title}</span>
        </div>
        <h1>{g.title}</h1>
        <p className="fair-muted">Stand: {g.updated.split("-").reverse().join(".")}</p>
        <p className="info26-lead">{g.lead}</p>
        {g.sections.map((s) => (
          <section key={s.h} className="info26-sec">
            <h2>{s.h}</h2>
            {s.p?.map((t, i) => <p key={i}>{t}</p>)}
            {s.list && (
              <ul>
                {s.list.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section className="info26-sec info26-links">
          <h2>Passend dazu</h2>
          <ul>
            {g.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>
                  <Icon name="arrow" /> {l.label}
                </Link>
              </li>
            ))}
            {more.map((m) => (
              <li key={m.slug}>
                <Link to="/ratgeber/$slug" params={{ slug: m.slug }}>
                  <Icon name="arrow" /> {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
      <Footer />
    </div>
  );
}
