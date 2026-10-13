/* Stories, Server-Seite (siehe supabase/migrations/0028_stories.sql).
 *
 *  storyFeed     laufende Stories für die Leiste auf der Startseite,
 *                gruppiert je Anbieter, mit kurz gültigen Adressen
 *  postStory     eigene Story anlegen (Datei vorher über registerMedia)
 *  myStories     eigene Stories der letzten 7 Tage mit Stand
 *  deleteStory   eigene Story samt Datei löschen
 *
 * Öffentlich wird nur, was das Team freigegeben hat und noch läuft; die
 * Profile müssen veröffentlicht und dürfen nicht gesperrt sein. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import { ownsAll } from "@/lib/media.server";
import type { StoryRow } from "@/lib/database.types";

const BUCKET = "medien";
const URL_SECONDS = 2 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Höchstens so viele Stories je Person in 24 Stunden */
export const STORIES_PER_DAY = 10;
export const MAX_CAPTION = 160;

export type StoryKind = StoryRow["provider_kind"];
const KINDS: StoryKind[] = ["artist", "baker", "deco", "location"];

export interface FeedStory {
  id: string;
  url: string;
  kind: "image" | "video";
  caption: string;
  at: string;
}
export interface FeedGroup {
  key: string;
  kind: StoryKind;
  providerId: number;
  name: Record<string, string>;
  city: string;
  cat?: string | undefined;
  stories: FeedStory[];
}

async function userOrNull() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

const text = (v: unknown): Record<string, string> => {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const k of ["de", "en", "es"])
      if (typeof o[k] === "string" && o[k]) out[k] = String(o[k]);
    if (Object.keys(out).length) return out;
  }
  return { de: String(v || "") };
};

/* ------------------------------------------------------------------ */
export const storyFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ groups: FeedGroup[] }> => {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { groups: [] };
    const a = adminClient();
    const now = new Date().toISOString();
    const { data: rows } = await a
      .from("stories")
      .select("id, provider_kind, provider_id, media_id, caption, live_from")
      .eq("removed", false)
      .not("live_from", "is", null)
      .gt("expires_at", now)
      .order("live_from", { ascending: false })
      .limit(150);
    if (!rows?.length) return { groups: [] };

    const artistIds = Array.from(
      new Set(
        rows
          .filter((r) => r.provider_kind === "artist")
          .map((r) => r.provider_id),
      ),
    );
    const providerIds = Array.from(
      new Set(
        rows
          .filter((r) => r.provider_kind !== "artist")
          .map((r) => r.provider_id),
      ),
    );
    const [artists, providers, media] = await Promise.all([
      artistIds.length
        ? a
            .from("artists_public")
            .select("id, name, loc, cat")
            .in("id", artistIds)
        : { data: [] },
      providerIds.length
        ? a
            .from("providers_public")
            .select("id, kind, data")
            .in("id", providerIds)
        : { data: [] },
      a
        .from("media")
        .select("id, kind, path, status")
        .in("id", Array.from(new Set(rows.map((r) => r.media_id)))),
    ]);
    const okMedia = (media.data || []).filter((m) => m.status === "approved");
    if (!okMedia.length) return { groups: [] };
    const { data: signed } = await a.storage.from(BUCKET).createSignedUrls(
      okMedia.map((m) => m.path),
      URL_SECONDS,
    );
    const urlOf = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
    const mediaOf = new Map(
      okMedia.map((m) => [
        m.id,
        { kind: m.kind, url: urlOf.get(m.path) || "" },
      ]),
    );

    const who = new Map<string, Omit<FeedGroup, "stories" | "key">>();
    for (const r of (artists.data || []) as {
      id: number;
      name: unknown;
      loc: unknown;
      cat: string;
    }[])
      who.set(`artist:${r.id}`, {
        kind: "artist",
        providerId: r.id,
        name: text(r.name),
        city: text(r.loc)["de"] || "",
        cat: r.cat,
      });
    for (const r of (providers.data || []) as {
      id: number;
      kind: string;
      data: Record<string, unknown>;
    }[]) {
      const kind = r.kind as StoryKind;
      if (!KINDS.includes(kind)) continue;
      who.set(`${kind}:${r.id}`, {
        kind,
        providerId: r.id,
        name: text(r.data["name"]),
        city: String(r.data["city"] || ""),
      });
    }

    const groups = new Map<string, FeedGroup>();
    /* Älteste zuerst innerhalb eines Anbieters, wie bei Instagram */
    for (const r of [...rows].reverse()) {
      const key = `${r.provider_kind}:${r.provider_id}`;
      const p = who.get(key);
      const m = mediaOf.get(r.media_id);
      if (!p || !m?.url) continue;
      const g = groups.get(key) || { key, ...p, stories: [] };
      g.stories.push({
        id: r.id,
        url: m.url,
        kind: m.kind,
        caption: r.caption,
        at: r.live_from || now,
      });
      groups.set(key, g);
    }
    /* Neueste Anbieter vorne */
    return {
      groups: Array.from(groups.values()).sort((x, y) =>
        y.stories.at(-1)!.at > x.stories.at(-1)!.at ? 1 : -1,
      ),
    };
  },
);

