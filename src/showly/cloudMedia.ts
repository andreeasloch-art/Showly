/* Fotos und Videos auf den Server laden (nur mit Datenbank und Anmeldung).
 *
 * Nach der automatischen Prüfung im Browser (mediaCheck.ts) kommt die Datei
 * in den privaten Speicher "medien", in den Ordner der Person. Der Server
 * trägt sie mit Status "In Prüfung" ein; öffentlich sichtbar wird sie erst
 * nach Freigabe durch das Team (Verwaltung → Fotos & Videos).
 *
 * Ohne Datenbank (Übungsbetrieb) bleibt alles wie bisher im Browser. */
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { getMediaBlob, rekeyMedia, type MediaRef } from "./media";
import type { MediaCheckResult } from "./mediaCheck";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Angemeldete Person, wenn die Datenbank eingerichtet ist; sonst null */
export async function cloudUser(): Promise<string | null> {
  if (!isBackendConfigured()) return null;
  try {
    const { data } = await supabase().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Örtlich gespeicherte, geprüfte Datei hochladen und eintragen.
 *  Gibt den Verweis mit Server-Kennung ("c:…") zurück. */
export async function uploadToCloud(ref: MediaRef, check: MediaCheckResult, uid: string): Promise<MediaRef> {
  const blob = await getMediaBlob(ref.id);
  if (!blob) throw new Error("Datei nicht gefunden");
  const mime = blob.type || (ref.kind === "video" ? "video/mp4" : "image/jpeg");
  const ext = EXT[mime] || (ref.kind === "video" ? "mp4" : "jpg");
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase().storage.from("medien");
  const up = await bucket.upload(path, blob, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { registerMedia } = await import("@/utils/media.functions");
  const res = await registerMedia({
    data: {
      path,
      kind: ref.kind,
      mime,
      bytes: blob.size,
      duration: check.duration,
      ratio: ref.ratio,
      autoCheck: { ok: check.ok, found: check.found },
    },
  });
  if ("error" in res) {
    await bucket.remove([path]).catch(() => null);
    throw new Error(res.error);
  }
  const id = "c:" + res.id;
  await rekeyMedia(ref.id, id, "pending");
  return { ...ref, id };
}
