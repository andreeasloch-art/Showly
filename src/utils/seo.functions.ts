/* Öffentliche Daten für Suchmaschinen, auf dem Server gelesen.
 *
 * Echte Künstlerprofile liegen in der Datenbank. Damit Google, Bing und
 * KI-Suchen (OAI-SearchBot, Claude-SearchBot, PerplexityBot) den Inhalt
 * eines Profils sehen, ohne JavaScript auszuführen, lädt die Profilseite das
 * Profil schon beim Rendern auf dem Server. Gelesen wird nur die öffentliche
 * Sicht artists_public (veröffentlicht, nicht gesperrt, ohne Besitzer). */
import { createServerFn } from "@tanstack/react-start";
import type { ArtistRow } from "@/lib/database.types";

export type PublicArtistRow = Omit<
  ArtistRow,
  "owner" | "published" | "blocked" | "blocked_reason" | "tax_ack_at" | "created_at" | "updated_at"
>;

export const publicArtist = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => ({ id: Math.trunc(Number(d?.id)) || 0 }))
  .handler(async ({ data }): Promise<PublicArtistRow | null> => {
    if (data.id < 100000) return null;
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const { data: row } = await adminClient().from("artists_public").select("*").eq("id", data.id).maybeSingle();
      return (row as PublicArtistRow | null) ?? null;
    } catch {
      return null; // ohne Datenbank (Vorschau) gibt es keine echten Profile
    }
  });
