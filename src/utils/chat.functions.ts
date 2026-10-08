/* Nachrichten zwischen Kunde und Anbieter, Server-Seite.
 *
 * Ein Verlauf gehört zu genau einer Buchung oder einer Torten-Anfrage.
 * Schreiben und lesen dürfen nur die Beteiligten (und die Verwaltung).
 * Jede Nachricht prüft der Server auf Kontaktdaten (AGB § 20 Abs. 4), mit
 * denselben Regeln wie die App (showly/contactGuard.ts). Wer den Filter im
 * Browser umgeht, scheitert also hier. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import type { MessageRow } from "@/lib/database.types";

export type ThreadRef = { bookingId: number } | { sweetId: number };

function checkRef(r: ThreadRef): ThreadRef {
  if (r && "bookingId" in r && Number.isInteger(r.bookingId) && r.bookingId > 0) return { bookingId: r.bookingId };
  if (r && "sweetId" in r && Number.isInteger(r.sweetId) && r.sweetId > 0) return { sweetId: r.sweetId };
  throw new Error("Ungültiger Verlauf");
}

type Role = "customer" | "provider" | "admin";

/** Wer ist die Person in diesem Verlauf? null: nicht beteiligt */
async function roleIn(ref: ThreadRef, uid: string, isAdmin: boolean): Promise<Role | null> {
  const admin = adminClient();
  if ("bookingId" in ref) {
    const { data: b } = await admin.from("bookings").select("customer, artist_id").eq("id", ref.bookingId).maybeSingle();
    if (!b) return null;
    if (b.customer === uid) return "customer";
    if (b.artist_id) {
      const { data: a } = await admin.from("artists").select("owner").eq("id", b.artist_id).maybeSingle();
      if (a?.owner === uid) return "provider";
    }
  } else {
    const { data: s } = await admin.from("sweet_requests").select("customer, baker_owner").eq("id", ref.sweetId).maybeSingle();
    if (!s) return null;
    if (s.customer === uid) return "customer";
    if (s.baker_owner === uid) return "provider";
  }
  return isAdmin ? "admin" : null;
}

const col = (ref: ThreadRef) => ("bookingId" in ref ? "booking_id" : "sweet_request_id");
const idOf = (ref: ThreadRef) => ("bookingId" in ref ? ref.bookingId : ref.sweetId);

export type ChatAttachment = { name: string; mime: string; bytes: number; url: string | null };
export type ChatMessage = Pick<MessageRow, "id" | "sender_role" | "body" | "created_at" | "read_at"> & {
  mine: boolean;
  attachment?: ChatAttachment | null;
};

/* ---------------------------------------------------------------------------
 * Anhänge: Fotos jederzeit (vorher im Browser auf Kontaktdaten geprüft, auf
 * dem Server von Standortdaten befreit), PDFs erst nach bestätigter Buchung
 * bzw. angenommener Torten-Anfrage, damit vorher keine Kontaktdaten über
 * Dokumente laufen (AGB § 20 Abs. 4). Privater Speicher "chat", Zugriff nur
 * über kurzlebige signierte Adressen für die Beteiligten.
 * ------------------------------------------------------------------------ */
const CHAT_BUCKET = "chat";
const MAX_ATTACH = 10 * 1024 * 1024;
const ATTACH_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const threadKey = (ref: ThreadRef) => ("bookingId" in ref ? `b${ref.bookingId}` : `s${ref.sweetId}`);

/** Sind Dokumente in diesem Verlauf schon erlaubt (Buchung fest)? */
async function documentsAllowed(ref: ThreadRef): Promise<boolean> {
  const admin = adminClient();
  if ("bookingId" in ref) {
    const { data: b } = await admin.from("bookings").select("status, paid").eq("id", ref.bookingId).maybeSingle();
    return !!b && (b.status === "confirmed" || b.status === "completed");
  }
  const { data: r } = await admin.from("sweet_requests").select("status").eq("id", ref.sweetId).maybeSingle();
  return !!r && (r.status === "confirmed" || r.status === "booked");
}

