/* Pakete für Hochzeits- und Eventplaner: Basic, Premium, Luxus.
 * Je Paket Preis, Umfang, eigene Leistungspunkte (frei eingeben, z. B.
 * „Dekoration“) und ein Beschreibungstext. Regeln in showly/plannerPackages.ts. */
import { useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { ContactHint } from "@/components/showly/ContactHint";
import { MAX_ITEMS, TIERS, TIER_ICON, TIER_LABEL, type PlannerPackage, type Tier } from "@/showly/plannerPackages";

type Lang = "de" | "en" | "es";

export const PKG_COPY = {
  de: {
    h: "Deine Pakete",
    p: "Biete drei Pakete an: Basic, Premium und Luxus. Kunden sehen sie in deinem Profil und buchen zum Festpreis. Leistungen gibst du selbst ein, einzeln und so ausführlich, wie du möchtest.",
    on: "Paket anbieten",
    name: "Name",
    price: "Preis",
    dur: "Umfang (optional)",
    durPh: "z. B. bis 80 Gäste, 6 Monate Begleitung",
    items: "Leistungen",
    itemPh: "z. B. Dekoration, Ablaufplan, Betreuung am Tag",
    add: "Hinzufügen",
    remove: "Entfernen",
    text: "Beschreibung",
    textPh: "Was genau ist enthalten, wie läuft die Zusammenarbeit, was ist nicht enthalten …",
    popular: "Als „beliebt“ hervorheben",
    maxItems: `Höchstens ${MAX_ITEMS} Leistungen je Paket.`,
    errNone: "Bitte mindestens ein Paket mit Preis anbieten.",
    errItems: "Bitte bei jedem Paket mindestens eine Leistung eintragen.",
    errOrder: "Die Pakete sollten im Preis steigen: Basic ≤ Premium ≤ Luxus.",
    errPrice: "Preis zwischen 50 € und 100.000 € angeben.",
    fixed: "Festpreis",
  },
  en: {
    h: "Your packages",
    p: "Offer three packages: Basic, Premium and Luxury. Customers see them on your profile and book at a fixed price. You enter the services yourself, one by one and as detailed as you like.",
    on: "Offer this package",
    name: "Name",
    price: "Price",
    dur: "Scope (optional)",
    durPh: "e.g. up to 80 guests, 6 months of support",
    items: "Services",
    itemPh: "e.g. decoration, schedule, on-the-day coordination",
    add: "Add",
    remove: "Remove",
    text: "Description",
    textPh: "What exactly is included, how you work together, what is not included …",
    popular: "Highlight as “popular”",
    maxItems: `At most ${MAX_ITEMS} services per package.`,
    errNone: "Please offer at least one package with a price.",
    errItems: "Please add at least one service to each package.",
    errOrder: "Prices should rise: Basic ≤ Premium ≤ Luxury.",
    errPrice: "Enter a price between €50 and €100,000.",
    fixed: "fixed price",
  },
  es: {
    h: "Tus paquetes",
    p: "Ofrece tres paquetes: Básico, Premium y Lujo. Los clientes los ven en tu perfil y reservan a precio fijo. Los servicios los escribes tú, uno a uno y con todo el detalle que quieras.",
    on: "Ofrecer este paquete",
    name: "Nombre",
    price: "Precio",
    dur: "Alcance (opcional)",
    durPh: "p. ej. hasta 80 invitados, 6 meses de acompañamiento",
    items: "Servicios",
    itemPh: "p. ej. decoración, cronograma, coordinación el día",
    add: "Añadir",
    remove: "Quitar",
    text: "Descripción",
    textPh: "Qué incluye exactamente, cómo trabajáis juntos, qué no incluye …",
    popular: "Destacar como «popular»",
    maxItems: `Como máximo ${MAX_ITEMS} servicios por paquete.`,
    errNone: "Ofrece al menos un paquete con precio.",
    errItems: "Añade al menos un servicio a cada paquete.",
    errOrder: "Los precios deberían subir: Básico ≤ Premium ≤ Lujo.",
    errPrice: "Indica un precio entre 50 € y 100.000 €.",
    fixed: "precio fijo",
  },
} as const;

export function usePkgCopy() {
  const { lang } = useShowly();
  return PKG_COPY[(lang as Lang) ?? "de"] ?? PKG_COPY.de;
}

/** Entwurf je Stufe; Preis als Text, damit die Eingabe frei bleibt */
export type PkgDraft = { on: boolean; name: string; price: string; dur: string; inc: string[]; text: string; popular: boolean };
export type PkgDrafts = Record<Tier, PkgDraft>;

export function draftsFrom(list: PlannerPackage[], lang: Lang): PkgDrafts {
  const out = {} as PkgDrafts;
  for (const t of TIERS) {
    const p = list.find((x) => x.id === t);
    out[t] = p
      ? { on: true, name: p.name, price: String(p.price), dur: p.dur, inc: [...p.inc], text: p.text, popular: !!p.popular }
      : { on: false, name: TIER_LABEL[t][lang], price: "", dur: "", inc: [], text: "", popular: false };
  }
  return out;
}

export function draftsToRaw(d: PkgDrafts): unknown[] {
  return TIERS.filter((t) => d[t].on).map((t) => ({ id: t, ...d[t] }));
}

export function PackagesEditor({ value, onChange }: { value: PkgDrafts; onChange: (v: PkgDrafts) => void }) {
  const { lang, toast } = useShowly();
  const C = usePkgCopy();
  const l = (lang as Lang) ?? "de";
  const [input, setInput] = useState<Record<Tier, string>>({ basic: "", premium: "", luxus: "" });
  const up = (t: Tier, patch: Partial<PkgDraft>) => {
    const next = { ...value, [t]: { ...value[t], ...patch } };
    /* nur ein Paket „beliebt“ */
    if (patch.popular) for (const o of TIERS) if (o !== t) next[o] = { ...next[o], popular: false };
    onChange(next);
  };
  function addItem(t: Tier) {
    const v = input[t].replace(/\s+/g, " ").trim().slice(0, 80);
    if (!v) return;
    if (value[t].inc.length >= MAX_ITEMS) return toast(C.maxItems);
    if (!value[t].inc.includes(v)) up(t, { inc: [...value[t].inc, v] });
    setInput((i) => ({ ...i, [t]: "" }));
  }
  return (
    <section className="pe-card">
      <div className="pe-card-head">
        <span className="pe-ic">
          <Icon name="gift" />
        </span>
        <div>
          <h3>{C.h}</h3>
          <p>{C.p}</p>
        </div>
      </div>
      <div className="pkg-edit-grid">
        {TIERS.map((t) => {
          const d = value[t];
          return (
            <fieldset key={t} className={"pkg-edit tier-" + t + (d.on ? " on" : "")}>
              <legend>
                <Icon name={TIER_ICON[t]} /> {TIER_LABEL[t][l]}
              </legend>
              <label className="food-none">
                <input type="checkbox" checked={d.on} onChange={(e) => up(t, { on: e.target.checked })} />
                {C.on}
              </label>
              {d.on && (
                <>
                  <div className="pe-grid2">
                    <label className="pe-field">
                      <span className="pe-label">{C.name}</span>
                      <input value={d.name} maxLength={40} onChange={(e) => up(t, { name: e.target.value })} />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">
                        {C.price} ({C.fixed})
                      </span>
                      <span className="pe-money">
                        <input inputMode="decimal" value={d.price} placeholder={t === "basic" ? "900" : t === "premium" ? "2.500" : "5.000"} onChange={(e) => up(t, { price: e.target.value })} />
                        <span>€</span>
                      </span>
                    </label>
                  </div>
                  <label className="pe-field">
                    <span className="pe-label">{C.dur}</span>
                    <input value={d.dur} maxLength={60} placeholder={C.durPh} onChange={(e) => up(t, { dur: e.target.value })} />
                  </label>
                  <div className="pe-field">
                    <span className="pe-label">{C.items}</span>
                    {d.inc.length > 0 && (
                      <ul className="pkg-edit-items">
                        {d.inc.map((x, i) => (
                          <li key={x}>
                            <Icon name="check" />
                            <span className="pkg-item-text">{x}</span>
                            <button
                              type="button"
                              aria-label={`${C.remove}: ${x}`}
                              onClick={() => up(t, { inc: d.inc.filter((_, k) => k !== i) })}
                            >
                              <Icon name="close" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="pkg-edit-add">
                      <input
                        value={input[t]}
                        maxLength={80}
                        placeholder={C.itemPh}
                        aria-label={C.items}
                        onChange={(e) => setInput((i) => ({ ...i, [t]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addItem(t);
                          }
                        }}
                      />
                      <button type="button" className="home-btn soft" onClick={() => addItem(t)}>
                        <Icon name="plus" /> {C.add}
                      </button>
                    </div>
                  </div>
                  <label className="pe-field">
                    <span className="pe-label">{C.text}</span>
                    <textarea value={d.text} maxLength={1500} rows={4} placeholder={C.textPh} onChange={(e) => up(t, { text: e.target.value })} />
                  </label>
                  <ContactHint text={[d.name, d.dur, d.text, ...d.inc].join("\n")} />
                  <label className="food-none">
                    <input type="checkbox" checked={d.popular} onChange={(e) => up(t, { popular: e.target.checked })} />
                    {C.popular}
                  </label>
                </>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
