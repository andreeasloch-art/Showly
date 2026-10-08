/* Lebensmittel-Pflichtangaben bei Torten & Süßem (LMIV): Eingabe im
 * Anbieter-Editor (FoodFields) und Anzeige vor dem Kauf (FoodFacts).
 * Regeln und die 14 Hauptallergene in showly/cakeRules.ts. */
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { ALLERGENS, ALLERGEN_LABEL, allergenList, foodInfoComplete, type AllergenId, type FoodInfo, type Storage } from "@/showly/cakeRules";

type Lang = "de" | "en" | "es";

const COPY = {
  de: {
    h: "Allergene und Zutaten",
    p: "Pflichtangaben nach Lebensmittelrecht. Kunden sehen sie vor dem Kauf.",
    allergens: "Enthaltene Hauptallergene",
    none: "Enthält keines der 14 Hauptallergene",
    traces: "Kann Spuren enthalten von",
    ingredients: "Zutaten",
    ingredientsPh: "Weizenmehl, Zucker, Butter, Eier, Sahne, Vanille …",
    shelfLife: "Haltbarkeit",
    shelfLifePh: "z. B. 2 Tage ab Abholung",
    storage: "Lagerung",
    st: { cool: "Gekühlt (2–7 °C)", room: "Raumtemperatur, trocken", frozen: "Tiefgekühlt" } as Record<Storage, string>,
    lead: "Vorlauf für dieses Angebot (Tage)",
    leadPh: "wie im Profil",
    need: "Bitte Allergene (oder „keines“), Zutaten und Haltbarkeit angeben.",
    showH: "Allergene, Zutaten, Haltbarkeit",
    showNone: "Keines der 14 Hauptallergene",
    showTraces: "Kann Spuren enthalten von",
    missing: "Für dieses Angebot fehlen noch Allergen- und Zutatenangaben. Es kann erst bestellt werden, wenn der Anbieter sie ergänzt hat.",
    demo: "Beispielangebot: Die echten Angaben macht der jeweilige Anbieter.",
  },
  en: {
    h: "Allergens and ingredients",
    p: "Required by food law. Customers see them before buying.",
    allergens: "Major allergens contained",
    none: "Contains none of the 14 major allergens",
    traces: "May contain traces of",
    ingredients: "Ingredients",
    ingredientsPh: "Wheat flour, sugar, butter, eggs, cream, vanilla …",
    shelfLife: "Shelf life",
    shelfLifePh: "e.g. 2 days from pickup",
    storage: "Storage",
    st: { cool: "Refrigerated (2–7 °C)", room: "Room temperature, dry", frozen: "Frozen" } as Record<Storage, string>,
    lead: "Lead time for this offer (days)",
    leadPh: "as in profile",
    need: "Please enter allergens (or “none”), ingredients and shelf life.",
    showH: "Allergens, ingredients, shelf life",
    showNone: "None of the 14 major allergens",
    showTraces: "May contain traces of",
    missing: "Allergen and ingredient details are still missing for this offer. It can be ordered once the provider adds them.",
    demo: "Sample offer: real details are provided by each provider.",
  },
  es: {
    h: "Alérgenos e ingredientes",
    p: "Obligatorio por la ley alimentaria. Los clientes los ven antes de comprar.",
    allergens: "Alérgenos principales que contiene",
    none: "No contiene ninguno de los 14 alérgenos principales",
    traces: "Puede contener trazas de",
    ingredients: "Ingredientes",
    ingredientsPh: "Harina de trigo, azúcar, mantequilla, huevos, nata, vainilla …",
    shelfLife: "Consumo preferente",
    shelfLifePh: "p. ej. 2 días desde la recogida",
    storage: "Conservación",
    st: { cool: "Refrigerado (2–7 °C)", room: "Temperatura ambiente, seco", frozen: "Congelado" } as Record<Storage, string>,
    lead: "Antelación para esta oferta (días)",
    leadPh: "como en el perfil",
    need: "Indica los alérgenos (o «ninguno»), los ingredientes y la duración.",
    showH: "Alérgenos, ingredientes, duración",
    showNone: "Ninguno de los 14 alérgenos principales",
    showTraces: "Puede contener trazas de",
    missing: "Faltan los datos de alérgenos e ingredientes de esta oferta. Se podrá pedir cuando el proveedor los añada.",
    demo: "Oferta de ejemplo: los datos reales los indica cada proveedor.",
  },
} as const;

export function useFoodCopy() {
  const { lang } = useShowly();
  return COPY[(lang as Lang) ?? "de"] ?? COPY.de;
}

