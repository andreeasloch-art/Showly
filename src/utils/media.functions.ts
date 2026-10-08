/* Fotos und Videos von Anbietenden, Server-Seite.
 *
 * Ablauf (siehe supabase/migrations/0007_medien_pruefung.sql):
 *  1. Die App prüft die Datei im Browser auf Kontaktdaten (mediaCheck.ts).
 *  2. Sie lädt sie in den privaten Speicher "medien" in den eigenen Ordner.
 *  3. registerMedia trägt sie mit Status "pending" ein.
 *  4. Die Verwaltung gibt frei oder lehnt mit Grund ab (adminMediaDecide);
 *     die Person bekommt eine Mail.
 *  5. mediaUrls gibt kurzlebige Adressen heraus: freigegebene Dateien für
 *     alle, eigene Dateien (auch in Prüfung) für die Person selbst und alles
 *     für die Verwaltung. Was nicht freigegeben ist, sieht sonst niemand.
 *
 * Den Status setzt nur der Server. Die Angabe aus dem Browser, dass die
 * automatische Prüfung bestanden wurde, wird gespeichert, ersetzt aber nie
 * die Freigabe durch einen Menschen. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import { sendMail } from "@/lib/mail.server";
import type { MediaRow } from "@/lib/database.types";
import { ownsAll } from "@/lib/media.server";

const BUCKET = "medien";
const URL_SECONDS = 6 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EXT = /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|webm)$/i;
const MAX_BYTES = 80 * 1024 * 1024;

async function userOrNull() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

async function isAdmin(uid: string | undefined) {
  if (!uid) return false;
  const { data } = await adminClient().from("profiles").select("role").eq("id", uid).maybeSingle();
  return data?.role === "admin";
}

/* ------------------------------------------------------------------ */
export interface RegisterInput {
  path: string;
  kind: "image" | "video";
  mime: string;
  bytes: number;
  duration?: number | undefined;
  ratio?: number | undefined;
  autoCheck: { ok: boolean; found?: string[] };
}

export const registerMedia = createServerFn({ method: "POST" })
  .inputValidator((d: RegisterInput) => {
    if (typeof d.path !== "string" || d.path.length > 200) throw new Error("Ungültiger Pfad");
    if (d.kind !== "image" && d.kind !== "video") throw new Error("Ungültige Art");
    return {
      path: d.path,
      kind: d.kind,
      mime: String(d.mime || "").slice(0, 60),
      bytes: Math.max(1, Math.min(MAX_BYTES, Math.round(Number(d.bytes) || 0))),
      duration: d.duration != null ? Math.max(0, Math.min(600, Number(d.duration) || 0)) : null,
      ratio: d.ratio != null ? Math.max(0.1, Math.min(10, Number(d.ratio) || 1)) : null,
      autoCheck: { ok: d.autoCheck?.ok === true, found: (d.autoCheck?.found || []).map(String).slice(0, 8) },
    };
  })
  .handler(async ({ data }): Promise<{ id: string } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("upload", ctx.user.id))) return { error: TOO_MANY };
    const [folder, file, ...rest] = data.path.split("/");
    if (folder !== ctx.user.id || !file || rest.length || !EXT.test(file)) return { error: "Ungültiger Pfad" };
    /* Was die automatische Prüfung im Browser abgelehnt hat, wird nicht angenommen */
    if (!data.autoCheck.ok) return { error: "Die Datei enthält Kontaktdaten und wurde nicht angenommen" };
    if (data.kind === "video" && (data.duration ?? 0) > 61) return { error: "Videos höchstens 60 Sekunden" };

    const a = adminClient();
    /* Die Datei muss wirklich im eigenen Ordner liegen */
    const { data: listed } = await a.storage.from(BUCKET).list(folder, { search: file, limit: 1 });
    if (!listed?.some((o) => o.name === file)) return { error: "Datei nicht gefunden" };

    /* Echte Dateiart aus den ersten Bytes prüfen und aus Fotos Standort und
       andere Metadaten entfernen (Sicherheitsnetz; der Browser macht das
       normalerweise schon beim Verkleinern). Passt die Datei nicht, wird sie
       wieder gelöscht. */
    const { isImageKind, isVideoKind, sniffType, stripImageMetadata } = await import("@/showly/imageSafety");
    const reject = async (msg: string) => {
      await a.storage.from(BUCKET).remove([data.path]);
      return { error: msg };
    };
    if (data.kind === "image") {
      const { data: blob } = await a.storage.from(BUCKET).download(data.path);
      if (!blob) return { error: "Datei nicht gefunden" };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!isImageKind(sniffType(bytes))) return reject("Das ist kein Foto. Erlaubt sind JPEG, PNG, WebP, GIF und HEIC.");
      const clean = stripImageMetadata(bytes);
      if (clean.changed)
        await a.storage.from(BUCKET).upload(data.path, clean.bytes, { upsert: true, contentType: blob.type || data.mime });
    } else {
      const { data: signed } = await a.storage.from(BUCKET).createSignedUrl(data.path, 60);
      const head = signed?.signedUrl
        ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-63" }, signal: AbortSignal.timeout(10_000) })
            .then((r) => r.arrayBuffer())
            .catch(() => null)
        : null;
      if (!head || !isVideoKind(sniffType(new Uint8Array(head))))
        return reject("Das ist kein Video. Erlaubt sind MP4, MOV und WebM.");
    }

    const { data: row, error } = await a
      .from("media")
      .insert({
        owner: ctx.user.id,
        kind: data.kind,
        path: data.path,
        mime: data.mime,
        bytes: data.bytes,
        duration: data.duration,
        ratio: data.ratio,
        auto_check: data.autoCheck,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) return { error: "Datei konnte nicht eingetragen werden" };
    return { id: row.id };
  });

