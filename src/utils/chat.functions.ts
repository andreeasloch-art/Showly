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

export type ChatMessage = Pick<MessageRow, "id" | "sender_role" | "body" | "created_at" | "read_at"> & { mine: boolean };

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
      .select("id, sender, sender_role, body, created_at, read_at")
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
    return {
      role,
      messages: (rows || []).map((m) => ({
        id: m.id,
        sender_role: m.sender_role,
        body: m.body,
        created_at: m.created_at,
        read_at: m.read_at,
        mine: m.sender === uid,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { ref: ThreadRef; body: string }) => {
    const body = String(d.body || "").trim();
    if (!body) throw new Error("Leere Nachricht");
    return { ref: checkRef(d.ref), body: body.slice(0, 2000) };
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
    const { error } = await adminClient()
      .from("messages")
      .insert({
        ...("bookingId" in data.ref ? { booking_id: data.ref.bookingId } : { sweet_request_id: data.ref.sweetId }),
        sender: uid,
        sender_role: role,
        body: data.body,
      });
    if (error) return { error: "Nachricht konnte nicht gesendet werden" };
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
