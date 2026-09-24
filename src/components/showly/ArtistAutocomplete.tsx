/* Vorschläge im Suchfeld der Startseite.
 *
 * Beim Tippen erscheinen nur Kategorien, keine einzelnen Profile: Wer
 * "Zauberer" wählt, soll danach noch Datum und Ort eintragen und dann die
 * passenden Profile sehen. Gesucht wird auch über ähnliche Wörter, "Magier"
 * findet Zauberer, "Sänger" findet Musiker (siehe catTerms.ts). */
import { useEffect, useMemo, useRef, useState } from "react";
import { ARTISTS, CATS } from "@/showly/data";
import { catScore } from "@/showly/catTerms";
import { useShowly } from "@/showly/store";
import { CatIcon } from "@/showly/ui";

const LABELS = {
  de: {
    cats: "Kategorien",
    pick: "Wählen",
    none: "Keine passende Kategorie. Probier ein anderes Wort, etwa Zauberer, Musiker oder DJ.",
    hint: "Pfeiltasten zum Wechseln, Enter zum Auswählen, Escape zum Schließen.",
    one: "Profil",
    many: "Profile",
    list: "Vorschläge",
  },
  en: {
    cats: "Categories",
    pick: "Select",
    none: "No matching category. Try another word, like magician, musician or DJ.",
    hint: "Arrow keys to move, Enter to select, Escape to close.",
    one: "profile",
    many: "profiles",
    list: "Suggestions",
  },
  es: {
    cats: "Categorías",
    pick: "Elegir",
    none: "Ninguna categoría coincide. Prueba otra palabra, como mago, músico o DJ.",
    hint: "Flechas para moverte, Enter para elegir, Escape para cerrar.",
    one: "perfil",
    many: "perfiles",
    list: "Sugerencias",
  },
} as const;

type Row = { kind: "cat"; id: string; count: number };

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
  const { lang, catLabel } = useShowly();
  const T = LABELS[(lang as "de" | "en" | "es") ?? "de"] ?? LABELS.de;
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim();

  const rows: Row[] = useMemo(
    () =>
      CATS.filter((c) => c.id !== "all")
        .map((c) => ({
          id: c.id,
          count: ARTISTS.filter((a) => a.cat === c.id).length,
          score: q ? catScore(c.id, q, catLabel(c.id)) : 1,
        }))
        .filter((c) => c.count > 0 && c.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, q ? 6 : 8)
        .map((c) => ({ kind: "cat", id: c.id, count: c.count }) as Row),
    [q, catLabel],
  );

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
    onChange(catLabel(row.id));
    onPickCat(row.id);
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
        <div
          className="ac-list aa-list"
          id="aa-list"
          role="listbox"
          aria-label={T.list}
        >
          {rows.length === 0 && <div className="ac-empty">{T.none}</div>}

          {rows.length > 0 && <div className="aa-head">{T.cats}</div>}
          {rows.map((row, i) => (
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
                  {row.count} {row.count === 1 ? T.one : T.many}
                </span>
              </span>
              <span className="aa-price">{T.pick} →</span>
            </button>
          ))}

          <div className="aa-hint">{T.hint}</div>
        </div>
      )}
    </div>
  );
}
