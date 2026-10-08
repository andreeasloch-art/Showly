/* Bewertungen und Event-Blog über die Datenbank.
 *
 * Lesen darf jeder (Profilseiten und Blog sind öffentlich). Schreiben nur
 * angemeldet, mit denselben Regeln wie in der App:
 *  - Bewerten nur nach einer echten, bestätigten Buchung, deren Termin
 *    vorbei ist (§ 5b Abs. 3 UWG), eine Bewertung je Person und Profil.
 *  - Kein Text mit Kontaktdaten (AGB § 20 Abs. 4), geprüft auf dem Server.
 *  - Fotos und Videos nur aus dem eigenen, geprüften Speicher (public.media);
 *    sichtbar werden sie erst nach Freigabe durch das Team. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import { ownsAll } from "@/lib/media.server";
import type { MediaRefRow } from "@/lib/database.types";
import { cleanWorkHours } from "@/showly/workHours";
import { cleanPackages, fromPrice } from "@/showly/plannerPackages";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanMedia(v: unknown): MediaRefRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => m && typeof m.id === "string" && /^c:[0-9a-f-]{36}$/.test(m.id))
    .slice(0, 10)
    .map((m) => ({
      /* In der Datenbank ohne "c:", wie in artists.media */
      id: m.id.slice(2),
      kind: m.kind === "video" ? "video" : "image",
      ...(typeof m.ratio === "number" && m.ratio > 0 && m.ratio < 10 ? { ratio: m.ratio } : {}),
    }));
}

async function contactIn(...texts: string[]): Promise<boolean> {
  const { findContact } = await import("@/showly/contactGuard");
  return texts.some((t) => t && findContact(t).length > 0);
}

const CONTACT = "Bitte keine Kontaktdaten im Text (Telefon, E-Mail, Adressen, Social Media).";

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/** Für die App wieder mit "c:" davor (Server-Datei, siehe media.ts) */
const toApp = (media: MediaRefRow[] | null) => (media || []).map((m) => ({ ...m, id: "c:" + m.id }));

/* ---------------------------------------------------------------------------
 * Lesen
 * ------------------------------------------------------------------------ */
export interface CloudReview {
  id: number;
  artistId: number;
  author: string;
  rating: number;
  text: string;
  dateISO: string;
  eventDate?: string;
  media: MediaRefRow[];
  mine: boolean;
  /** Verifizierte Buchung, Teilnoten, Antwort des Anbieters, noch verdeckt (0016) */
  verified?: boolean;
  sub?: Record<string, number>;
  reply?: string;
  hidden?: boolean;
}
export interface CloudComment {
  id: number;
  author: string;
  text: string;
  dateISO: string;
  mine: boolean;
}
export interface CloudPost {
  id: number;
  author: string;
  text: string;
  dateISO: string;
  city?: string;
  media: MediaRefRow[];
  artistIds: number[];
  authorProviderId?: number;
  likes: number;
  liked: boolean;
  comments: CloudComment[];
  mine: boolean;
}

