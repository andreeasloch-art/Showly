/* Kalender von Künstlern abgleichen (Google, Apple, Outlook über iCal).
 *
 * Wann wird abgeglichen?
 *   - sofort, wenn ein Künstler einen Kalender-Link einträgt,
 *   - an der Kasse, bevor ein Termin reserviert wird, wenn der letzte
 *     Abgleich älter als STALE_MINUTES ist (syncStaleFeeds),
 *   - im täglichen Lauf für alle Kalender (syncAllFeeds).
 *
 * Sicherheit: Nur https-Adressen (webcal:// wird zu https://), keine
 * internen Adressen, keine Zugangsdaten in der Adresse, höchstens 3 MB,
 * 10 Sekunden Zeit. Klappt ein Abgleich nicht, bleiben die zuletzt
 * bekannten belegten Zeiten stehen (lieber zu viel gesperrt als doppelt
 * gebucht) und der Fehler wird beim Kalender angezeigt. */
import { adminClient } from "./supabase.server";
import { icsBusy } from "@/showly/icsBusy";

export const STALE_MINUTES = 15;
export const MAX_FEEDS = 5;
const MAX_BYTES = 3 * 1024 * 1024;
const HORIZON_DAYS = 400;

/** Kalender-Link prüfen und vereinheitlichen; null, wenn nicht erlaubt */
export function safeCalendarUrl(raw: string): string | null {
  let s = String(raw || "").trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) ||
    h.includes(":") ||
    !h.includes(".")
  )
    return null;
  if (s.length > 2000) return null;
  return u.toString();
}

async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1", "User-Agent": "Showly-Kalenderabgleich/1.0 (+https://showly.eu)" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Kalender nicht gefunden (404). Ist der Link noch gültig?" : `Kalender antwortet mit Fehler ${res.status}`);
  /* Auch nach Weiterleitung nur erlaubte Adressen */
  if (res.url && !safeCalendarUrl(res.url)) throw new Error("Weiterleitung auf eine nicht erlaubte Adresse");
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error("Kalender ist zu groß (über 3 MB)");
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("Kalender ist zu groß (über 3 MB)");
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Das ist kein iCal-Kalender. Bitte den iCal-/ICS-Link verwenden.");
  return text;
}

type Feed = { id: number; artist_id: number; url: string };

/** Einen Kalender abgleichen. Gibt die Zahl belegter Zeiten zurück. */
export async function syncFeed(feed: Feed): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const db = adminClient();
  const now = new Date();
  try {
    const text = await fetchIcs(feed.url);
    const from = new Date(now.getTime() - 86_400_000);
    const to = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
    const busy = icsBusy(text, from, to);
    await db.from("external_busy").delete().eq("feed_id", feed.id);
    for (let i = 0; i < busy.length; i += 500) {
      await db.from("external_busy").insert(
        busy.slice(i, i + 500).map((b) => ({
          feed_id: feed.id,
          artist_id: feed.artist_id,
          starts_at: b.start.toISOString(),
          ends_at: b.end.toISOString(),
          all_day: b.allDay,
        })),
      );
    }
    await db
      .from("calendar_feeds")
      .update({ last_synced_at: now.toISOString(), last_error: null, events_count: busy.length })
      .eq("id", feed.id);
    return { ok: true, count: busy.length };
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 280) || "Abgleich fehlgeschlagen";
    await db.from("calendar_feeds").update({ last_synced_at: now.toISOString(), last_error: error }).eq("id", feed.id);
    return { ok: false, error };
  }
}

/** Vor einer Reservierung: Kalender dieser Künstler abgleichen, wenn veraltet */
export async function syncStaleFeeds(artistIds: number[], maxAgeMinutes = STALE_MINUTES): Promise<number> {
  const ids = [...new Set(artistIds)].filter((x) => x >= 100000);
  if (!ids.length) return 0;
  const since = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  const { data } = await adminClient()
    .from("calendar_feeds")
    .select("id, artist_id, url, last_synced_at")
    .in("artist_id", ids)
    .or(`last_synced_at.is.null,last_synced_at.lt.${since}`)
    .limit(20);
  const feeds = data || [];
  await Promise.all(feeds.map((f) => syncFeed(f)));
  return feeds.length;
}

/** Täglicher Lauf: alle Kalender */
export async function syncAllFeeds(): Promise<{ ok: number; failed: number }> {
  const { data } = await adminClient().from("calendar_feeds").select("id, artist_id, url").limit(5000);
  let ok = 0;
  let failed = 0;
  const feeds = data || [];
  for (let i = 0; i < feeds.length; i += 10) {
    const rs = await Promise.all(feeds.slice(i, i + 10).map((f) => syncFeed(f)));
    for (const r of rs) r.ok ? ok++ : failed++;
  }
  return { ok, failed };
}
