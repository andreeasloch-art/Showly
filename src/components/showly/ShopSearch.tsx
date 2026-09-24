/* Suchleiste im Kostüm-Shop, mit Vorschlägen.
 *
 * Gebaut wie die Künstlersuche auf der Startseite: Beim Tippen erscheinen die
 * Kostüme mit Bild, Kategorie und Preis, dazu die passenden Kategorien. */
import { useEffect, useMemo, useRef, useState } from "react";
import { SHOP_ITEMS, SHOP_TABS, type ShopItem } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, shopBg } from "@/showly/ui";

const TEXT = {
  de: { ph: "Kostüm suchen …", items: "Kostüme", cats: "Kategorien", none: "Nichts gefunden. Probier einen anderen Begriff.", all: "Alle anzeigen", from: "ab", hint: "Pfeiltasten zum Wechseln, Enter zum Auswählen." },
  en: { ph: "Search costumes …", items: "Costumes", cats: "Categories", none: "Nothing found. Try another word.", all: "Show all", from: "from", hint: "Arrow keys to move, Enter to pick." },
  es: { ph: "Buscar disfraz …", items: "Disfraces", cats: "Categorías", none: "Sin resultados. Prueba otra palabra.", all: "Ver todo", from: "desde", hint: "Flechas para moverte, Enter para elegir." },
} as const;

type Row = { kind: "item"; item: ShopItem } | { kind: "cat"; id: string; label: string; count: number };

export function ShopSearch({
  value,
  onChange,
  onPickCat,
  items: pool = SHOP_ITEMS,
  tabs = SHOP_TABS,
  placeholder,
  itemsLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickCat: (id: string) => void;
  items?: ShopItem[];
  tabs?: { id: string; k: string }[];
  placeholder?: string | undefined;
  itemsLabel?: string | undefined;
}) {
  const { lang, L, fmt, t } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim().toLowerCase();

  const rows: Row[] = useMemo(() => {
    const hit = (i: ShopItem) => {
      if (!q) return true;
      return [L(i.name), L(i["desc"]), i.cat].join(" ").toLowerCase().includes(q);
    };
    const items = pool.filter(hit).slice(0, 6);
    const cats = tabs.filter((tb) => tb.id !== "all")
      .map((tb) => ({
        id: tb.id,
        label: t(tb.k),
        count: pool.filter((i) => i.cat === tb.id).length,
      }))
      .filter((c) => c.count > 0 && (!q || c.label.toLowerCase().includes(q)))
      .slice(0, q ? 3 : 5);

    return [
      ...items.map((i) => ({ kind: "item", item: i }) as Row),
      ...cats.map((c) => ({ kind: "cat", ...c }) as Row),
    ];
  }, [q, L, t, pool, tabs]);

  useEffect(() => setActive(0), [q]);

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
    if (row.kind === "item") {
      onChange(String(L(row.item.name)));
    } else {
      onChange("");
      onPickCat(row.id);
    }
  }

  function keys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) return setOpen(true);
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
    <div className="shop-search">
      <div className="ac-wrap aa-wrap" ref={wrap}>
        <div className="shop-search-field">
          <Icon name="search" />
          <input
            type="search"
            value={value}
            placeholder={placeholder ?? T.ph}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={keys}
            role="combobox"
            aria-expanded={open}
            aria-controls="shop-ac"
            aria-autocomplete="list"
            autoComplete="off"
          />
          {value && (
            <button className="shop-search-clear" onClick={() => onChange("")} aria-label="✕">
              ✕
            </button>
          )}
        </div>

        {open && (
          <div className="ac-list aa-list" id="shop-ac" role="listbox">
            {rows.length === 0 && <div className="ac-empty">{T.none}</div>}

            {rows.some((r) => r.kind === "item") && <div className="aa-head">{itemsLabel ?? T.items}</div>}
            {rows.map((row, i) =>
              row.kind === "item" ? (
                <button
                  key={"i" + row.item.id}
                  className="aa-item"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(row)}
                >
                  <span className="aa-img" style={shopBg(row.item)} />
                  <span className="aa-text">
                    <span className="aa-name">{String(L(row.item.name))}</span>
                    <span className="aa-meta">{t("shop." + row.item.cat)}</span>
                  </span>
                  <span className="aa-price">
                    {T.from} {fmt(row.item.rent > 0 ? row.item.rent : row.item.buy)}
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
                    <Icon name="bag" />
                  </span>
                  <span className="aa-text">
                    <span className="aa-name">{row.label}</span>
                    <span className="aa-meta">
                      {row.count} {row.count === 1 ? "Stück" : "Stücke"}
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
    </div>
  );
}
