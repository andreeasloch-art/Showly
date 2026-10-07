/* Kalender-Abo eines Künstlers: alle Showly-Auftritte als iCal-Feed
 * (/api/kalender/<geheimer-schlüssel>.ics). Google Kalender, Apple Kalender
 * und Outlook können ihn abonnieren. Gesperrt für Suchmaschinen (/api/ in
 * robots.txt) und ohne Kundennamen. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/api/kalender/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token || "").replace(/\.ics$/i, "");
        if (!/^[0-9a-f]{24,80}$/.test(token)) return new Response("Not found", { status: 404 });
        try {
          const { adminClient } = await import("@/lib/supabase.server");
          const { buildIcs } = await import("@/showly/icsExport");
          const db = adminClient();
          const { data: exp } = await db.from("calendar_export").select("artist_id").eq("token", token).maybeSingle();
          if (!exp) return new Response("Not found", { status: 404 });
          const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
          const { data: claims } = await db
            .from("slot_claims")
            .select("id, starts_at, ends_at, booking_id, bookings(status, address, figure)")
            .eq("artist_id", exp.artist_id)
            .eq("kind", "booking")
            .gte("ends_at", from)
            .order("starts_at")
            .limit(2000);
          type Row = {
            id: number;
            starts_at: string;
            ends_at: string;
            booking_id: number | null;
            bookings: { status: string; address: string | null; figure: string | null } | null;
          };
          const events = ((claims || []) as unknown as Row[]).map((c) => ({
            uid: `showly-${c.booking_id ?? c.id}@showly.eu`,
            start: new Date(c.starts_at),
            end: new Date(c.ends_at),
            summary:
              c.bookings?.status === "requested"
                ? "Showly-Anfrage (noch nicht bestätigt)"
                : `Showly-Auftritt${c.bookings?.figure ? ` – ${c.bookings.figure}` : ""}`,
            ...(c.bookings?.address ? { location: c.bookings.address } : {}),
            url: "https://showly.eu/portal",
          }));
          return new Response(buildIcs("Showly-Auftritte", events), {
            headers: {
              "Content-Type": "text/calendar; charset=utf-8",
              "Cache-Control": "private, max-age=600",
              "X-Robots-Tag": "noindex",
            },
          });
        } catch {
          return new Response("Kalender gerade nicht verfügbar", { status: 503 });
        }
      },
    },
  },
});
