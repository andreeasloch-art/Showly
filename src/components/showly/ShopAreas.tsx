import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

export type ShopArea = "kostueme" | "deko" | "torten";

const LABEL: Record<"de" | "en" | "es", Record<"kostueme" | "deko", string>> = {
  de: { kostueme: "Kostüme", deko: "Deko" },
  en: { kostueme: "Costumes", deko: "Decor" },
  es: { kostueme: "Disfraces", deko: "Decoración" },
};

/* Umschalter oben im Shop. Kostüme, Deko und Torten & Süßes sind ein
 * gemeinsamer Shop: Torten liegen zwar unter /torten, der Reiter führt aber
 * genauso dorthin wie die beiden anderen, und die Leiste unten zeigt dort
 * ebenfalls "Shop" als aktiv. */
export function ShopAreas({ active }: { active: ShopArea }) {
  const { t, lang } = useShowly();
  const navigate = useNavigate();
  const L = LABEL[lang as "de" | "en" | "es"] || LABEL.de;

  function go(a: ShopArea) {
    if (a === active) return;
    if (a === "torten") void navigate({ to: "/torten" });
    else void navigate({ to: "/shop", search: a === "deko" ? { bereich: "deko" } : {}, resetScroll: active === "torten" });
  }

  const tabs: { id: ShopArea; icon: string; label: string }[] = [
    { id: "kostueme", icon: "mask", label: L.kostueme },
    { id: "deko", icon: "party", label: L.deko },
    { id: "torten", icon: "gift", label: t("nav.sweets") },
  ];

  return (
    <div className="shop-area rise" role="tablist" style={{ ["--d" as string]: "0ms" }}>
      {tabs.map((x) => (
        <button
          key={x.id}
          role="tab"
          aria-selected={active === x.id}
          className={active === x.id ? "on" : ""}
          onClick={() => go(x.id)}
        >
          <Icon name={x.icon} /> {x.label}
        </button>
      ))}
    </div>
  );
}
