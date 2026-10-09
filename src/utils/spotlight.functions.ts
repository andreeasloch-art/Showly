/* Top Act der Woche: Platz ganz oben auf der Startseite für eine Stadt und
 * Umgebung, 99 € je Woche (1 bis 4 Wochen). Je Stadt und Tag gibt es bis zu
 * fünf Top Acts, die sich oben abwechseln; vor der Zahlung wird der Platz
 * 30 Minuten reserviert (Migrationen 0022/0023, lib/spotlight.server.ts). */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";
import type { StripeEnv } from "@/lib/stripe.server";
import { SPOTLIGHT_PRICE, SPOTLIGHT_SLOTS, citySlug } from "@/showly/spotlight";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayBerlin = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Belegte Zeiträume einer Stadt ab heute (bezahlt oder gerade reserviert) */
async function busyOf(slug: string) {
  const { data } = await adminClient()
    .from("spotlights")
    .select("owner, starts_on, ends_on, status, hold_until")
    .eq("city_slug", slug)
    .gte("ends_on", todayBerlin())
    .in("status", ["paid", "reserved"])
    .order("starts_on");
  const now = Date.now();
  return (data || []).filter((r) => r.status === "paid" || (r.hold_until && Date.parse(r.hold_until) > now));
}

/** Wie viele Top Acts laufen an diesem Tag schon? */
const takenOn = (busy: { starts_on: string; ends_on: string }[], day: string) =>
  busy.filter((b) => b.starts_on <= day && b.ends_on >= day).length;

/** Erster Tag ab `from`, an dem `days` Tage am Stück noch ein Platz frei ist */
function firstFree(
  busy: { owner?: string; starts_on: string; ends_on: string }[],
  from: string,
  days: number,
  owner?: string,
): string {
  let start = from;
  for (let guard = 0; guard < 400; guard++) {
    let full: string | null = null;
    for (let i = 0; i < days && !full; i++) {
      const d = addDays(start, i);
      const own = !!owner && busy.some((b) => b.owner === owner && b.starts_on <= d && b.ends_on >= d);
      if (own || takenOn(busy, d) >= SPOTLIGHT_SLOTS) full = d;
    }
    if (!full) return start;
    start = addDays(full, 1);
  }
  return start;
}

/** Wie sieht es in einer Stadt aus? Wie viele Plätze sind heute frei, ab wann geht es */
export const topActStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { city: string; weeks?: number }) => ({
    city: String(d.city || "").trim().slice(0, 80),
    weeks: Math.max(1, Math.min(4, Math.round(Number(d.weeks) || 1))),
  }))
  .handler(
    async ({ data }): Promise<{ slug: string; nextFree: string; freeToday: number; slots: number } | { error: string }> => {
      const slug = citySlug(data.city);
      if (slug.length < 2) return { error: "Bitte eine Stadt angeben" };
      const busy = await busyOf(slug);
      const today = todayBerlin();
      return {
        slug,
        nextFree: firstFree(busy, today, data.weeks * 7),
        freeToday: Math.max(0, SPOTLIGHT_SLOTS - takenOn(busy, today)),
        slots: SPOTLIGHT_SLOTS,
      };
    },
  );

/** Laufende Top Acts aller Städte (für die Startseite) */
export const activeTopActs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ name: string; cat: string; city: string; tagline: string; link: string | null; artistId: number | null; until: string }[]> => {
    const today = todayBerlin();
    const { data } = await adminClient()
      .from("spotlights")
      .select("name, cat, city, tagline, link, artist_id, ends_on")
      .eq("status", "paid")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .limit(500);
    return (data || []).map((r) => ({ name: r.name, cat: r.cat, city: r.city, tagline: r.tagline, link: r.link, artistId: r.artist_id, until: r.ends_on }));
  },
);

