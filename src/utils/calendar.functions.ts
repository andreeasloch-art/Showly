/* Kalender verbinden (Künstler-Portal).
 *
 *  - Einlesen: Künstler tragen den privaten iCal-Link ihres Google-, Apple-
 *    oder Outlook-Kalenders ein. Belegte Zeiten daraus sperren Showly-
 *    Termine samt einer Stunde Fahrtzeit (lib/calsync.server.ts).
 *  - Ausgeben: ein eigener, geheimer Link mit allen Showly-Auftritten zum
 *    Abonnieren in denselben Kalendern (routes/api.kalender.$token.ts).
 *
 * Nur für den Besitzer des Künstlerprofils. Gespeichert werden aus fremden
 * Kalendern nur Beginn und Ende. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";

export interface CalendarFeedInfo {
  id: number;
  label: string | null;
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  eventsCount: number;
}

export type CalendarStatus =
  | { skipped: true }
  | { feeds: CalendarFeedInfo[]; exportPath: string | null; upcomingExternal: { start: string; end: string; allDay: boolean }[] };

async function myArtistId(): Promise<number | null> {
  try {
    const { user } = await requireUser();
    const { data } = await adminClient().from("artists").select("id").eq("owner", user.id).maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function status(artistId: number): Promise<CalendarStatus> {
  const db = adminClient();
  const [{ data: feeds }, { data: exp }, { data: ext }] = await Promise.all([
    db.from("calendar_feeds").select("*").eq("artist_id", artistId).order("id"),
    db.from("calendar_export").select("token").eq("artist_id", artistId).maybeSingle(),
    db
      .from("external_busy")
      .select("starts_at, ends_at, all_day")
      .eq("artist_id", artistId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
  ]);
  return {
    feeds: (feeds || []).map((f) => ({
      id: f.id,
      label: f.label,
      /* Nur der Anbieter (z. B. calendar.google.com), nie der geheime Link */
      host: (() => {
        try {
          return new URL(f.url).hostname;
        } catch {
          return "";
        }
      })(),
      lastSyncedAt: f.last_synced_at,
      lastError: f.last_error,
      eventsCount: f.events_count,
    })),
    exportPath: exp?.token ? `/api/kalender/${exp.token}.ics` : null,
    upcomingExternal: (ext || []).map((x) => ({ start: x.starts_at, end: x.ends_at, allDay: x.all_day })),
  };
}

export const myCalendars = createServerFn({ method: "GET" }).handler(async (): Promise<CalendarStatus> => {
  const id = await myArtistId();
  return id ? status(id) : { skipped: true };
});

export const addCalendarFeed = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; label?: string }) => ({
    url: String(d?.url ?? "").slice(0, 2000),
    label: typeof d?.label === "string" ? d.label.trim().slice(0, 60) : "",
  }))
  .handler(async ({ data }): Promise<CalendarStatus | { error: string }> => {
    const id = await myArtistId();
    if (!id) return { error: "Nur mit eigenem Künstlerprofil möglich." };
    const { user } = await requireUser();
    if (!(await allow("action", user.id))) return { error: TOO_MANY };
    const { MAX_FEEDS, safeCalendarUrl, syncFeed } = await import("@/lib/calsync.server");
    const url = safeCalendarUrl(data.url);
    if (!url) return { error: "Bitte einen gültigen https- oder webcal-Link zu einem iCal-Kalender eintragen." };
    const db = adminClient();
    const { count } = await db.from("calendar_feeds").select("id", { count: "exact", head: true }).eq("artist_id", id);
    if ((count || 0) >= MAX_FEEDS) return { error: `Höchstens ${MAX_FEEDS} Kalender.` };
    const { data: feed, error } = await db
      .from("calendar_feeds")
      .insert({ artist_id: id, url, label: data.label || null })
      .select("id, artist_id, url")
      .single();
    if (error || !feed) return { error: "Dieser Kalender ist schon verbunden." };
    const r = await syncFeed(feed);
    if (!r.ok) {
      /* Link funktioniert nicht: gar nicht erst speichern */
      await db.from("calendar_feeds").delete().eq("id", feed.id);
      return { error: r.error };
    }
    return status(id);
  });

export const removeCalendarFeed = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => ({ id: Math.trunc(Number(d?.id)) || 0 }))
  .handler(async ({ data }): Promise<CalendarStatus | { error: string }> => {
    const id = await myArtistId();
    if (!id) return { error: "Nur mit eigenem Künstlerprofil möglich." };
    /* Löscht auch die belegten Zeiten aus diesem Kalender (on delete cascade) */
    await adminClient().from("calendar_feeds").delete().eq("id", data.id).eq("artist_id", id);
    return status(id);
  });

export const syncMyCalendars = createServerFn({ method: "POST" }).handler(async (): Promise<CalendarStatus | { error: string }> => {
  const id = await myArtistId();
  if (!id) return { error: "Nur mit eigenem Künstlerprofil möglich." };
  const { user } = await requireUser();
  if (!(await allow("action", user.id))) return { error: TOO_MANY };
  const { syncStaleFeeds } = await import("@/lib/calsync.server");
  await syncStaleFeeds([id], 0);
  return status(id);
});

/** Eigenen Kalender-Link anlegen oder erneuern (alter Link wird ungültig) */
export const rotateCalendarExport = createServerFn({ method: "POST" }).handler(async (): Promise<CalendarStatus | { error: string }> => {
  const id = await myArtistId();
  if (!id) return { error: "Nur mit eigenem Künstlerprofil möglich." };
  await adminClient().from("calendar_export").upsert({ artist_id: id, token: newToken() });
  return status(id);
});