export const listCommunity = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ reviews: CloudReview[]; posts: CloudPost[] }> => {
    const db = adminClient();
    const ctx = await me();
    const uid = ctx?.user.id ?? null;

    const [{ data: revs }, { data: posts }] = await Promise.all([
      db
        .from("reviews")
        .select("id, artist_id, author, author_name, rating, body, event_date, media, created_at, verified, sub, reply, reply_at, published_at")
        /* Doppelt verdeckt: öffentlich nur veröffentlichte, die eigene immer */
        .or(uid ? `published_at.not.is.null,author.eq.${uid}` : "published_at.not.is.null")
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("posts")
        .select("id, author, author_name, author_artist, body, city, media, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const postIds = (posts || []).map((p) => p.id);
    const [{ data: tags }, { data: likes }, { data: comments }] = postIds.length
      ? await Promise.all([
          db.from("post_artists").select("post_id, artist_id").in("post_id", postIds),
          db.from("post_likes").select("post_id, profile_id").in("post_id", postIds),
          db
            .from("post_comments")
            .select("id, post_id, author, author_name, body, created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    return {
      reviews: (revs || []).map((r) => ({
        id: r.id,
        artistId: r.artist_id,
        author: r.author_name || "Gast",
        rating: r.rating,
        text: r.body,
        dateISO: r.created_at,
        ...(r.event_date ? { eventDate: r.event_date } : {}),
        media: toApp(r.media),
        mine: r.author === uid,
        verified: r.verified === true,
        sub: r.sub || {},
        ...(r.reply ? { reply: r.reply } : {}),
        hidden: !r.published_at,
      })),
      posts: (posts || []).map((p) => ({
        id: p.id,
        author: p.author_name || "Gast",
        text: p.body,
        dateISO: p.created_at,
        ...(p.city ? { city: p.city } : {}),
        ...(p.author_artist ? { authorProviderId: p.author_artist } : {}),
        media: toApp(p.media),
        artistIds: (tags || []).filter((t) => t.post_id === p.id).map((t) => t.artist_id),
        likes: (likes || []).filter((l) => l.post_id === p.id).length,
        liked: !!uid && (likes || []).some((l) => l.post_id === p.id && l.profile_id === uid),
        comments: (comments || [])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            id: c.id,
            author: c.author_name || "Gast",
            text: c.body,
            dateISO: c.created_at,
            mine: c.author === uid,
          })),
        mine: p.author === uid,
      })),
    };
  },
);

/* ---------------------------------------------------------------------------
 * Bewertungen
 * ------------------------------------------------------------------------ */
export const addReviewCloud = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { artistId: number; name: string; rating: number; text: string; eventDate?: string; media: unknown; sub?: unknown }) => ({
      artistId: Number.isInteger(d.artistId) && d.artistId > 0 ? d.artistId : 0,
      name: s(d.name, 60),
      rating: Math.max(1, Math.min(5, Math.round(Number(d.rating)) || 5)),
      text: s(d.text, 4000),
      eventDate: /^\d{4}-\d{2}-\d{2}$/.test(String(d.eventDate || "")) ? String(d.eventDate) : null,
      media: cleanMedia(d.media),
      sub: d.sub,
    }),
  )
  .handler(async ({ data }): Promise<{ id: number; hidden: boolean } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const uid = ctx.user.id;
    if (!data.artistId || !data.name || data.text.length < 10) return { error: "Angaben unvollständig" };
    if (!(await allow("action", uid))) return { error: TOO_MANY };
    if (await contactIn(data.name, data.text)) return { error: CONTACT };
    if (!(await ownsAll(uid, data.media.map((m) => m.id)))) return { error: "Unbekannte Datei" };

    const db = adminClient();
    const today = new Date().toISOString().slice(0, 10);
    /* Nur nach echter, stattgefundener Buchung, bis 14 Tage danach */
    const { data: booked } = await db
      .from("bookings")
      .select("id, day")
      .eq("customer", uid)
      .eq("artist_id", data.artistId)
      .in("status", ["confirmed", "completed"])
      .lt("day", today)
      .order("day", { ascending: false })
      .limit(1);
    const bk = booked?.[0];
    if (!bk) return { error: "Bewerten können nur Kunden nach einem gebuchten Termin." };
    const { cleanSubRatings, reviewWindow } = await import("@/showly/policies");
    if (reviewWindow(bk.day, Date.now()) === "closed") return { error: "Bewerten geht bis 14 Tage nach dem Termin." };
    /* Doppelt verdeckt: sichtbar erst, wenn auch der Künstler bewertet hat oder die Frist um ist */
    const { data: guest } = await db.from("guest_reviews").select("id").eq("booking_id", bk.id).maybeSingle();
    const now = new Date().toISOString();

    const { data: ins, error } = await db
      .from("reviews")
      .upsert(
        {
          artist_id: data.artistId,
          author: uid,
          author_name: data.name,
          rating: data.rating,
          body: data.text,
          event_date: bk.day,
          media: data.media,
          booking_id: bk.id,
          verified: true,
          sub: cleanSubRatings(data.sub),
          published_at: guest ? now : null,
        },
        { onConflict: "artist_id,author" },
      )
      .select("id")
      .single();
    if (error || !ins) return { error: "Bewertung konnte nicht gespeichert werden" };
    if (guest) await db.from("guest_reviews").update({ published_at: now }).eq("id", guest.id).is("published_at", null);
    return { id: ins.id, hidden: !guest };
  });

