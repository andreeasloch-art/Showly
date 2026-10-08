/* Ersatzgarantie sichtbar machen: kurzes Abzeichen (Profil, Kasse) und
 * Bereich auf der Startseite. Inhalt in showly/guarantee.ts. */
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { guaranteeCopy } from "@/showly/guarantee";

/** Kompakter Hinweis mit Versprechen, ausklappbar mit den Einzelheiten */
export function GuaranteeBadge({ className = "" }: { className?: string }) {
  const { lang } = useShowly();
  const G = guaranteeCopy(lang);
  return (
    <details className={"guar-badge " + className}>
      <summary>
        <span className="guar-ic" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <span>
          <b>{G.name}</b>
          <small>{G.claim}</small>
        </span>
      </summary>
      <ul>
        {G.points.map((p) => (
          <li key={p}>
            <Icon name="check" /> {p}
          </li>
        ))}
      </ul>
      <Link to="/hilfe" className="guar-link">
        {G.more} →
      </Link>
    </details>
  );
}

/** Bereich auf der Startseite: das Versprechen groß, drei Punkte, Abgrenzung */
export function GuaranteeSection() {
  const { lang } = useShowly();
  const G = guaranteeCopy(lang);
  return (
    <section className="guar-section" aria-labelledby="guar-h" data-reveal>
      <div className="guar-card">
        <span className="guar-seal" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <div className="guar-body">
          <span className="home-eyebrow">{G.name}</span>
          <h2 id="guar-h">{G.claim}</h2>
          <ul>
            {G.points.map((p) => (
              <li key={p}>
                <Icon name="check" /> <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="guar-why">{G.why}</p>
        </div>
      </div>
    </section>
  );
}
