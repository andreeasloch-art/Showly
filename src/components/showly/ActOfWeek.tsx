import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARTISTS, type Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, Icon, bgOf } from "@/showly/ui";

/* Act der Woche im Kopfbereich der Startseite.
 *
 * Es steht immer genau ein Profil da, groß. Nach fünf Sekunden gleitet es
 * nach unten aus dem Rahmen, und von oben rückt das nächste nach. Die
 * Balken über der Karte zeigen wie bei Instagram-Storys, wo man ist und wie
 * lange das aktuelle Profil noch steht. Ein Klick auf einen Balken springt
 * direkt zu diesem Profil.
 *
 * Die Auswahl wechselt jede Woche. Sie hängt an der Kalenderwoche in UTC,
 * damit Server und Browser dieselben Acts zeigen. Planer sind keine Acts und
 * kommen nicht in die Auswahl.
 *
 * Die bezahlte Platzierung "Top Act der Woche" ist davon getrennt: sie steht,
 * wenn gebucht, als eigenes Band direkt unter dem Kopfbereich und ist dort
 * als bezahlt gekennzeichnet.
 *
 * Mit der Maus über der Karte oder mit dem Fokus darin hält der Wechsel an.
 * Wer weniger Bewegung eingestellt hat, sieht kein automatisches Weiterrücken;
 * die Balken bleiben zum Umschalten. */

const COPY = {
  de: {
    label: "Act der Woche",
    of: (i: number, n: number) => `Profil ${i} von ${n}`,
    view: "Profil ansehen",
  },
  en: {
    label: "Act of the week",
    of: (i: number, n: number) => `Profile ${i} of ${n}`,
    view: "View profile",
  },
  es: {
    label: "Artista de la semana",
    of: (i: number, n: number) => `Perfil ${i} de ${n}`,
    view: "Ver perfil",
  },
} as const;

const SHOW_MS = 5000;
const PICKS = 5;

function picksForWeek(): Artist[] {
  const pool = ARTISTS.filter((a) => a["kind"] !== "planner").sort((x, y) => x.id - y.id);
  if (pool.length <= PICKS) return pool;
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  const start = (week * PICKS) % pool.length;
  return Array.from({ length: PICKS }, (_, k) => pool[(start + k) % pool.length]!);
}

export function ActOfWeek() {
  const { t, L, fmt, num, lang, catLabel } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const picks = useMemo(picksForWeek, []);
  const n = picks.length;

  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const elapsed = useRef(0);

  function go(next: number) {
    if (next === cur) return;
    elapsed.current = 0;
    setPrev(cur);
    setCur(next);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    if (n < 3) return;
    /* Gemessen wird die tatsächlich vergangene Zeit, nicht die Zahl der
       Zeitgeber-Aufrufe: Browser bremsen Zeitgeber aus, etwa bei hoher
       Last, und dann liefe der Wechsel sonst zu langsam. */
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (paused || document.hidden) return;
      elapsed.current += delta;
      if (elapsed.current >= SHOW_MS) {
        elapsed.current = 0;
        setCur((c) => {
          setPrev(c);
          return (c + 1) % n;
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [paused, n]);

  return (
    <div
      className={"aotw" + (paused ? " paused" : "") + (still ? " still-all" : "")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="aotw-head">
        <span className="aotw-label">
          <Icon name="trophy" /> {C.label}
        </span>
        <div className="aotw-bars">
          {picks.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={"aotw-bar" + (i < cur ? " done" : "") + (i === cur ? " on" : "")}
              onClick={() => go(i)}
              aria-label={C.of(i + 1, n)}
              aria-current={i === cur}
            >
              {/* Neuer Schlüssel je Wechsel startet die Füllung von vorn */}
              <i key={i === cur ? "run-" + cur : "idle"} />
            </button>
          ))}
        </div>
      </div>

      <div className="aotw-stage">
        {picks.map((a, i) => {
          /* 0 = im Bild, 1 = nach unten hinaus, -1 = wartet oben */
          const slot = i === cur ? 0 : i === prev ? 1 : -1;
          const hasPackages = (a["packages"] || []).length > 0;
          return (
            <Link
              key={a.id}
              to="/kuenstler/$id"
              params={{ id: String(a.id) }}
              className={"aotw-card" + (slot === -1 ? " wait" : "")}
              style={{ ["--slot" as string]: slot }}
              tabIndex={slot === 0 ? 0 : -1}
              aria-hidden={slot !== 0}
            >
              <span className="aotw-img" style={bgOf(a)}>
                <span className="aotw-chip">
                  <CatIcon id={a.cat} /> {catLabel(a.cat)}
                </span>
                {a.superhost && (
                  <span className="aotw-chip gold">
                    <Icon name="trophy" /> {t("card.superhost")}
                  </span>
                )}
              </span>
              <span className="aotw-body">
                <span className="aotw-row">
                  <b className="aotw-name">{String(L(a.name))}</b>
                  {a.reviews > 0 ? (
                    <span className="aotw-rating">
                      <span className="star">★</span> {num(a.rating)}
                      <span className="aotw-count">({a.reviews})</span>
                    </span>
                  ) : (
                    <span className="aotw-rating">{t("card.new")}</span>
                  )}
                </span>
                <span className="aotw-meta">
                  <Icon name="pin" /> {String(L(a.loc))}
                  {a.verified && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="aotw-ok">
                        <Icon name="check" /> {t("card.verified")}
                      </span>
                    </>
                  )}
                </span>
                <span className="aotw-desc">{String(L(a.desc))}</span>
                <span className="aotw-foot">
                  <span className="aotw-price">
                    {hasPackages && <small>{t("pkg.from")} </small>}
                    <b>{fmt(Math.round(a.price * 1.2))}</b>{" "}
                    <small>{t(hasPackages ? "card.pkgUnit" : "card.hour")}</small>
                  </span>
                  <span className="aotw-go">
                    {C.view} <Icon name="arrow" />
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