export const chatUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: ThreadRef; mime: string; bytes: number }) => ({
    ref: checkRef(d.ref),
    mime: String(d.mime || ""),
    bytes: Math.round(Number(d.bytes) || 0),
  }))
  .handler(async ({ data }): Promise<{ path: string; token: string } | { error: string }> => {
    let ctx;
    try {
      ctx = await requireUser();
    } catch {
      return { error: "Bitte melde dich an" };
    }
    if (!(await allow("upload", ctx.user.id))) return { error: TOO_MANY };
    const role = await roleIn(data.ref, ctx.user.id, ctx.profile?.role === "admin");
    if (!role) return { error: "Keine Berechtigung" };
    const ext = ATTACH_MIME[data.mime];
    if (!ext) return { error: "Erlaubt sind Fotos (JPEG, PNG, WebP) und PDF." };
    if (data.bytes < 1 || data.bytes > MAX_ATTACH) return { error: "Die Datei ist zu groß (höchstens 10 MB)." };
    if (ext === "pdf" && role !== "admin" && !(await documentsAllowed(data.ref)))
      return { error: "Dokumente gehen erst nach der bestätigten Buchung. Fotos kannst du schon jetzt schicken." };
    const path = `${threadKey(data.ref)}/${crypto.randomUUID()}.${ext}`;
    const { data: up, error } = await adminClient().storage.from(CHAT_BUCKET).createSignedUploadUrl(path);
    if (error || !up) return { error: "Hochladen ist gerade nicht möglich" };
    return { path, token: up.token };
  });

/** Hochgeladene Datei prüfen (echte Art, Größe) und Fotos säubern */
async function checkAttachment(ref: ThreadRef, a: { path: string; name: string }) {
  const admin = adminClient();
  if (!a.path.startsWith(threadKey(ref) + "/") || a.path.includes("..")) return { error: "Ungültiger Anhang" } as const;
  const { data: blob } = await admin.storage.from(CHAT_BUCKET).download(a.path);
  if (!blob) return { error: "Anhang nicht gefunden" } as const;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { sniffType, stripImageMetadata } = await import("@/showly/imageSafety");
  const kind = sniffType(bytes);
  const isPdf = String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  const want = a.path.split(".").pop();
  const ok = want === "pdf" ? isPdf : (want === "jpg" && kind === "jpeg") || (want === "png" && kind === "png") || (want === "webp" && kind === "webp");
  if (!ok || bytes.length > MAX_ATTACH) {
    await admin.storage.from(CHAT_BUCKET).remove([a.path]);
    return { error: "Die Datei passt nicht zu ihrer Art und wurde nicht gesendet." } as const;
  }
  const mime = want === "pdf" ? "application/pdf" : `image/${want === "jpg" ? "jpeg" : want}`;
  if (!isPdf) {
    const clean = stripImageMetadata(bytes);
    if (clean.changed) await admin.storage.from(CHAT_BUCKET).upload(a.path, clean.bytes, { upsert: true, contentType: mime });
  }
  return { path: a.path, name: a.name.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) || "Datei", mime, bytes: bytes.length } as const;
}

