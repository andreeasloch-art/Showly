/* Hilfe-Anfragen und Fehlerprotokoll, Server-Seite.
 *
 * Beides funktioniert auch ohne Anmeldung (etwa wenn jemand nicht mehr in
 * sein Konto kommt). Gegen Missbrauch zählt der Server je Person bzw. je
 * Internetadresse mit (guard.server.ts). */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow, clientIp } from "@/lib/guard.server";
import type { SupportTopic } from "@/lib/database.types";

async function uidOrNull(): Promise<string | null> {
  try {
    return (await requireUser()).user.id;
  } catch {
    return null;
  }
}

const TOPICS: SupportTopic[] = ["booking", "payment", "account", "provider", "report", "other"];

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; name?: string; topic: SupportTopic; body: string; hp?: string }) => {
    const email = String(d.email || "").trim().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Bitte eine gültige E-Mail-Adresse angeben");
    const body = String(d.body || "").trim().slice(0, 4000);
    if (body.length < 5) throw new Error("Bitte beschreibe dein Anliegen");
    return {
      email,
      name: d.name ? String(d.name).trim().slice(0, 120) : null,
      topic: TOPICS.includes(d.topic) ? d.topic : ("other" as SupportTopic),
      body,
      hp: String(d.hp || ""),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true; id: number } | { error: string }> => {
    /* Unsichtbares Feld: Bots füllen es aus, Menschen nicht */
    if (data.hp) return { ok: true, id: 0 };
    const uid = await uidOrNull();
    if (!(await allow("support", uid ?? clientIp()))) return { error: TOO_MANY };
    const { data: row, error } = await adminClient()
      .from("support_tickets")
      .insert({ profile: uid, email: data.email, name: data.name, topic: data.topic, body: data.body })
      .select("id")
      .single();
    if (error || !row) return { error: "Nachricht konnte nicht gesendet werden" };
    return { ok: true, id: row.id };
  });

export const myTickets = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { sb } = await requireUser();
    const { data } = await sb
      .from("support_tickets")
      .select("id, topic, body, status, answer, answered_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return data || [];
  } catch {
    return [];
  }
});

/** Fehler aus der App festhalten, damit sie in der Verwaltung sichtbar sind */
export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((d: { message: string; stack?: string; url?: string; ua?: string }) => ({
    message: String(d.message || "Unbekannter Fehler").slice(0, 1000),
    stack: d.stack ? String(d.stack).slice(0, 8000) : null,
    url: d.url ? String(d.url).slice(0, 500) : null,
    ua: d.ua ? String(d.ua).slice(0, 300) : null,
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const uid = await uidOrNull();
    if (!(await allow("error", uid ?? clientIp()))) return { ok: false };
    await adminClient()
      .from("client_errors")
      .insert({ profile: uid, message: data.message, stack: data.stack, url: data.url, user_agent: data.ua });
    return { ok: true };
  });
