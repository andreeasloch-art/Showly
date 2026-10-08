/* Zugang für Zeitplan-Aufrufe (/api/checkin, /api/taeglich).
 *
 * Erlaubt ist, wer den Schlüssel aus dem Datenbank-Zeitplan schickt
 * (private.cron_settings, Migration 0017, geprüft über cron_token_ok) oder
 * das Secret CRON_SECRET, falls ein externer Dienst genutzt wird. */
import { adminClient } from "./supabase.server";

export async function cronAllowed(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 16) return false;
  const secret = process.env["CRON_SECRET"];
  if (secret && secret.length >= 16 && token === secret) return true;
  const { data } = await adminClient()
    .rpc("cron_token_ok", { p_token: token })
    .then((r) => r, () => ({ data: false }));
  return data === true;
}
