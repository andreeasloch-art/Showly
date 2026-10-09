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
          <b>{G.eyebrow}: {G.short.split(": ")[1] ?? G.short}</b>
          <span className="guar-chips">
            {G.tiles.map((x) => (
              <span key={x.t}>
                <Icon name={x.icon} /> {x.t}
              </span>
            ))}
          </span>
          <small>{G.lead}</small>
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

/** Bereich auf der Startseite: Versprechen in einem Satz, vier Kacheln zum
 *  Überfliegen und der Vergleich mit einer Direktbuchung */
export function GuaranteeSection() {
  const { lang } = useShowly();
  const G = guaranteeCopy(lang);
  return (
    <section id="sicher-buchen" className="guar-section" aria-labelledby="guar-h" data-reveal>
      <div className="guar-card">
        <div className="guar-top">
          <span className="guar-seal" aria-hidden="true">
            <Icon name="shield" />
          </span>
          <div>
            <span className="guar-eyebrow">{G.eyebrow}</span>
            <h2 id="guar-h">{G.title}</h2>
            <p className="guar-lead">{G.lead}</p>
          </div>
        </div>

        <ul className="guar-tiles">
          {G.tiles.map((x) => (
            <li key={x.t}>
              <span className="guar-tile-ic" aria-hidden="true">
                <Icon name={x.icon} />
              </span>
              <b>{x.t}</b>
              <span>{x.d}</span>
            </li>
          ))}
        </ul>

        <div className="guar-vs">
          <h3>{G.vsH}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{G.vsH}</span>
                </th>
                <th scope="col" className="us">{G.vsUs}</th>
                <th scope="col">{G.vsThem}</th>
              </tr>
            </thead>
            <tbody>
              {G.vs.map((row) => (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  <td className="us">
                    <span className="guar-yes" aria-label="ja">
                      <Icon name="check" />
                    </span>
                  </td>
                  <td>
                    <span className="guar-no" aria-label="nein">
                      <Icon name="close" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="guar-note">
            <Icon name="lock" /> {G.note}
          </p>
        </div>
      </div>
    </section>
  );
}
