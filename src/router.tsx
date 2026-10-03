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
    defaultPreloadStaleTime: 0,
  });

  return router;
};
