import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ARTISTS } from "@/showly/data";
import {
  cityPool,
  createGeoCache,
  filterCities,
  highlightSegments,
  parseFeatures,
  photonUrl,
  rankMatches,
  scopeFromSearch,
  searchWithScope,
  type GeoScope,
} from "@/showly/geo";
import { citiesForCountry, detectCountry } from "@/showly/country";


const geoCache = createGeoCache(60);

const LABELS = {
  de: {
    scope: "Nur spanischsprachige Länder",
    loading: "Suche läuft…",
    emptyTitle: "Keine Treffer für",
    tips: [
      "Schreibweise prüfen – Akzente sind egal (z. B. „malaga“ = „Málaga“).",
      "Nur den Ortsnamen eingeben, ohne Land oder Zusätze.",
      "Mindestens 3 Zeichen für die weltweite Adresssuche eingeben.",
    ],
    scopeHint: "Filter „nur spanischsprachige Länder“ ausschalten",
    examples: "Beispiele:",
    listLabel: "Ortsvorschläge",
    inputLabel: "Ortssuche",
    hint: "Mit Pfeiltasten navigieren, Enter zum Auswählen, Escape zum Schließen.",
  },
  en: {
    scope: "Spanish-speaking countries only",
    loading: "Searching…",
    emptyTitle: "No results for",
    tips: [
      "Check the spelling – accents don't matter (e.g. “malaga” = “Málaga”).",
      "Enter just the city name, without country or extras.",
      "Type at least 3 characters for the worldwide address search.",
    ],
    scopeHint: "Turn off the “Spanish-speaking countries only” filter",
    examples: "Examples:",
    listLabel: "Location suggestions",
    inputLabel: "Location search",
    hint: "Use arrow keys to navigate, Enter to select, Escape to close.",
  },
  es: {
    scope: "Solo países hispanohablantes",
    loading: "Buscando…",
    emptyTitle: "Sin resultados para",
    tips: [
      "Revisa la ortografía: los acentos no importan (p. ej. «malaga» = «Málaga»).",
      "Escribe solo el nombre de la ciudad, sin país ni añadidos.",
      "Escribe al menos 3 caracteres para la búsqueda mundial de direcciones.",
    ],
    scopeHint: "Desactiva el filtro «solo países hispanohablantes»",
    examples: "Ejemplos:",
    listLabel: "Sugerencias de lugares",
    inputLabel: "Búsqueda de lugar",
    hint: "Usa las flechas para navegar, Enter para seleccionar, Escape para cerrar.",
  },
} as const;

const EXAMPLES: Record<GeoScope, string[]> = {
  world: ["Berlin", "London", "Madrid"],
  es: ["Madrid", "Buenos Aires", "Ciudad de México"],
};