export const deleteReviewCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => ({ id: Number(d.id) | 0 }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const { error } = await adminClient().from("reviews").delete().eq("id", data.id).eq("author", ctx.user.id);
    return error ? { error: "Löschen hat nicht geklappt" } : { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Event-Blog
 * ------------------------------------------------------------------------ */
export const addPostCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; text: string; city?: string; artistIds: unknown; media: unknown }) => ({
    name: s(d.name, 60),
    text: s(d.text, 5000),
    city: s(d.city, 80) || null,
    artistIds: Array.isArray(d.artistIds)
      ? [...new Set(d.artistIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 10)
      : [],
    media: cleanMedia(d.media),
  }))
  .handler(async ({ data }): Promise<{ id: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const uid = ctx.user.id;
    if (!data.name || data.text.length < 10) return { error: "Bitte schreib ein paar Sätze." };
    if (!(await allow("action", uid))) return { error: TOO_MANY };
    if (await contactIn(data.name, data.text, data.city || "")) return { error: CONTACT };
    if (!(await ownsAll(uid, data.media.map((m) => m.id)))) return { error: "Unbekannte Datei" };

    const db = adminClient();
    const { data: own } = await db.from("artists").select("id").eq("owner", uid).maybeSingle();
    const { data: ins, error } = await db
      .from("posts")
      .insert({
        author: uid,
        author_name: data.name,
        author_artist: own?.id ?? null,
        body: data.text,
        city: data.city,
        media: data.media,
      })
      .select("id")
      .single();
    if (error || !ins) return { error: "Beitrag konnte nicht gespeichert werden" };
    if (data.artistIds.length) {
      /* Nur Profile markieren, die es in der Datenbank gibt */
      const { data: real } = await db.from("artists").select("id").in("id", data.artistIds);
      const ids = (real || []).map((r) => r.id);
      if (ids.length) await db.from("post_artists").insert(ids.map((artist_id) => ({ post_id: ins.id, artist_id })));
    }
    return { id: ins.id };
  });

export const deletePostCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => ({ id: Number(d.id) | 0 }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const { error } = await adminClient().from("posts").delete().eq("id", data.id).eq("author", ctx.user.id);
    return error ? { error: "Löschen hat nicht geklappt" } : { ok: true };
  });

export const toggleLikeCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => ({ id: Number(d.id) | 0 }))
  .handler(async ({ data }): Promise<{ liked: boolean } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const uid = ctx.user.id;
    const { data: has } = await db
      .from("post_likes")
      .select("post_id")
      .eq("post_id", data.id)
      .eq("profile_id", uid)
      .maybeSingle();
    if (has) {
      await db.from("post_likes").delete().eq("post_id", data.id).eq("profile_id", uid);
      return { liked: false };
    }
    const { error } = await db.from("post_likes").insert({ post_id: data.id, profile_id: uid });
    return error ? { error: "Hat nicht geklappt" } : { liked: true };
  });

export const addCommentCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { postId: number; name: string; text: string }) => ({
    postId: Number(d.postId) | 0,
    name: s(d.name, 60),
    text: s(d.text, 2000),
  }))
  .handler(async ({ data }): Promise<{ id: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!data.postId || !data.name || !data.text) return { error: "Angaben unvollständig" };
    if (!(await allow("message", ctx.user.id))) return { error: TOO_MANY };
    if (await contactIn(data.name, data.text)) return { error: CONTACT };
    const { data: ins, error } = await adminClient()
      .from("post_comments")
      .insert({ post_id: data.postId, author: ctx.user.id, author_name: data.name, body: data.text })
      .select("id")
      .single();
    if (error || !ins) return { error: "Kommentar konnte nicht gespeichert werden" };
    return { id: ins.id };
  });

/* ---------------------------------------------------------------------------
 * Kalender: freie Tage selbst sperren (eigenes Profil)
 * ------------------------------------------------------------------------ */