export const listMessages = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: ThreadRef }) => ({ ref: checkRef(d.ref) }))
  .handler(async ({ data }): Promise<{ messages: ChatMessage[]; role: Role } | { error: string }> => {
    let ctx;
    try {
      ctx = await requireUser();
    } catch {
      return { error: "Bitte melde dich an" };
    }
    const uid = ctx.user.id;
    const role = await roleIn(data.ref, uid, ctx.profile?.role === "admin");
    if (!role) return { error: "Keine Berechtigung" };
    const admin = adminClient();
    const { data: rows } = await admin
      .from("messages")
      .select("id, sender, sender_role, body, created_at, read_at, attachment")
      .eq(col(data.ref), idOf(data.ref))
      .order("created_at", { ascending: true })
      .limit(500);
    /* Gelesen markieren, was die andere Seite geschrieben hat */
    if (role !== "admin")
      await admin
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq(col(data.ref), idOf(data.ref))
        .neq("sender_role", role)
        .is("read_at", null);
    /* Anhänge: signierte Adressen, eine Stunde gültig */
    const paths = (rows || []).map((m) => m.attachment?.path).filter((x): x is string => !!x);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await admin.storage.from(CHAT_BUCKET).createSignedUrls(paths, 3600);
      for (const x of signed || []) if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl);
    }
    return {
      role,
      messages: (rows || []).map((m) => ({
        id: m.id,
        sender_role: m.sender_role,
        body: m.body,
        created_at: m.created_at,
        read_at: m.read_at,
        mine: m.sender === uid,
        attachment: m.attachment
          ? { name: m.attachment.name, mime: m.attachment.mime, bytes: m.attachment.bytes, url: urls.get(m.attachment.path) ?? null }
          : null,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: ThreadRef; body: string; attachment?: { path: string; name: string } }) => {
    const att = d.attachment && typeof d.attachment.path === "string" ? { path: d.attachment.path.slice(0, 200), name: String(d.attachment.name || "") } : null;
    const body = String(d.body || "").trim() || (att ? att.name.slice(0, 120) || "Datei" : "");
    if (!body) throw new Error("Leere Nachricht");
    return { ref: checkRef(d.ref), body: body.slice(0, 2000), attachment: att };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string; contact?: string[] }> => {
    let ctx;
    try {
      ctx = await requireUser();
    } catch {
      return { error: "Bitte melde dich an" };
    }
    const uid = ctx.user.id;
    if (!(await allow("message", uid))) return { error: TOO_MANY };
    const role = await roleIn(data.ref, uid, ctx.profile?.role === "admin");
    if (!role) return { error: "Keine Berechtigung" };
    /* Die Verwaltung darf Kontaktdaten nennen (etwa die Support-Adresse) */
    if (role !== "admin") {
      const { findContact } = await import("@/showly/contactGuard");
      const found = findContact(data.body);
      if (found.length) return { error: "Bitte keine Kontaktdaten", contact: found };
    }
    let attachment: { path: string; name: string; mime: string; bytes: number } | null = null;
    if (data.attachment) {
      const a = await checkAttachment(data.ref, data.attachment);
      if ("error" in a) return { error: a.error ?? "Ungültiger Anhang" };
      if (role !== "admin" && a.mime === "application/pdf" && !(await documentsAllowed(data.ref)))
        return { error: "Dokumente gehen erst nach der bestätigten Buchung." };
      attachment = { path: a.path, name: a.name, mime: a.mime, bytes: a.bytes };
    }
    const { error } = await adminClient()
      .from("messages")
      .insert({
        ...("bookingId" in data.ref ? { booking_id: data.ref.bookingId } : { sweet_request_id: data.ref.sweetId }),
        sender: uid,
        sender_role: role,
        body: data.body,
        attachment,
      });
    if (error) return { error: "Nachricht konnte nicht gesendet werden" };
    /* Die andere Seite per Mail informieren (höchstens alle 30 Minuten) */
    try {
      const admin = adminClient();
      let to: string | null = null;
      if ("bookingId" in data.ref) {
        const { data: b } = await admin.from("bookings").select("customer, artist_id").eq("id", data.ref.bookingId).maybeSingle();
        if (b) {
          const { ownerOfArtist } = await import("@/lib/notify.server");
          to = role === "customer" ? await ownerOfArtist(b.artist_id) : b.customer;
        }
      } else {
        const { data: s } = await admin.from("sweet_requests").select("customer, baker_owner").eq("id", data.ref.sweetId).maybeSingle();
        if (s) to = role === "customer" ? s.baker_owner : s.customer;
      }
      if (to && to !== uid) {
        const { notifyMessage } = await import("@/lib/notify.server");
        await notifyMessage(to, "bookingId" in data.ref ? `b${data.ref.bookingId}` : `s${data.ref.sweetId}`);
      }
    } catch {
      /* Mail ist Zusatz; die Nachricht ist gespeichert */
    }
    return { ok: true };
  });

/** Ungelesene Nachrichten je Verlauf, für die Hinweise im Dashboard */
export const unreadCounts = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ bookings: Record<number, number>; sweets: Record<number, number> }> => {
    const empty = { bookings: {}, sweets: {} };
    let ctx;
    try {
      ctx = await requireUser();
    } catch {
      return empty;
    }
    /* Lesen mit den Rechten der Person: nur eigene Verläufe */
    const { data } = await ctx.sb
      .from("messages")
      .select("booking_id, sweet_request_id, sender")
      .is("read_at", null)
      .neq("sender", ctx.user.id)
      .limit(1000);
    const out: { bookings: Record<number, number>; sweets: Record<number, number> } = { bookings: {}, sweets: {} };
    for (const m of data || []) {
      if (m.booking_id) out.bookings[m.booking_id] = (out.bookings[m.booking_id] || 0) + 1;
      if (m.sweet_request_id) out.sweets[m.sweet_request_id] = (out.sweets[m.sweet_request_id] || 0) + 1;
    }
    return out;
  },
);
