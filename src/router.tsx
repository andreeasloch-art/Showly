import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    /* Seitenwechsel gleiten wie in einer App (View Transitions). Browser
       ohne Unterstützung wechseln wie bisher sofort. */
    defaultViewTransition: true,
    /* Vorausladen: Zeigt jemand auf einen Link (Maus) oder berührt ihn
       (Handy), lädt die Zielseite schon im Hintergrund. Beim Loslassen bzw.
       Klicken ist sie dann meist schon da. Das Geladene bleibt 30 Sekunden
       frisch, damit der Klick es auch wirklich verwendet. */
    defaultPreload: "intent",
    defaultPreloadDelay: 60,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
