/* Alte, kurze Profiladresse /kuenstler/<id>. Leitet mit 301 auf die
 * sprechende Adresse /kuenstler/<stadt>/<kategorie>/<name>-<id> weiter
 * (slugs.ts). Gibt es das Profil nicht (mehr), antwortet der Server mit 404,
 * damit gelöschte Profile aus dem Suchindex fallen. */
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { artistFromRow, upsertArtist } from "@/showly/cloudArtists";
import { ARTISTS } from "@/showly/data";
import { headLang } from "@/showly/seo";
import { artistParams } from "@/showly/slugs";
import { ArtistDetail, artistHead } from "@/components/showly/ArtistDetail";

export const Route = createFileRoute("/kuenstler/$id")({
  loader: async ({ params, location }) => {
    const id = Number(params.id);
    let row = null;
    if (id >= 100000) {
      const { publicArtist } = await import("@/utils/seo.functions");
      row = await publicArtist({ data: { id } }).catch(() => null);
      if (row) upsertArtist(artistFromRow(row));
    }
    const a = row ? artistFromRow(row) : ARTISTS.find((x) => x.id === id);
    if (a)
      throw redirect({
        to: "/kuenstler/$stadt/$kategorie/$name",
        params: artistParams(a),
        search: location.search as never,
        hash: location.hash,
        statusCode: 301,
      });
    /* Auf dem Server (Suchmaschine, direkter Aufruf): sauberes 404. Im Browser
       kann es das eigene, noch nicht freigeschaltete Profil sein. */
    if (typeof window === "undefined") throw notFound();
    return { row: null };
  },
  head: (ctx) => artistHead(ctx.params.id, headLang(ctx), null),
  component: Old,
});

function Old() {
  const { id } = Route.useParams();
  return <ArtistDetail id={id} />;
}
