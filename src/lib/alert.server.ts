/* Alarm-Mails an die Verwaltung.
 *
 * Empfänger: alle Adressen aus admin_emails, dazu SHOWLY_ALERT_EMAIL (Secret
 * in Lovable), falls gesetzt. Dieselbe Warnung geht höchstens einmal am Tag
 * raus (notifications_sent). Ohne Mailversand (RESEND_API_KEY) passiert nichts;
 * die Warnung steht dann trotzdem im Ergebnis des Zeitplan-Aufrufs.
 *
 * Geprüft wird täglich (runDaily → healthCheck):
 *  - viele Fehler im Browser der Besucher (client_errors, letzte 24 Stunden)
 *  - fehlgeschlagene Auszahlungen
 *  - Kalenderabgleich, der für viele Künstler scheitert
 * und bei jeder fehlgeschlagenen wöchentlichen Datensicherung.
 * Einen Ausfall der ganzen Seite meldet der Ausfallwächter auf GitHub
 * (.github/workflows/ausfallwaechter.yml), denn eine ausgefallene Seite kann
 * sich nicht selbst melden. */
import { adminClient } from "./supabase.server";
import { sendMail } from "./mail.server";

/** Ab so vielen Browserfehlern in 24 Stunden gibt es eine Warnung */
export const ERROR_THRESHOLD = 25;

export async function adminRecipients(): Promise<string[]> {
  const out = new Set<string>();
  const extra = process.env["SHOWLY_ALERT_EMAIL"];
  if (extra) for (const e of extra.split(",")) if (e.trim()) out.add(e.trim().toLowerCase());
  const { data } = await adminClient().from("admin_emails").select("email");
  for (const r of data ?? []) if (r.email) out.add(r.email);
  return [...out];
}

/** Warnung an die Verwaltung; je Schlüssel höchstens einmal am Tag */
export async function alertAdmins(key: string, subject: string, paragraphs: string[]): Promise<boolean> {
  const db = adminClient();
  const day = new Date().toISOString().slice(0, 10);
  const mark = `alarm:${key}:${day}`.slice(0, 120);
  const { error } = await db.from("notifications_sent").insert({ key: mark });
  if (error) return false; // heute schon gemeldet
  const to = await adminRecipients();
  let sent = false;
  for (const addr of to) sent = (await sendMail(addr, `Showly-Warnung: ${subject}`, paragraphs).catch(() => false)) || sent;
  return sent;
}

export interface HealthInput {
  payoutsFailed: number;
  calendarsFailed: number;
}

/** Tägliche Prüfung; gibt die gefundenen Probleme zurück (leer = alles gut) */
export async function healthCheck(input: HealthInput): Promise<string[]> {
  const db = adminClient();
  const problems: string[] = [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, data } = await db
    .from("client_errors")
    .select("message", { count: "exact" })
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  const n = count ?? 0;
  if (n >= ERROR_THRESHOLD) {
    const top = new Map<string, number>();
    for (const r of data ?? []) top.set(r.message.slice(0, 120), (top.get(r.message.slice(0, 120)) ?? 0) + 1);
    const lines = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => `${c}× ${m}`);
    problems.push(`${n} Fehler im Browser von Besuchern in den letzten 24 Stunden. Häufigste:\n${lines.join("\n")}`);
  }
  if (input.payoutsFailed > 0) problems.push(`${input.payoutsFailed} Auszahlung(en) an Anbieter sind fehlgeschlagen. Bitte in der Verwaltung unter Auszahlungen prüfen.`);
  if (input.calendarsFailed >= 5) problems.push(`Der Kalenderabgleich ist für ${input.calendarsFailed} Anbieter fehlgeschlagen.`);
  if (problems.length)
    await alertAdmins("taeglich", "Auffälligkeiten im Betrieb", [...problems, "Details in der Verwaltung unter Fehler und Auszahlungen."]).catch(() => false);
  return problems;
}
