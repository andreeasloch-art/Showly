/* Profilseite unter der sprechenden Adresse, z. B.
 * /kuenstler/berlin/zauberer/max-mustermann-100023 (slugs.ts).
 * Die Kennung am Ende zählt; stimmt der Rest nicht mehr (Umzug, neuer Name),
 * leitet die Seite mit 301 auf die aktuelle Adresse weiter. */
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { artistFromRow, upsertArtist } from "@/showly/cloudArtists";
import { ARTISTS } from "@/showly/data";
import { headLang } from "@/showly/seo";
import { artistParams, idFromSlug } from "@/showly/slugs";
import { ArtistDetail, artistHead } from "@/components/showly/ArtistDetail";

export const Route = createFileRoute("/kuenstler/$stadt/$kategorie/$name")({
  /* Echte Profile schon beim Rendern auf dem Server laden, damit
     Suchmaschinen und KI-Suchen den Inhalt ohne JavaScript sehen */
  loader: async ({ params, location }) => {
    const id = idFromSlug(params.name);
    let row = null;
    if (id >= 100000) {
      const { publicArtist } = await import("@/utils/seo.functions");
      row = await publicArtist({ data: { id } }).catch(() => null);
      if (row) upsertArtist(artistFromRow(row));
    }
    const a = row ? artistFromRow(row) : ARTISTS.find((x) => x.id === id);
    if (a) {
      const want = artistParams(a);
      if (want.stadt !== params.stadt || want.kategorie !== params.kategorie || want.name !== params.name)
        throw redirect({
          to: "/kuenstler/$stadt/$kategorie/$name",
          params: want,
          search: location.search as never,
          hash: location.hash,
          statusCode: 301,
        });
    } else if (!id || typeof window === "undefined") throw notFound();
    return { row, id };
  },
  head: (ctx) => artistHead(String(idFromSlug(ctx.params.name)), headLang(ctx), ctx.loaderData?.row ?? null),
  component: Page,
});

function Page() {
  const { name } = Route.useParams();
  return <ArtistDetail id={String(idFromSlug(name))} />;
}
