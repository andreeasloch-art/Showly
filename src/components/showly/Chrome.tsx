import { Link, useRouterState } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

export function Toast() {
  const { toastMsg } = useShowly();
  return <div id="toast" className={toastMsg ? "show" : ""}>{toastMsg}</div>;
}

export function TabBar() {
  const { lang, session } = useShowly();
  const path = useRouterState({ select: (s) => s.location.pathname });
  /* Sechs Ziele (Locations seit der neuen Sparte). "Mitmachen" war auf dem Handy ueberhaupt nicht erreichbar:
     in der Kopfzeile sind die Verweise dort ausgeblendet, und in der
     Leiste unten stand der Punkt nicht. Wer sich als Kuenstler eintragen
     wollte, kam vom Telefon aus nicht hin.

     Das Konto fuehrt wie in der Kopfzeile zur Anmeldung, solange niemand
     angemeldet ist. Vorher zeigte die Leiste immer auf die Uebersicht,
     die ohne Anmeldung leer ist. */
  const items = [
    { to: "/", icon: "search", label: lang === "en" ? "Search" : lang === "es" ? "Buscar" : "Suche" },
    { to: "/locations", icon: "venue", label: lang === "es" ? "Lugares" : lang === "en" ? "Venues" : "Locations" },
    { to: "/shop", icon: "bag", label: lang === "es" ? "Tienda" : "Shop" },
    { to: "/torten", icon: "cake", label: lang === "en" ? "Cakes" : lang === "es" ? "Tartas" : "Torten" },
    { to: "/mitmachen", icon: "sparkle", label: lang === "en" ? "Join" : lang === "es" ? "Únete" : "Mitmachen" },
    {
      to: session ? "/dashboard" : "/konto",
      icon: "user",
      label: lang === "en" ? "Account" : lang === "es" ? "Cuenta" : "Konto",
    },
  ] as const;

  /* Die Leiste steht auf jeder Seite, auch im Profil, damit man von überall
     zurück zur Suche und zu den anderen Bereichen kommt. Im Profil sitzt der
     Buchungsbalken direkt darüber. */
  const isOn = (to: string) =>
    to === "/" ? path === "/" || path.startsWith("/kuenstler/") : path === to || path.startsWith(to + "/");

  return (
    <div className="tabbar" role="navigation" aria-label="Hauptnavigation">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className={"tab" + (isOn(i.to) ? " active on" : "")}>
          <Icon name={i.icon} />
          <span>{i.label}</span>
        </Link>
      ))}
    </div>
  );
}
