/* Verwaltung, Server-Seite.
 *
 * Jede Funktion prüft zuerst selbst, ob die Person die Rolle "admin" hat
 * (requireAdmin). Der Browser kann das nicht vortäuschen. Entscheidungen
 * über Meldungen und Sperren werden begründet gespeichert (Art. 17 DSA,
 * AGB § 23 Abs. 3) und der betroffenen Person per Mail mitgeteilt, soweit
 * ein Mail-Dienst eingerichtet ist. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient } from "@/lib/supabase.server";
import { requireAdmin } from "@/lib/guard.server";
import { sendMail } from "@/lib/mail.server";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "@/lib/stripe.server";

export type AdminSection =
  | "reports"
  | "penalties"
  | "artists"
  | "providers"
  | "refunds"
  | "tickets"
  | "errors";

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

const DENIED = { error: "Keine Berechtigung" } as const;

async function emailOf(
  profile: string | null | undefined,
): Promise<string | null> {
  if (!profile) return null;
  const { data } = await adminClient()
    .from("profiles")
    .select("email")
    .eq("id", profile)
    .maybeSingle();
  return data?.email ?? null;
}

/* ------------------------------------------------------------------ */
export const adminOverview = createServerFn({ method: "POST" }).handler(
  async () => {
    if (!(await guard())) return DENIED;
    const a = adminClient();
    const since = new Date(Date.now() - 86400000).toISOString();
    const count = async (q: PromiseLike<{ count: number | null }>) =>
      (await q).count || 0;
    const [reports, penalties, artists, providers, tickets, errors, refunds] =
      await Promise.all([
        count(
          a
            .from("reports")
            .select("id", { count: "exact", head: true })
            .eq("status", "open"),
        ),
        count(
          a
            .from("penalties")
            .select("id", { count: "exact", head: true })
            .in("status", ["proof", "hearing"]),
        ),
        count(
          a
            .from("artists")
            .select("id", { count: "exact", head: true })
            .eq("published", false)
            .eq("blocked", false),
        ),
        count(
          a
            .from("providers")
            .select("id", { count: "exact", head: true })
            .eq("published", false)
            .eq("blocked", false),
        ),
        count(
          a
            .from("support_tickets")
            .select("id", { count: "exact", head: true })
            .eq("status", "open"),
        ),
        count(
          a
            .from("client_errors")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since),
        ),
        count(
          a
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("paid", true)
            .in("status", ["cancelled", "declined", "noshow"])
            .eq("refunded_cents", 0),
        ),
      ]);
    return { reports, penalties, artists, providers, tickets, errors, refunds };
  },
);

/* ------------------------------------------------------------------ */
export const adminList = createServerFn({ method: "POST" })
  .inputValidator((d: { section: AdminSection }) => d)
  .handler(async ({ data }): Promise<{ json: string } | { error: string }> => {
    if (!(await guard())) return DENIED;
    const rows = await listRows(data.section);
    return { json: JSON.stringify(rows) };
  });

