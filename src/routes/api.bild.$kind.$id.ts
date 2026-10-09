/* Vorschaubild zum Teilen (WhatsApp, Facebook, X): erstes freigegebenes
 * Foto eines echten Profils. Fotos liegen privat; hier gibt es eine kurz
 * gültige Adresse per Weiterleitung, immer frisch erzeugt. Ohne Foto das
 * allgemeine Showly-Bild. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { OG_IMAGE } from "@/showly/seo";

const UUID = /^[0-9a-f-]{36}$/i;

async function firstPhoto(kind: string, id: number): Promise<string | null> {
  if (!(id >= 100000) || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return null;
  const { adminClient } = await import("@/lib/supabase.server");
  const db = adminClient();
  let list: unknown = null;
  if (kind === "kuenstler") {
    const { data } = await db.from("artists_public").select("media").eq("id", id).maybeSingle();
    list = data?.media;
  } else {
    const { data } = await db.from("providers_public").select("data").eq("id", id).maybeSingle();
    list = (data?.data as { photos?: unknown } | undefined)?.photos;
  }
  const ids = (Array.isArray(list) ? (list as { id?: string; kind?: string }[]) : [])
    .filter((m) => m.kind !== "video")
    .map((m) => String(m.id || "").replace(/^c:/, ""))
    .filter((x) => UUID.test(x))
    .slice(0, 5);
  if (!ids.length) return null;
  const { data: rows } = await db.from("media").select("id, path, status, kind").in("id", ids);
  const row = ids.map((x) => (rows || []).find((r) => r.id === x)).find((r) => r && r.status === "approved" && r.kind === "image");
  if (!row) return null;
  const { data: signed } = await db.storage.from("medien").createSignedUrl(row.path, 3600);
  return signed?.signedUrl ?? null;
}

export const Route = createFileRoute("/api/bild/$kind/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const url = await firstPhoto(params.kind, Number(params.id)).catch(() => null);
        return new Response(null, {
          status: 302,
          headers: { Location: url || OG_IMAGE, "Cache-Control": "public, max-age=1800", "X-Robots-Tag": "noindex" },
        });
      },
    },
  },
});