/* ------------------------------------------------------------------ */
export interface MediaInfo {
  id: string;
  url: string;
  kind: "image" | "video";
  status: MediaRow["status"];
  reason: string | null;
}

/** Adressen für Anzeige; nur was die fragende Person sehen darf */
export const mediaUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[] }) => ({
    ids: Array.from(new Set((d.ids || []).map(String).filter((x) => UUID.test(x)))).slice(0, 80),
  }))
  .handler(async ({ data }): Promise<{ items: MediaInfo[] }> => {
    if (!data.ids.length) return { items: [] };
    const ctx = await userOrNull();
    const uid = ctx?.user.id;
    const admin = await isAdmin(uid);
    const a = adminClient();
    const { data: rows } = await a.from("media").select("id, owner, kind, path, status, reason").in("id", data.ids);
    const visible = (rows || []).filter((r) => r.status === "approved" || r.owner === uid || admin);
    if (!visible.length) return { items: [] };
    const { data: signed } = await a.storage.from(BUCKET).createSignedUrls(
      visible.map((r) => r.path),
      URL_SECONDS,
    );
    const byPath = new Map((signed || []).map((x) => [x.path, x.signedUrl]));
    return {
      items: visible
        .map((r) => ({
          id: r.id,
          url: byPath.get(r.path) || "",
          kind: r.kind,
          status: r.status,
          /* Den Ablehnungsgrund sieht nur die Person selbst bzw. die Verwaltung */
          reason: r.owner === uid || admin ? r.reason : null,
        }))
        .filter((x) => x.url),
    };
  });