async function listRows(section: AdminSection): Promise<unknown[]> {
  const a = adminClient();
  switch (section) {
    case "reports":
      return (
        (
          await a
            .from("reports")
            .select("*")
            .order("status")
            .order("created_at", { ascending: false })
            .limit(200)
        ).data || []
      );
    case "penalties":
      return (
        (
          await a
            .from("penalties")
            .select(
              "*, bookings(day, slot, customer_name, artist_id, catalog_artist)",
            )
            .order("created_at", { ascending: false })
            .limit(200)
        ).data || []
      );
    case "artists":
      return (
        (
          await a
            .from("artists")
            .select(
              "id, owner, cat, name, loc, price_cents, verified, published, blocked, blocked_reason, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(500)
        ).data || []
      );
    case "providers":
      return (
        (
          await a
            .from("providers")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        ).data || []
      );
    case "refunds":
      return (
        (
          await a
            .from("bookings")
            .select(
              "id, day, slot, status, amount_cents, refunded_cents, refunded_at, cancelled_by, customer_name, stripe_session_id, paid",
            )
            .eq("paid", true)
            .in("status", ["cancelled", "declined", "noshow"])
            .order("day", { ascending: false })
            .limit(300)
        ).data || []
      );
    case "tickets":
      return (
        (
          await a
            .from("support_tickets")
            .select("*")
            .order("status")
            .order("created_at", { ascending: false })
            .limit(300)
        ).data || []
      );
    case "errors":
      return (
        (
          await a
            .from("client_errors")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(300)
        ).data || []
      );
  }
}

/* ------------------------------------------------------------------ */
export type AdminAction =
  | { section: "reports"; id: number; action: "remove" | "keep"; text: string }
  | {
      section: "penalties";
      id: number;
      action: "waive" | "confirm";
      text?: string;
    }
  | {
      section: "artists";
      id: number;
      action: "publish" | "unpublish" | "block" | "unblock";
      text?: string;
    }
  | {
      section: "providers";
      id: number;
      action: "publish" | "unpublish" | "block" | "unblock";
      text?: string;
    }
  | {
      section: "tickets";
      id: number;
      action: "answer" | "close";
      text?: string;
    }
  | {
      section: "refunds";
      id: number;
      action: "refund";
      cents?: number;
      environment: StripeEnv;
    };

export const adminAct = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAction) => {
    if (!Number.isInteger(d.id) || d.id <= 0)
      throw new Error("Ungültige Kennung");
    if ("text" in d && d.text !== undefined)
      d.text = String(d.text).slice(0, 4000);
    return d;
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; note?: string } | { error: string }> => {
      if (!(await guard())) return DENIED;
      const a = adminClient();
      const now = new Date().toISOString();

      switch (data.section) {
        /* Meldung entscheiden; bei "entfernen" wird der Inhalt gelöscht */
        case "reports": {
          if (!data.text?.trim())
            return { error: "Bitte die Entscheidung begründen" };
          const { data: r } = await a
            .from("reports")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (!r) return { error: "Meldung nicht gefunden" };
          if (data.action === "remove") {
            const id = Number(r.target_id);
            if (Number.isInteger(id)) {
              if (r.target_type === "post")
                await a.from("posts").delete().eq("id", id);
              if (r.target_type === "comment")
                await a.from("post_comments").delete().eq("id", id);
              if (r.target_type === "review")
                await a.from("reviews").delete().eq("id", id);
            }
          }
          await a
            .from("reports")
            .update({
              status: data.action === "remove" ? "removed" : "kept",
              decision: data.text,
              decided_at: now,
            })
            .eq("id", r.id);
          const to = await emailOf(r.reporter);
          if (to)
            await sendMail(to, "Deine Meldung bei Showly", [
              data.action === "remove"
                ? "Wir haben den gemeldeten Inhalt entfernt."
                : "Wir haben den gemeldeten Inhalt geprüft und belassen.",
              "Begründung: " + data.text,
            ]);
          return { ok: true };
        }

        /* Notfall-Nachweis bzw. Anhörung entscheiden (AGB § 9 Abs. 3 und 5) */
        case "penalties": {
          const { data: p } = await a
            .from("penalties")
            .select("*, bookings(customer)")
            .eq("id", data.id)
            .maybeSingle();
          if (!p) return { error: "Vertragsstrafe nicht gefunden" };
          if (data.action === "waive") {
            await a
              .from("penalties")
              .update({ status: "waived", updated_at: now })
              .eq("id", p.id);
          } else {
            await a
              .from("penalties")
              .update({ status: "due", due_at: now, updated_at: now })
              .eq("id", p.id);
            const customer = (
              p as unknown as { bookings: { customer: string | null } | null }
            ).bookings?.customer;
            if (customer) {
              const { VOUCHER_EUR, voucherCode, voucherValidUntil } =
                await import("@/showly/booking");
              for (let i = 0; i < 3; i++) {
                const { error } = await a.from("vouchers").insert({
                  code: voucherCode(),
                  owner: customer,
                  booking_id: p.booking_id,
                  amount_cents: VOUCHER_EUR * 100,
                  valid_until: voucherValidUntil(),
                });
                if (!error || error.message.includes("booking_id")) break;
              }
            }
          }
          if (data.text?.trim())
            await a
              .from("penalties")
              .update({ statement: data.text })
              .eq("id", p.id);
          return { ok: true };
        }

        /* Künstler freischalten, verbergen, sperren (AGB § 23) */
        case "artists":
        case "providers": {
          const patch: {
            published?: boolean;
            blocked?: boolean;
            updated_at: string;
          } =
            data.action === "publish"
              ? { published: true, updated_at: now }
              : data.action === "unpublish"
                ? { published: false, updated_at: now }
                : data.action === "block"
                  ? { blocked: true, published: false, updated_at: now }
                  : { blocked: false, updated_at: now };
          if (data.action === "block" && !data.text?.trim())
            return { error: "Bitte die Sperre begründen" };
          const { data: row } =
            data.section === "artists"
              ? await a
                  .from("artists")
                  .update({
                    ...patch,
                    ...(data.action === "block"
                      ? { blocked_reason: data.text ?? null }
                      : {}),
                  })
                  .eq("id", data.id)
                  .select("owner")
                  .maybeSingle()
              : await a
                  .from("providers")
                  .update(patch)
                  .eq("id", data.id)
                  .select("owner")
                  .maybeSingle();
          if (!row) return { error: "Nicht gefunden" };
          const to = await emailOf(row.owner);
          if (to && data.action === "publish")
            await sendMail(to, "Dein Showly-Profil ist freigeschaltet", [
              "Kunden können dich ab sofort finden und buchen.",
            ]);
          if (to && data.action === "block")
            await sendMail(to, "Dein Showly-Profil wurde gesperrt", [
              "Begründung: " + (data.text || ""),
              "Du kannst innerhalb von 6 Monaten kostenlos Beschwerde einlegen, indem du auf diese Mail antwortest oder das Kontaktformular in der App nutzt (AGB § 23 Abs. 4).",
            ]);
          return { ok: true };
        }

        /* Hilfe-Anfrage beantworten */
        case "tickets": {
          const { data: t } = await a
            .from("support_tickets")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (!t) return { error: "Anfrage nicht gefunden" };
          if (data.action === "close") {
            await a
              .from("support_tickets")
              .update({ status: "closed" })
              .eq("id", t.id);
            return { ok: true };
          }
          if (!data.text?.trim()) return { error: "Antwort fehlt" };
          await a
            .from("support_tickets")
            .update({ status: "answered", answer: data.text, answered_at: now })
            .eq("id", t.id);
          const sent = await sendMail(
            t.email,
            "Antwort auf deine Anfrage bei Showly",
            [data.text, "Deine Nachricht: " + t.body],
          );
          return {
            ok: true,
            ...(sent
              ? {}
              : {
                  note: "Gespeichert. Mail nicht versendet (kein Mail-Dienst eingerichtet); die Antwort steht in der App unter Hilfe.",
                }),
          };
        }

        /* Erstattung an den Kunden über Stripe */
        case "refunds": {
          const { data: b } = await a
            .from("bookings")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (!b || !b.paid) return { error: "Keine bezahlte Buchung" };
          const left = b.amount_cents - b.refunded_cents;
          const cents = Math.min(
            left,
            Math.max(1, Math.round(data.cents ?? left)),
          );
          if (left <= 0) return { error: "Schon vollständig erstattet" };
          const session = String(b.stripe_session_id || "").split(":")[0];
          if (!session)
            return { error: "Keine Stripe-Zahlung zu dieser Buchung" };
          try {
            const stripe = createStripeClient(data.environment);
            const s = await stripe.checkout.sessions.retrieve(session);
            const pi =
              typeof s.payment_intent === "string"
                ? s.payment_intent
                : s.payment_intent?.id;
            if (!pi) return { error: "Zahlung bei Stripe nicht gefunden" };
            await stripe.refunds.create({
              payment_intent: pi,
              amount: cents,
              metadata: { booking_id: String(b.id) },
            });
          } catch (e) {
            return { error: getStripeErrorMessage(e) };
          }
          await a
            .from("bookings")
            .update({
              refunded_cents: b.refunded_cents + cents,
              refunded_at: now,
            })
            .eq("id", b.id);
          const to = await emailOf(b.customer);
          if (to)
            await sendMail(to, "Erstattung deiner Showly-Buchung", [
              `Wir haben ${(cents / 100).toFixed(2).replace(".", ",")} € erstattet. Je nach Bank dauert die Gutschrift einige Tage.`,
            ]);
          return { ok: true };
        }
      }
    },
  );

/* ------------------------------------------------------------------ */
/** Datensicherung: alle Tabellen als JSON (je höchstens 10 000 Zeilen) */
export const adminExport = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ json: string } | { error: string }> => {
    if (!(await guard())) return DENIED;
    const a = adminClient();
    const tables = [
      "profiles",
      "artists",
      "availability",
      "bookings",
      "booking_codes",
      "penalties",
      "vouchers",
      "payouts",
      "payout_accounts",
      "sweet_requests",
      "shop_orders",
      "providers",
      "provider_offers",
      "messages",
      "reviews",
      "posts",
      "post_comments",
      "post_likes",
      "post_artists",
      "reports",
      "blocks",
      "support_tickets",
      "verifications",
    ] as const;
    const out: Record<string, unknown[]> = {};
    for (const t of tables) {
      const { data } = await a.from(t).select("*").limit(10000);
      out[t] = data || [];
    }
    return {
      json: JSON.stringify({
        exportedAt: new Date().toISOString(),
        tables: out,
      }),
    };
  },
);
