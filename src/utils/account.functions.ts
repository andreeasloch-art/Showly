/* Konto löschen und Inhalte melden, Server-Seite.
 *
 * Konto löschen: Apple und Google verlangen, dass man sein Konto in der App
 * selbst löschen kann. Gelöscht werden Anmeldung, Profil, Beiträge,
 * Kommentare, Bewertungen und Künstlerprofile. Buchungen bleiben ohne Bezug
 * zur Person erhalten, weil Buchungsbelege aufbewahrt werden müssen (siehe
 * supabase/migrations/0002_anfragen_konto_meldungen.sql).
 *
 * Solange noch Buchungen offen sind, lehnt der Server ab: Ein Künstler, der
 * sein Konto löscht, würde sonst einen Kunden mit einem zugesagten Termin
 * allein lassen. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import type { ReportTarget } from "@/lib/database.types";

export type DeleteResult = { ok: true } | { error: "open" | "auth" | "failed"; message?: string };

export const deleteMyAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<DeleteResult> => {
    let userId: string;
    try {
      userId = (await requireUser()).user.id;
    } catch {
      return { error: "auth" };
    }
    try {
      const admin = adminClient();
      const today = new Date().toISOString().slice(0, 10);
      const open = ["pending", "confirmed", "requested"] as const;

      const { count: asCustomer } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("customer", userId)
        .gte("day", today)
        .in("status", [...open]);

      const { data: own } = await admin.from("artists").select("id").eq("owner", userId);
      const artistIds = (own || []).map((a) => a.id);
      let asArtist = 0;
      if (artistIds.length) {
        const { count } = await admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("artist_id", artistIds)
          .gte("day", today)
          .in("status", [...open]);
        asArtist = count || 0;
      }
      if ((asCustomer || 0) + asArtist > 0) return { error: "open" };

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return { error: "failed", message: error.message };
      return { ok: true };
    } catch (e) {
      return { error: "failed", message: e instanceof Error ? e.message : String(e) };
    }
  },
);

const TARGETS: ReportTarget[] = ["post", "comment", "review", "profile"];

export const reportContent = createServerFn({ method: "POST" })
  .inputValidator((d: { target: ReportTarget; id: string; reason: string; details?: string }) => {
    if (!TARGETS.includes(d.target)) throw new Error("Unbekanntes Ziel");
    return {
      target: d.target,
      id: String(d.id).slice(0, 64),
      reason: String(d.reason || "").slice(0, 60),
      details: d.details ? String(d.details).slice(0, 1000) : null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    try {
      const { user, sb } = await requireUser();
      const { error } = await sb.from("reports").insert({
        reporter: user.id,
        target_type: data.target,
        target_id: data.id,
        reason: data.reason,
        details: data.details,
      });
      if (error) return { error: error.message };
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
