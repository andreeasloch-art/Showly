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
import { TOO_MANY, allow } from "@/lib/guard.server";
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

      /* Ausweisbilder und Selfie bei Stripe löschen lassen, bevor das Konto
         verschwindet; danach wüsste niemand mehr, zu wem sie gehören. */
      const { data: checks } = await admin
        .from("verifications")
        .select("provider_session_id")
        .eq("profile_id", userId);
      if (checks?.length) {
        try {
          const { createStripeClient } = await import("@/lib/stripe.server");
          const stripe = createStripeClient(
            process.env["STRIPE_LIVE_API_KEY"] && process.env["NODE_ENV"] === "production" ? "live" : "sandbox",
          );
          for (const c of checks)
            if (c.provider_session_id)
              await stripe.identity.verificationSessions.redact(c.provider_session_id).catch(() => null);
        } catch {
          /* Stripe nicht erreichbar: Konto trotzdem löschen, Rest per Support */
        }
      }

      /* Prüfwert "eine Person, ein Profil" löschen, damit sich die Person
         später neu anmelden kann. Gesperrte Personen bleiben gesperrt; deren
         Eintrag verliert nur die Verknüpfung zum Konto (on delete set null). */
      await admin.from("identity_fingerprints").delete().eq("owner", userId).eq("blocked", false);

      /* Hochgeladene Fotos und Videos aus dem Speicher löschen; die
         Einträge in public.media verschwinden mit dem Profil (cascade). */
      try {
        const { data: files } = await admin.from("media").select("path").eq("owner", userId);
        const paths = (files || []).map((f) => f.path);
        for (let i = 0; i < paths.length; i += 100) await admin.storage.from("medien").remove(paths.slice(i, i + 100));
      } catch {
        /* Speicher nicht erreichbar: Rest räumt die Verwaltung auf */
      }

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
      if (!(await allow("report", user.id))) return { error: TOO_MANY };
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

/* ---------------------------------------------------------------------------
 * Datenauskunft und Datenübertragbarkeit (Art. 15 und 20 DSGVO): alle Daten
 * zum eigenen Konto als JSON-Datei. Nur die eigene Person, geprüft auf dem
 * Server; interne Sicherheitswerte (gehashte Ausweis- und SMS-Prüfwerte,
 * Zähler gegen Missbrauch) sind keine Angaben über die Person und fehlen.
 * ------------------------------------------------------------------------ */
export const exportMyData = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; json: string } | { error: string } | { skipped: true }> => {
    let uid: string;
    try {
      uid = (await requireUser()).user.id;
    } catch {
      return { skipped: true };
    }
    if (!(await allow("action", uid))) return { error: TOO_MANY };
    const db = adminClient();
    const by = async (table: string, col: string, id: string | number[]) => {
      const q = (db.from as unknown as (t: string) => any)(table).select("*");
      const { data } = await (Array.isArray(id) ? q.in(col, id) : q.eq(col, id)).limit(5000);
      return (data as unknown[]) || [];
    };
    const artists = (await by("artists", "owner", uid)) as { id: number }[];
    const providers = (await by("providers", "owner", uid)) as { id: number }[];
    const aIds = artists.map((a) => a.id);
    const pIds = providers.map((p) => p.id);
    const out = {
      exported_at: new Date().toISOString(),
      note: "Datenauskunft nach Art. 15 und Art. 20 DSGVO. Fragen: support@showly.eu",
      profile: await by("profiles", "id", uid),
      bookings_as_customer: await by("bookings", "customer", uid),
      orders: await by("orders", "customer", uid),
      cake_requests: await by("sweet_requests", "customer", uid),
      shop_orders: await by("shop_orders", "customer", uid),
      vouchers: await by("vouchers", "owner", uid),
      reviews: await by("reviews", "author", uid),
      posts: await by("posts", "author", uid),
      post_comments: await by("post_comments", "author", uid),
      post_likes: await by("post_likes", "profile_id", uid),
      messages_sent: await by("messages", "sender", uid),
      support_tickets: await by("support_tickets", "profile", uid),
      reports_made: await by("reports", "reporter", uid),
      blocked_people: await by("blocks", "blocker", uid),
      media: await by("media", "owner", uid),
      payout_account: await by("payout_accounts", "profile_id", uid),
      artist_profiles: artists,
      artist_bookings: aIds.length ? await by("bookings", "artist_id", aIds) : [],
      artist_availability: aIds.length ? await by("availability", "artist_id", aIds) : [],
      artist_payouts: aIds.length ? await by("payouts", "artist_id", aIds) : [],
      artist_penalties: aIds.length ? await by("penalties", "artist_id", aIds) : [],
      artist_calendars: aIds.length ? await by("calendar_feeds", "artist_id", aIds) : [],
      provider_profiles: providers,
      provider_offers: pIds.length ? await by("provider_offers", "provider_id", pIds) : [],
    };
    return { ok: true, json: JSON.stringify(out, null, 2) };
  },
);
