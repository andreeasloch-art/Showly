/* Stories, Hilfen nur auf dem Server (siehe 0028_stories.sql). */
import { adminClient } from "./supabase.server";

const BUCKET = "medien";

/** Abgelaufene, entfernte oder abgelehnte Stories samt Datei löschen.
 *  Läuft täglich; Stories, die nie freigegeben wurden, nach 7 Tagen. */
export async function purgeStories(): Promise<number> {
  const db = adminClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [expired, removed, stale] = await Promise.all([
    db
      .from("stories")
      .select("id, media_id")
      .lt("expires_at", dayAgo)
      .limit(500),
    db.from("stories").select("id, media_id").eq("removed", true).limit(500),
    db
      .from("stories")
      .select("id, media_id")
      .is("live_from", null)
      .lt("created_at", weekAgo)
      .limit(500),
  ]);
  const rows = [
    ...(expired.data || []),
    ...(removed.data || []),
    ...(stale.data || []),
  ];
  if (!rows.length) return 0;
  const mediaIds = Array.from(new Set(rows.map((r) => r.media_id)));
  const { data: media } = await db
    .from("media")
    .select("id, path")
    .in("id", mediaIds);
  if (media?.length)
    await db.storage.from(BUCKET).remove(media.map((m) => m.path));
  /* Die Story hängt an der Datei und verschwindet mit ihr */
  await db.from("media").delete().in("id", mediaIds);
  return rows.length;
}