export const emptyFood = (): FoodInfo => ({ allergens: [], noAllergens: false, ingredients: "", shelfLife: "", storage: "cool", traces: [] });

export function FoodFields({
  f,
  onChange,
  leadDays,
  onLead,
}: {
  f: FoodInfo;
  onChange: (f: FoodInfo) => void;
  leadDays?: number | undefined;
  onLead?: (n: number | undefined) => void;
}) {
  const { lang } = useShowly();
  const C = useFoodCopy();
  const l = (lang as Lang) ?? "de";
  const toggle = (k: "allergens" | "traces", a: AllergenId) => {
    const has = f[k].includes(a);
    const next = has ? f[k].filter((x) => x !== a) : [...f[k], a];
    onChange(k === "allergens" ? { ...f, allergens: next, noAllergens: false, traces: f.traces.filter((x) => !next.includes(x)) } : { ...f, traces: next });
  };
  return (
    <fieldset className="food-fields">
      <legend className="pe-label">{C.h}</legend>
      <p className="pe-hint">{C.p}</p>
      <span className="pe-label">{C.allergens}</span>
      <div className="food-grid">
        {ALLERGENS.map((a) => (
          <label key={a} className={"food-chip" + (f.allergens.includes(a) ? " on" : "")}>
            <input type="checkbox" checked={f.allergens.includes(a)} onChange={() => toggle("allergens", a)} />
            {ALLERGEN_LABEL[a][l]}
          </label>
        ))}
      </div>
      <label className="food-none">
        <input
          type="checkbox"
          checked={f.noAllergens}
          onChange={(e) => onChange({ ...f, noAllergens: e.target.checked, allergens: e.target.checked ? [] : f.allergens })}
        />
        {C.none}
      </label>
      <details className="food-traces">
        <summary>{C.traces}</summary>
        <div className="food-grid">
          {ALLERGENS.filter((a) => !f.allergens.includes(a)).map((a) => (
            <label key={a} className={"food-chip" + (f.traces.includes(a) ? " on" : "")}>
              <input type="checkbox" checked={f.traces.includes(a)} onChange={() => toggle("traces", a)} />
              {ALLERGEN_LABEL[a][l]}
            </label>
          ))}
        </div>
      </details>
      <label className="pe-field">
        <span className="pe-label">{C.ingredients}</span>
        <textarea value={f.ingredients} maxLength={1200} placeholder={C.ingredientsPh} onChange={(e) => onChange({ ...f, ingredients: e.target.value })} />
      </label>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">{C.shelfLife}</span>
          <input value={f.shelfLife} maxLength={120} placeholder={C.shelfLifePh} onChange={(e) => onChange({ ...f, shelfLife: e.target.value })} />
        </label>
        <label className="pe-field">
          <span className="pe-label">{C.storage}</span>
          <select value={f.storage} onChange={(e) => onChange({ ...f, storage: e.target.value as Storage })}>
            {(["cool", "room", "frozen"] as Storage[]).map((s) => (
              <option key={s} value={s}>
                {C.st[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {onLead && (
        <label className="pe-field">
          <span className="pe-label">{C.lead}</span>
          <input
            type="number"
            min={0}
            max={120}
            placeholder={C.leadPh}
            value={leadDays ?? ""}
            onChange={(e) => onLead(e.target.value === "" ? undefined : Math.min(120, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
          />
        </label>
      )}
    </fieldset>
  );
}

/** Anzeige vor dem Kauf */
export function FoodFacts({ f, demo }: { f: FoodInfo | undefined; demo?: boolean | undefined }) {
  const { lang } = useShowly();
  const C = useFoodCopy();
  const l = (lang as Lang) ?? "de";
  if (!foodInfoComplete(f))
    return <p className="food-facts food-missing">{demo ? C.demo : C.missing}</p>;
  return (
    <details className="food-facts" open>
      <summary>
        <Icon name="cake" /> {C.showH}
      </summary>
      <dl>
        <dt>{C.allergens}</dt>
        <dd>
          <b>{f.noAllergens ? C.showNone : allergenList(f, l)}</b>
        </dd>
        {f.traces.length > 0 && (
          <>
            <dt>{C.showTraces}</dt>
            <dd>{f.traces.map((a) => ALLERGEN_LABEL[a][l]).join(", ")}</dd>
          </>
        )}
        <dt>{C.ingredients}</dt>
        <dd>{f.ingredients}</dd>
        <dt>{C.shelfLife}</dt>
        <dd>
          {f.shelfLife} · {C.st[f.storage]}
        </dd>
      </dl>
      {demo && <p className="pe-hint">{C.demo}</p>}
    </details>
  );
}