function currentLang(): "de" | "en" | "es" {
  if (typeof document === "undefined") return "de";
  const l = document.documentElement.lang;
  return l === "en" ? "en" : l === "es" ? "es" : "de";
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  onSelect,
  scope: scopeProp,
  showScopeToggle = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  onSelect?: (v: string) => void;
  /** Fixiert die Suche auf "es" (Spanien + Lateinamerika) oder "world". */
  scope?: GeoScope;
  showScopeToggle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const urlScope = scopeFromSearch(location.searchStr || "");
  const scope = scopeProp ?? urlScope;
  const wrapRef = useRef<HTMLDivElement>(null);
  // Sprache erst nach der Hydration lesen (verhindert SSR-Mismatch).
  const [lang, setLang] = useState<"de" | "en" | "es">("de");
  useEffect(() => {
    setLang(currentLang());
    const el = document.documentElement;
    const obs = new MutationObserver(() => setLang(currentLang()));
    obs.observe(el, { attributes: true, attributeFilter: ["lang"] });
    return () => obs.disconnect();
  }, []);


  function setScope(next: GeoScope) {
    const href = location.pathname + searchWithScope(location.searchStr || "", next);
    router.navigate({ to: href, replace: true } as any);
  }


  const artistCities = useMemo(() => {
    const out: string[] = [];
    for (const a of ARTISTS as any[]) {
      const loc = typeof a.loc === "string" ? a.loc : a.loc?.de;
      if (loc) out.push(String(loc).split(",")[0]!.trim());
    }
    return out;
  }, []);

  // Standortland erkennen: initiale Vorschläge zeigen nur Orte aus diesem Land.
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    setCountry(detectCountry());
  }, []);

  const pool = useMemo(() => {
    if (scope === "es") return cityPool("es");
    const local = citiesForCountry(country);
    if (local.length) return local;
    return cityPool("world", artistCities);
  }, [scope, country, artistCities]);
  const local = useMemo(() => filterCities(pool, value, value.trim() ? 6 : 8), [value, pool]);


  const [remote, setRemote] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Echte Adresssuche (Straße, Hausnummer, PLZ, Ort) über Photon/OSM – debounced + gecacht.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const key = `${scope}|${lang}|${q.toLowerCase()}`;
    const cached = geoCache.get(key);
    if (cached) {
      setRemote(cached);
      setLoading(false);
      return;
    }

    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(photonUrl(q, lang, scope), { signal: ctrl.signal });
        if (!res.ok) throw new Error("geocode failed");
        const json = await res.json();
        const labels = parseFeatures(json, scope);
        geoCache.set(key, labels);
        if (id === reqId.current) setRemote(labels); // veraltete Antworten verwerfen
      } catch {
        /* offline oder abgebrochen – bisherige Vorschläge bleiben stehen */
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, scope, lang]);

  const matches = useMemo(() => {
    const all = [...local, ...remote];
    return value.trim()
      ? rankMatches(all, value, 8)
      : Array.from(new Set(all)).slice(0, 8);
  }, [local, remote, value]);

  useEffect(() => {
    setActive(0);
  }, [matches.length]);

  const listId = `${id || "ac"}-listbox`;
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const listRef = useRef<HTMLDivElement>(null);

  // Aktiven Eintrag bei Tastaturnavigation in den sichtbaren Bereich holen.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(c: string) {
    onChange(c);
    onSelect?.(c);
    setOpen(false);
  }

  const t = LABELS[lang];
  const showSkeleton = loading && matches.length === 0;

  return (
    <div className="ac-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={placeholder || t.inputLabel}
        aria-describedby={`${listId}-hint`}
        aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
            setActive(0);
            return;
          }
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (matches.length ? (i + 1) % matches.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
          } else if (e.key === "Home") {
            e.preventDefault();
            setActive(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActive(Math.max(matches.length - 1, 0));
          } else if (e.key === "Enter" && matches[active]) {
            e.preventDefault();
            pick(matches[active]!);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setActive(0);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
      />
      <span id={`${listId}-hint`} className="sr-only">
        {t.hint}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {open ? (loading ? t.loading : `${matches.length}`) : ""}
      </span>
      {open && (
        <div
          className="ac-list"
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={t.listLabel}
          aria-busy={loading}
        >
          {showScopeToggle && !scopeProp && (
            <label className="ac-scope">
              <input
                type="checkbox"
                checked={scope === "es"}
                onChange={(e) => setScope(e.target.checked ? "es" : "world")}
              />
              <span>{t.scope}</span>
            </label>
          )}
          {showSkeleton &&
            [0, 1, 2, 3].map((k) => (
              <div key={k} className="ac-skeleton" aria-hidden="true">
                <span className="ac-skeleton-bar" style={{ width: `${72 - k * 12}%` }} />
              </div>
            ))}
          {matches.map((c: string, i: number) => (
            <button
              key={c}
              type="button"
              id={optionId(i)}
              className="ac-item"
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
            >
              {highlightSegments(c, value).map((seg, k) =>
                seg.match ? (
                  <mark key={k} className="ac-mark">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={k}>{seg.text}</span>
                ),
              )}
            </button>
          ))}
          {loading && (
            <div className="ac-empty">
              <span className="ac-spinner" aria-hidden="true" />
              {t.loading}
            </div>
          )}
          {matches.length === 0 &&
            (loading ? null : (
              <div className="ac-noresult">
                <div className="ac-noresult-title">
                  {t.emptyTitle} „{value.trim()}“
                </div>
                <ul className="ac-noresult-tips">
                  {t.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                  {scope === "es" && <li>{t.scopeHint}</li>}
                </ul>
                <div className="ac-noresult-ex">
                  <span>{t.examples}</span>
                  {EXAMPLES[scope].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="ac-chip"
                      onClick={() => {
                        onChange(ex);
                        setOpen(true);
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ))}

        </div>
      )}
    </div>
  );
}