export const setBlockCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { artistId: number; day: string; slot: string; blocked: boolean }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.day))) throw new Error("Ungültiges Datum");
    return { artistId: Number(d.artistId) | 0, day: d.day, slot: s(d.slot, 20), blocked: d.blocked === true };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: a } = await db.from("artists").select("owner").eq("id", data.artistId).maybeSingle();
    if (!a || a.owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    /* Gebuchte Termine bleiben gesperrt, egal was der Browser schickt */
    if (!data.blocked) {
      const { data: b } = await db
        .from("bookings")
        .select("id")
        .eq("artist_id", data.artistId)
        .eq("day", data.day)
        .eq("slot", data.slot)
        .in("status", ["pending", "confirmed"])
        .limit(1);
      if (b?.length) return { error: "Dieser Termin ist gebucht." };
      await db.from("availability").delete().eq("artist_id", data.artistId).eq("day", data.day).eq("slot", data.slot);
    } else {
      await db.from("availability").upsert({ artist_id: data.artistId, day: data.day, slot: data.slot, blocked: true });
    }
    return { ok: true };
  });

/** Mehrere ganze Tage sperren oder freigeben (Urlaub, Abwesenheit) */
export const setDaysBlockedCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { artistId: number; days: string[]; blocked: boolean }) => {
    const days = Array.isArray(d.days) ? d.days.map(String).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) : [];
    if (!days.length || days.length > 120) throw new Error("Ungültiger Zeitraum");
    return { artistId: Number(d.artistId) | 0, days: [...new Set(days)], blocked: d.blocked === true };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: a } = await db.from("artists").select("owner").eq("id", data.artistId).maybeSingle();
    if (!a || a.owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    if (data.blocked) {
      /* Bestehende Buchungen bleiben bestehen; neue sind an diesen Tagen nicht möglich */
      await db.from("availability").upsert(data.days.map((day) => ({ artist_id: data.artistId, day, slot: "all", blocked: true })));
    } else {
      await db.from("availability").delete().eq("artist_id", data.artistId).eq("slot", "all").in("day", data.days);
    }
    return { ok: true };
  });

/** Arbeitszeiten je Wochentag speichern (null = keine Einschränkung) */
export const setWorkHoursCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { artistId: number; workHours: unknown }) => ({
    artistId: Number(d.artistId) | 0,
    workHours: d.workHours === null ? null : cleanWorkHours(d.workHours),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: a } = await db.from("artists").select("owner").eq("id", data.artistId).maybeSingle();
    if (!a || a.owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const { error } = await db.from("artists").update({ work_hours: data.workHours }).eq("id", data.artistId);
    return error ? { error: "Speichern hat nicht geklappt" } : { ok: true };
  });

/** Pakete der Planer (Basic/Premium/Luxus) speichern; Einstiegspreis = günstigstes Paket */
export const setPackagesCloud = createServerFn({ method: "POST" })
  .inputValidator((d: { artistId: number; packages: unknown }) => ({
    artistId: Number(d.artistId) | 0,
    packages: cleanPackages(d.packages),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: a } = await db.from("artists").select("owner").eq("id", data.artistId).maybeSingle();
    if (!a || a.owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const { findContact } = await import("@/showly/contactGuard");
    const texts = data.packages.flatMap((p) => [p.name, p.dur, p.text, ...p.inc]).join("\n");
    if (findContact(texts).length) return { error: "Bitte keine Kontaktdaten in den Paketen" };
    const min = fromPrice(data.packages);
    const { error } = await db
      .from("artists")
      .update({ packages: data.packages, ...(min ? { price_cents: Math.round(min * 100) } : {}) })
      .eq("id", data.artistId);
    return error ? { error: "Speichern hat nicht geklappt" } : { ok: true };
  });

/** Gesperrte und gebuchte Zeitfenster der Datenbank-Profile, ab heute */
export const listAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: { artistIds: number[] }) => ({
    artistIds: (Array.isArray(d.artistIds) ? d.artistIds : []).map(Number).filter((n) => n > 0).slice(0, 200),
  }))
  .handler(async ({ data }): Promise<Record<number, Record<string, string[]>>> => {
    if (!data.artistIds.length) return {};
    const today = new Date().toISOString().slice(0, 10);
    /* Sperren und Buchungen samt Dauer, damit der Kalender die Fahrtzeit
       zwischen zwei Shows freihalten kann (showly/schedule.ts) */
    const { scheduleEntries } = await import("@/lib/schedule.server");
    const map = await scheduleEntries(adminClient(), data.artistIds, today);
    const out: Record<number, Record<string, string[]>> = {};
    for (const [k, entries] of map) {
      const [id, day] = k.split("|");
      (out[Number(id)] ||= {})[day!] = entries;
    }
    return out;
  });
