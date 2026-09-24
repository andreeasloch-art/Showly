/* Künstlerprofile in einem Beitrag markieren.
 *
 * Ein Event hat oft mehrere Acts, deshalb sind mehrere Markierungen möglich.
 * Statt einer langen Auswahlliste wird getippt und gefiltert: bei 25 Profilen
 * findet man so schneller den richtigen. */
import { useMemo, useRef, useState } from "react";
import { ARTISTS, type Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, bgOf } from "@/showly/ui";

const TEXT = {
  de: {
    label: "Wer ist aufgetreten?",
    hint: "Tippe einen Namen, mehrere Acts sind möglich",
    ph: "Name oder Kategorie …",
    none: "Kein Profil gefunden.",
    remove: "Markierung entfernen",
    me: "Dein eigenes Profil",
  },
  en: {
    label: "Who performed?",
    hint: "Type a name, several acts are possible",
    ph: "Name or category …",
    none: "No profile found.",
    remove: "Remove tag",
    me: "Your own profile",
  },
  es: {
    label: "¿Quién actuó?",
    hint: "Escribe un nombre, puedes marcar varios",
    ph: "Nombre o categoría …",
    none: "No se encontró ningún perfil.",
    remove: "Quitar marca",
    me: "Tu propio perfil",
  },
} as const;

export function ArtistTagPicker({
  value,
  onChange,
  ownId,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  ownId?: number;
}) {
  const { lang, L, catLabel } = useShowly();
  const T = TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const chosen = value
    .map((id) => ARTISTS.find((a) => a.id === id))
    .filter((a): a is Artist => !!a);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ARTISTS.filter((a) => {
      if (value.includes(a.id)) return false;
      if (!needle) return true;
      return [L(a.name), catLabel(a.cat), L(a.loc)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    }).slice(0, 6);
  }, [q, value, L, catLabel]);

  function add(id: number) {
    onChange([...value, id]);
    setQ("");
    setOpen(false);
  }

  return (
    <div className="tagpick" ref={wrap}>
      <span className="tagpick-label">{T.label}</span>

      {chosen.length > 0 && (
        <div className="tagpick-chosen">
          {chosen.map((a) => (
            <span className="tagpick-chip" key={a.id}>
              <span className="tagpick-chip-img" style={bgOf(a, "center 26%")} />
              <span className="tagpick-chip-name">
                {String(L(a.name))}
                {a.id === ownId && <em> · {T.me}</em>}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== a.id))}
                aria-label={T.remove}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="tagpick-field">
        <Icon name="search" />
        <input
          value={q}
          placeholder={T.ph}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          aria-label={T.label}
        />
      </div>
      <span className="tagpick-hint">{T.hint}</span>

      {open && (
        <div className="tagpick-list">
          {hits.length === 0 && <div className="ac-empty">{T.none}</div>}
          {hits.map((a) => (
            <button type="button" className="tagpick-item" key={a.id} onClick={() => add(a.id)}>
              <span className="tagpick-img" style={bgOf(a, "center 26%")} />
              <span className="tagpick-text">
                <span className="tagpick-name">{String(L(a.name))}</span>
                <span className="tagpick-meta">
                  {catLabel(a.cat)} · {String(L(a.loc))}
                </span>
              </span>
              <span className="tagpick-add">
                <Icon name="plus" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
