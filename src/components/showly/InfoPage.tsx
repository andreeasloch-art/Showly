/* Gemeinsamer Aufbau für Informationsseiten (Über Showly, So funktioniert's).
 *
 * Für Suchmaschinen und KI-Suchen: Gleich unter der Überschrift steht eine
 * kurze, direkte Antwort (lead), danach Abschnitte mit klaren Sätzen, die
 * einzeln zitierbar sind, und am Ende Verweise auf die passenden Seiten. Alles
 * wird auf dem Server gerendert, ohne aufklappbare Inhalte. */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Icon } from "@/showly/ui";

export interface InfoSection {
  h: string;
  p?: string[];
  list?: ReactNode[];
}

export interface InfoLink {
  to: string;
  label: string;
}

export function InfoPage({
  crumb,
  h1,
  lead,
  sections,
  links,
  cta,
}: {
  crumb: string;
  h1: string;
  lead: string;
  sections: InfoSection[];
  links: { h: string; items: InfoLink[] };
  cta: { label: string; to: string; second?: InfoLink };
}) {
  return (
    <div className="page active ui26 help26 info26">
      <div className="help26-wrap">
        {/* Bewusst kein nav-Element: nav erbt hier die Gestaltung der fixierten Kopfzeile */}
        <div className="info26-crumbs" role="navigation" aria-label="Brotkrumen">
          <Link to="/">Showly</Link> <span aria-hidden="true">›</span> <span aria-current="page">{crumb}</span>
        </div>
        <h1>{h1}</h1>
        <p className="info26-lead">{lead}</p>
        {sections.map((s) => (
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
        <div className="info26-cta">
          <Link to={cta.to} className="home-btn primary">
            {cta.label}
          </Link>
          {cta.second && (
            <Link to={cta.second.to} className="home-btn">
              {cta.second.label}
            </Link>
          )}
        </div>
        <section className="info26-sec info26-links">
          <h2>{links.h}</h2>
          <ul>
            {links.items.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>
                  <Icon name="arrow" /> {l.label}
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
