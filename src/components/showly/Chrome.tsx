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
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  /* Fünf Ziele: Suche, Künstler, Shop (Kostüme, Deko und Torten in einem,
     umgeschaltet oben im Shop), Locations und Profil. "Mitmachen" steht im
     Profil und auf der Startseite.

     Das Profil führt wie in der Kopfzeile zur Anmeldung, solange niemand
     angemeldet ist. Vorher zeigte die Leiste immer auf die Übersicht,
     die ohne Anmeldung leer ist. */
  const items = [
    { to: "/", icon: "search", label: lang === "en" ? "Search" : lang === "es" ? "Buscar" : "Suche" },
    {
      to: "/",
      search: { zeige: "kuenstler" as const },
      key: "acts",
      icon: "mask",
      label: lang === "en" ? "Artists" : lang === "es" ? "Artistas" : "Künstler",
    },
    { to: "/shop", icon: "bag", label: lang === "es" ? "Tienda" : "Shop" },
    { to: "/locations", icon: "venue", label: lang === "es" ? "Lugares" : lang === "en" ? "Venues" : "Locations" },
    {
      to: session ? "/dashboard" : "/konto",
      icon: "user",
      label: lang === "en" ? "Profile" : lang === "es" ? "Perfil" : "Profil",
    },
  ];

  /* Die Leiste steht auf jeder Seite, auch im Künstlerprofil, damit man von
     überall zurück zur Suche und zu den anderen Bereichen kommt. Torten
     gehören zum Shop, das Künstlerprofil zu "Künstler". */
  const artists = path.startsWith("/kuenstler/") || (path === "/" && search?.["zeige"] === "kuenstler");
  const isOn = (i: (typeof items)[number]) => {
    if ("key" in i) return artists;
    if (i.to === "/") return path === "/" && !artists;
    if (i.to === "/shop") return path === "/shop" || path.startsWith("/torten");
    return path === i.to || path.startsWith(i.to + "/");
  };

  return (
    <div className="tabbar" role="navigation" aria-label="Hauptnavigation">
      {items.map((i) => (
        <Link
          key={"key" in i ? i.key : i.to}
          to={i.to}
          search={("search" in i ? i.search : {}) as never}
          /* Suche und Künstler liegen beide auf "/": nur mit genau passender
             Suche gilt der Link als aktuelle Seite */
          activeOptions={{ exact: i.to === "/", includeSearch: i.to === "/" }}
          className={"tab" + (isOn(i) ? " active on" : "")}
        >
          <Icon name={i.icon} />
          <span>{i.label}</span>
        </Link>
      ))}
    </div>
  );
}