/* ------------------------------------------------------------------ */
export const deleteMyMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => {
    if (!UUID.test(String(d.id))) throw new Error("Ungültige Kennung");
    return { id: String(d.id) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    const a = adminClient();
    const { data: row } = await a.from("media").select("path, owner").eq("id", data.id).maybeSingle();
    if (!row || row.owner !== ctx.user.id) return { error: "Nicht gefunden" };
    await a.storage.from(BUCKET).remove([row.path]);
    await a.from("media").delete().eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/** Galerie des eigenen Künstlerprofils speichern (nur eigene Dateien) */
export const saveArtistMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { items: { id: string; kind: string; ratio?: number }[] }) => ({
    items: (d.items || [])
      .filter((m) => UUID.test(String(m.id)))
      .slice(0, 8)
      .map((m) => ({
        id: String(m.id),
        kind: m.kind === "video" ? ("video" as const) : ("image" as const),
        ratio: Math.max(0.1, Math.min(10, Number(m.ratio) || 1)),
      })),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("offer", ctx.user.id))) return { error: TOO_MANY };
    const ok = await ownsAll(ctx.user.id, data.items.map((m) => m.id));
    if (!ok) return { error: "Unbekannte Datei" };
    const { error } = await adminClient().from("artists").update({ media: data.items }).eq("owner", ctx.user.id);
    if (error) return { error: "Galerie konnte nicht gespeichert werden" };
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Verwaltung */

export interface AdminMediaRow {
  id: string;
  kind: "image" | "video";
  status: MediaRow["status"];
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  bytes: number;
  duration: number | null;
  /** Automatische Prüfung im Browser bestanden */
  auto_ok: boolean;
  owner_name: string;
  url: string;
}

export const adminMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { filter: "pending" | "all" }) => ({ filter: d.filter === "all" ? "all" : "pending" }))
  .handler(async ({ data }): Promise<{ rows: AdminMediaRow[] } | { error: string }> => {
    const ctx = await userOrNull();
    if (!(await isAdmin(ctx?.user.id))) return { error: "Keine Berechtigung" };
    const a = adminClient();
    let q = a
      .from("media")
      .select("id, owner, kind, path, status, reason, created_at, reviewed_at, bytes, duration, auto_check")
      .order("created_at", { ascending: data.filter === "pending" })
      .limit(120);
    if (data.filter === "pending") q = q.eq("status", "pending");
    const { data: rows } = await q;
    if (!rows?.length) return { rows: [] };
    const owners = Array.from(new Set(rows.map((r) => r.owner)));
    const { data: profs } = await a.from("profiles").select("id, display_name, email").in("id", owners);
    const nameOf = new Map((profs || []).map((p) => [p.id, p.display_name || p.email || "?"]));
    const { data: signed } = await a.storage.from(BUCKET).createSignedUrls(
      rows.map((r) => r.path),
      URL_SECONDS,
    );
    const byPath = new Map((signed || []).map((x) => [x.path, x.signedUrl]));
    return {
      rows: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        reason: r.reason,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        bytes: r.bytes,
        duration: r.duration,
        auto_ok: (r.auto_check as { ok?: unknown } | null)?.ok === true,
        owner_name: String(nameOf.get(r.owner) || "?"),
        url: byPath.get(r.path) || "",
      })),
    };
  });

export const adminMediaDecide = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; action: "approve" | "reject"; text?: string }) => {
    if (!UUID.test(String(d.id))) throw new Error("Ungültige Kennung");
    if (d.action !== "approve" && d.action !== "reject") throw new Error("Ungültige Aktion");
    return { id: String(d.id), action: d.action, text: String(d.text || "").trim().slice(0, 1000) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await userOrNull();
    if (!ctx || !(await isAdmin(ctx.user.id))) return { error: "Keine Berechtigung" };
    if (data.action === "reject" && !data.text) return { error: "Bitte einen Grund angeben" };
    const a = adminClient();
    const { data: row } = await a.from("media").select("owner, kind").eq("id", data.id).maybeSingle();
    if (!row) return { error: "Nicht gefunden" };
    await a
      .from("media")
      .update({
        status: data.action === "approve" ? "approved" : "rejected",
        reason: data.action === "reject" ? data.text : null,
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    const { data: prof } = await a.from("profiles").select("email").eq("id", row.owner).maybeSingle();
    const what = row.kind === "video" ? "Dein Video" : "Dein Foto";
    if (prof?.email)
      await sendMail(
        prof.email,
        data.action === "approve" ? `${what} ist freigegeben` : `${what} wurde nicht freigegeben`,
        data.action === "approve"
          ? [`${what} wurde geprüft und ist jetzt in deinem Showly-Profil zu sehen.`]
          : [
              `${what} wurde geprüft und nicht freigegeben.`,
              "Grund: " + data.text,
              "Du kannst in deinem Profil eine andere Datei hochladen.",
            ],
      );
    return { ok: true };
  });
