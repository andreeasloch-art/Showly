/* Vorschläge im Suchfeld der Startseite.
 *
 * Beim Tippen erscheinen sofort die Künstler, die wir anbieten, dazu die
 * passenden Kategorien. Ein Klick auf einen Namen führt direkt ins Profil,
 * ein Klick auf eine Kategorie filtert die Liste darunter. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ARTISTS, CATS, type Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, bgOf } from "@/showly/ui";

const LABELS = {
  de: {
    artists: "Künstler",
    cats: "Kategorien",
    all: "Alle anzeigen",
    none: "Kein Treffer. Probier einen anderen Begriff oder eine Kategorie.",
    hint: "Pfeiltasten zum Wechseln, Enter zum Öffnen, Escape zum Schließen.",
    from: "ab",
    list: "Vorschläge",
  },
  en: {
    artists: "Artists",
    cats: "Categories",
    all: "Show all",
    none: "No match. Try another word or a category.",
    hint: "Arrow keys to move, Enter to open, Escape to close.",
    from: "from",
    list: "Suggestions",
  },
  es: {
    artists: "Artistas",
    cats: "Categorías",
    all: "Ver todo",
    none: "Sin resultados. Prueba otra palabra o una categoría.",
    hint: "Flechas para moverte, Enter para abrir, Escape para cerrar.",
    from: "desde",
    list: "Sugerencias",
  },
} as const;

type Row =
  | { kind: "artist"; artist: Artist }
  | { kind: "cat"; id: string; count: number };

export function ArtistAutocomplete({
  value,
  onChange,
  onPickCat,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickCat: (id: string) => void;
  placeholder?: string;
}) {
  const { lang, L, fmt, catLabel, t } = useShowly();
  const T = LABELS[(lang as "de" | "en" | "es") ?? "de"] ?? LABELS.de;
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim().toLowerCase();

  const rows: Row[] = useMemo(() => {
    const match = (a: Artist) => {
      if (!q) return true;
      const hay = [L(a.name), L(a.loc), catLabel(a.cat), L(a.desc)]
        .concat((L(a.tags) as string[]) || [])
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    };
    const artists = ARTISTS.filter(match).slice(0, 6);

    const cats = CATS.filter((c) => c.id !== "all")
      .map((c) => ({
        id: c.id,
        count: ARTISTS.filter((a) => a.cat === c.id).length,
        hit: !q || catLabel(c.id).toLowerCase().includes(q),
      }))
      .filter((c) => c.count > 0 && c.hit)
      .slice(0, q ? 4 : 6);

    return [
      ...artists.map((a) => ({ kind: "artist", artist: a }) as Row),
      ...cats.map((c) => ({ kind: "cat", id: c.id, count: c.count }) as Row),
    ];
  }, [q, L, catLabel]);

  useEffect(() => setActive(0), [q]);

  /* Klick daneben schließt die Liste */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function choose(row: Row) {
    setOpen(false);
    if (row.kind === "artist") {
      navigate({ to: "/kuenstler/$id", params: { id: String(row.artist.id) } });
    } else {
      onChange("");
      onPickCat(row.id);
    }
  }

  function keys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const row = rows[active];
      if (open && row) {
        e.preventDefault();
        choose(row);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="ac-wrap aa-wrap" ref={wrap}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={keys}
        role="combobox"
        aria-expanded={open}
        aria-controls="aa-list"
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && (
        <div className="ac-list aa-list" id="aa-list" role="listbox" aria-label={T.list}>
          {rows.length === 0 && <div className="ac-empty">{T.none}</div>}

          {rows.some((r) => r.kind === "artist") && <div className="aa-head">{T.artists}</div>}
          {rows.map((row, i) =>
            row.kind === "artist" ? (
              <button
                key={"a" + row.artist.id}
                className="aa-item"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
              >
                <span className="aa-img" style={bgOf(row.artist, "center 28%")} />
                <span className="aa-text">
                  <span className="aa-name">{String(L(row.artist.name))}</span>
                  <span className="aa-meta">
                    {catLabel(row.artist.cat)} · {String(L(row.artist.loc))}
                  </span>
                </span>
                <span className="aa-price">
                  {T.from} {fmt(Math.round(row.artist.price * 1.2))}
                  <small className="aa-unit">
                    {" "}
                    {t(
                      ((row.artist as { packages?: unknown[] }).packages || []).length
                        ? "card.pkgUnit"
                        : "card.hour",
                    )}
                  </small>
                </span>
              </button>
            ) : null,
          )}

          {rows.some((r) => r.kind === "cat") && <div className="aa-head">{T.cats}</div>}
          {rows.map((row, i) =>
            row.kind === "cat" ? (
              <button
                key={"c" + row.id}
                className="aa-item aa-cat"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
              >
                <span className="aa-cat-icon">
                  <CatIcon id={row.id} />
                </span>
                <span className="aa-text">
                  <span className="aa-name">{catLabel(row.id)}</span>
                  <span className="aa-meta">
                    {row.count} {row.count === 1 ? "Profil" : "Profile"}
                  </span>
                </span>
                <span className="aa-price">{T.all} →</span>
              </button>
            ) : null,
          )}

          <div className="aa-hint">{T.hint}</div>
        </div>
      )}
    </div>
  );
}
