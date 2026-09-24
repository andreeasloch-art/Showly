/* Ausweis- und Gesichtsprüfung für Künstlerprofile.
 *
 * Der Ablauf, und warum er so aussieht:
 *
 *  1. Die Künstlerin startet die Prüfung. Showly fragt bei Stripe Identity
 *     einen Vorgang an und bekommt ein Einmal-Geheimnis zurück.
 *  2. Ausweisfoto und Selfie gehen direkt an Stripe, im gesicherten Fenster.
 *     Showly sieht diese Bilder nie und speichert sie nirgends. Biometrische
 *     Merkmale sind nach Artikel 9 DSGVO besonders geschützt; sie gehören
 *     deshalb ausschließlich zum geprüften Dienstleister, nicht zu uns.
 *  3. Showly fragt danach nur ab, ob der Vorgang bestanden wurde, und schreibt
 *     ein Ja oder Nein in die Datenbank.
 *
 *  Das Prüfsiegel am Profil setzt allein der Server mit dem Dienstschlüssel.
 *  Über die Zugriffsregeln kann es niemand selbst vergeben.
 */
import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { adminClient, requireRole, requireUser } from "@/lib/supabase.server";
import type { VerificationStatus } from "@/lib/database.types";

/* Die Umgebung bestimmt der Server, nicht der Aufrufer. Vorher kam sie aus dem
   Browser, damit konnte man wählen, gegen welches Stripe-Konto gearbeitet wird. */
function environment(): "sandbox" | "live" {
  return process.env["STRIPE_LIVE_API_KEY"] && process.env["NODE_ENV"] === "production"
    ? "live"
    : "sandbox";
}

function mapStatus(s: Stripe.Identity.VerificationSession["status"]): VerificationStatus {
  switch (s) {
    case "verified":
      return "verified";
    case "processing":
      return "processing";
    case "requires_input":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

/** Schritt 1: Prüfung starten. Nur für angemeldete Künstler und Planer. */
export const startIdentityCheck = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { user } = await requireRole("artist", "planner");
      const stripe = createStripeClient(environment());

      const session = await stripe.identity.verificationSessions.create({
        type: "document",
        options: {
          document: {
            // Selfie mit Lebenderkennung, sonst genügt ein abfotografierter Ausweis
            require_live_capture: true,
            require_matching_selfie: true,
          },
        },
        // Nur die eigene Kennung, keine personenbezogenen Klartextdaten
        metadata: { profile_id: user.id },
      });

      const db = adminClient();
      await db.from("verifications").upsert(
        {
          profile_id: user.id,
          provider: "stripe_identity",
          provider_session_id: session.id,
          status: mapStatus(session.status),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_session_id" },
      );

      if (!session.client_secret) return { error: "Kein Sitzungsschlüssel erhalten" };
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  },
);

/** Schritt 2: Ergebnis abholen und, wenn bestanden, das Profil freischalten. */
export const refreshIdentityCheck = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ status: VerificationStatus; reason?: string }> => {
    const { user } = await requireUser();
    const db = adminClient();

    const { data: row } = await db
      .from("verifications")
      .select("provider_session_id, status")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.provider_session_id) return { status: "none" };

    try {
      const stripe = createStripeClient(environment());
      const session = await stripe.identity.verificationSessions.retrieve(
        row.provider_session_id,
      );
      const status = mapStatus(session.status);
      const reason = session.last_error?.code ?? null;

      await db
        .from("verifications")
        .update({ status, failure_code: reason, updated_at: new Date().toISOString() })
        .eq("provider_session_id", row.provider_session_id);

      /* Nur hier wird das Siegel gesetzt. Der Browser kann das nicht. */
      if (status === "verified") {
        await db.from("artists").update({ verified: true }).eq("owner", user.id);
      }

      return reason ? { status, reason } : { status };
    } catch (error) {
      return { status: row.status as VerificationStatus, reason: getStripeErrorMessage(error) };
    }
  },
);

/** Aktueller Stand für die Anzeige im Portal. */
export const getIdentityStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ status: VerificationStatus; reason?: string }> => {
    const { user, sb } = await requireUser();
    const { data } = await sb
      .from("verifications")
      .select("status, failure_code")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { status: "none" };
    return data.failure_code
      ? { status: data.status, reason: data.failure_code }
      : { status: data.status };
  },
);