/* ------------------------------------------------------------------ */
export const postStory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { mediaId: string; kind: StoryKind; caption?: string }) => {
      if (!UUID.test(String(d.mediaId))) throw new Error("Ungültige Datei");
      if (!KINDS.includes(d.kind)) throw new Error("Ungültige Art");
      return {
        mediaId: String(d.mediaId),
        kind: d.kind,
        caption: String(d.caption || "")
          .trim()
          .slice(0, MAX_CAPTION),
      };
    },
  )
  .handler(
    async ({
      data,
    }): Promise<{ id: string; live: boolean } | { error: string }> => {
      const ctx = await userOrNull();
      if (!ctx) return { error: "Bitte melde dich an" };
      if (!(await allow("upload", ctx.user.id))) return { error: TOO_MANY };
      if (!(await ownsAll(ctx.user.id, [data.mediaId])))
        return { error: "Unbekannte Datei" };
      if (data.caption) {
        const { findContact } = await import("@/showly/contactGuard");
        if (findContact(data.caption).length)
          return {
            error: "Der Text enthält Kontaktdaten. Bitte entferne sie.",
          };
      }
      const a = adminClient();
      /* Nur für das eigene, nicht gesperrte Profil der passenden Art */
      let providerId: number | null = null;
      if (data.kind === "artist") {
        const { data: row } = await a
          .from("artists")
          .select("id, blocked")
          .eq("owner", ctx.user.id)
          .maybeSingle();
        if (row && !row.blocked) providerId = row.id;
      } else {
        const { data: row } = await a
          .from("providers")
          .select("id, blocked")
          .eq("owner", ctx.user.id)
          .eq("kind", data.kind)
          .maybeSingle();
        if (row && !row.blocked) providerId = row.id;
      }
      if (providerId == null)
        return { error: "Kein passendes Anbieterprofil gefunden" };

      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await a
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("owner", ctx.user.id)
        .gt("created_at", since);
      if ((count || 0) >= STORIES_PER_DAY)
        return { error: `Höchstens ${STORIES_PER_DAY} Stories pro Tag` };

      const { data: m } = await a
        .from("media")
        .select("status")
        .eq("id", data.mediaId)
        .maybeSingle();
      if (m?.status === "rejected")
        return { error: "Diese Datei wurde abgelehnt" };
      const live = m?.status === "approved";
      const now = new Date();
      const { data: row, error } = await a
        .from("stories")
        .insert({
          owner: ctx.user.id,
          provider_kind: data.kind,
          provider_id: providerId,
          media_id: data.mediaId,
          caption: data.caption,
          ...(live
            ? {
                live_from: now.toISOString(),
                expires_at: new Date(+now + 86_400_000).toISOString(),
              }
            : {}),
        })
        .select("id")
        .single();
      if (error || !row)
        return { error: "Story konnte nicht gespeichert werden" };
      return { id: row.id, live };
    },
  );

/* ------------------------------------------------------------------ */
export interface MyStory {
  id: string;
  url: string;
  kind: "image" | "video";
  caption: string;
  state: "pending" | "live" | "expired" | "rejected" | "removed";
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const myStories = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: MyStory[] }> => {
    const ctx = await userOrNull();
    if (!ctx) return { items: [] };
    const a = adminClient();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: rows } = await a
      .from("stories")
      .select("*")
      .eq("owner", ctx.user.id)
      .gt("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!rows?.length) return { items: [] };
    const { data: media } = await a
      .from("media")
      .select("id, kind, path, status, reason")
      .in(
        "id",
        rows.map((r) => r.media_id),
      );
    const { data: signed } = await a.storage.from(BUCKET).createSignedUrls(
      (media || []).map((m) => m.path),
      URL_SECONDS,
    );
    const urlOf = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
    const mOf = new Map((media || []).map((m) => [m.id, m]));
    const now = new Date().toISOString();
    return {
      items: rows.flatMap((r) => {
        const m = mOf.get(r.media_id);
        if (!m) return [];
        const state: MyStory["state"] = r.removed
          ? "removed"
          : m.status === "rejected"
            ? "rejected"
            : !r.live_from
              ? "pending"
              : (r.expires_at || "") > now
                ? "live"
                : "expired";
        return [
          {
            id: r.id,
            url: urlOf.get(m.path) || "",
            kind: m.kind,
            caption: r.caption,
            state,
            reason: m.status === "rejected" ? m.reason : null,
            expiresAt: r.expires_at,
            createdAt: r.created_at,
          },
        ];
      }),
    };
  },
);

/* ------------------------------------------------------------------ */
export const deleteStory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => {
    if (!UUID.test(String(d.id))) throw new Error("Ungültige Kennung");
    return { id: String(d.id) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    const a = adminClient();
    const { data: row } = await a
      .from("stories")
      .select("owner, media_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.owner !== ctx.user.id) return { error: "Nicht gefunden" };
    const { data: m } = await a
      .from("media")
      .select("path")
      .eq("id", row.media_id)
      .maybeSingle();
    if (m) await a.storage.from(BUCKET).remove([m.path]);
    /* Die Story hängt an der Datei und verschwindet mit ihr */
    await a.from("media").delete().eq("id", row.media_id);
    return { ok: true };
  });