/** Zeitraum reservieren und die Zahlungsmaske öffnen */
export const topActCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { city: string; weeks: number; tagline: string; startISO?: string; returnUrl: string; environment: StripeEnv }) => {
      if (!/^https?:\/\//.test(String(d.returnUrl))) throw new Error("Ungültig");
      return {
        city: String(d.city || "").trim().slice(0, 80),
        weeks: Math.max(1, Math.min(4, Math.round(Number(d.weeks) || 1))),
        tagline: String(d.tagline || "").trim().slice(0, 120),
        startISO: ISO.test(String(d.startISO || "")) ? String(d.startISO) : undefined,
        returnUrl: String(d.returnUrl),
        environment: d.environment === "live" ? ("live" as const) : ("sandbox" as const),
      };
    },
  )
  .handler(
    async ({ data }): Promise<{ clientSecret: string; startsOn: string; endsOn: string; amount: number } | { error: string }> => {
      let ctx;
      try {
        ctx = await requireUser();
      } catch {
        return { error: "Bitte melde dich als Künstler an." };
      }
      if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
      if (data.city.length < 2) return { error: "Bitte deine Stadt angeben." };
      if (data.tagline.length < 3) return { error: "Bitte einen kurzen Slogan eintragen." };
      const { findContact } = await import("@/showly/contactGuard");
      if (findContact(data.tagline).length) return { error: "Bitte keine Kontaktdaten, Adressen oder Namen im Slogan." };
      const db = adminClient();
      /* Nur mit freigeschaltetem Künstlerprofil; Name, Sparte und Link kommen von dort */
      const { data: artist } = await db
        .from("artists")
        .select("id, name, cat, loc, published, blocked")
        .eq("owner", ctx.user.id)
        .eq("published", true)
        .eq("blocked", false)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!artist) return { error: "Den Top-Platz können nur Künstler mit freigeschaltetem Profil buchen." };
      const L = (v: unknown) => (typeof v === "string" ? v : String((v as { de?: string } | null)?.de ?? ""));
      const name = L(artist.name).slice(0, 80);
      const { artistPath } = await import("@/showly/slugs");
      const link = artistPath({ id: artist.id, cat: artist.cat, name: artist.name, loc: artist.loc } as never);

      const slug = citySlug(data.city);
      const today = todayBerlin();
      const days = data.weeks * 7;
      const busy = await busyOf(slug);
      const start = data.startISO && data.startISO >= today ? data.startISO : firstFree(busy, today, days, ctx.user.id);
      const end = addDays(start, days - 1);
      const amount = SPOTLIGHT_PRICE * 100 * data.weeks;
      const { data: res, error } = await db.rpc("spotlight_reservieren", {
        p: {
          owner: ctx.user.id,
          artist_id: artist.id,
          city: data.city,
          city_slug: slug,
          name,
          cat: artist.cat,
          tagline: data.tagline,
          link,
          starts_on: start,
          ends_on: end,
          weeks: data.weeks,
          amount_cents: amount,
        },
      });
      const r = res as { id?: number; error?: string } | null;
      if (error || !r) return { error: "Reservierung hat nicht geklappt" };
      if (r.error === "doppelt") return { error: "Du hast in diesem Zeitraum in deiner Stadt schon einen Top-Platz." };
      if (r.error || !r.id) return { error: "Alle fünf Plätze sind in diesem Zeitraum vergeben. Bitte einen späteren Start wählen." };
      try {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const d = (x: string) => x.split("-").reverse().join(".");
        const s = await createStripeClient(data.environment).checkout.sessions.create({
          mode: "payment",
          ui_mode: "embedded_page",
          submit_type: "pay",
          return_url: data.returnUrl,
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: { name: `Top Act der Woche · ${data.city} · ${d(start)}–${d(end)}` },
                unit_amount: SPOTLIGHT_PRICE * 100,
              },
              quantity: data.weeks,
            },
          ],
          payment_intent_data: { description: `Showly Top Act ${data.city}` },
          metadata: { kind: "spotlight", spotlight_id: String(r.id) },
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          locale: "de",
        });
        await db.from("spotlights").update({ stripe_session_id: s.id }).eq("id", r.id);
        return { clientSecret: s.client_secret ?? "", startsOn: start, endsOn: end, amount: amount / 100 };
      } catch (e) {
        await db.from("spotlights").update({ status: "cancelled" }).eq("id", r.id);
        const { getStripeErrorMessage } = await import("@/lib/stripe.server");
        return { error: getStripeErrorMessage(e) };
      }
    },
  );

/** Nach der Rückkehr aus Stripe: Zahlung prüfen, Platz fest buchen */
export const topActSettle = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_[A-Za-z0-9_]+$/.test(String(d.sessionId))) throw new Error("Ungültig");
    return { sessionId: String(d.sessionId), environment: d.environment === "live" ? ("live" as const) : ("sandbox" as const) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const { settleSpotlight } = await import("@/lib/spotlight.server");
    const r = await settleSpotlight(data.sessionId, data.environment).catch(() => ({ error: "Zahlung konnte nicht geprüft werden" }) as const);
    return "error" in r ? { error: r.error } : { ok: true };
  });
