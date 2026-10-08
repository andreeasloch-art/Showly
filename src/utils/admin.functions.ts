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

/** Audit-Log: jede Aktion der Verwaltung mit Person, Ziel und Details */
async function audit(action: string, target: string | null, detail: Record<string, unknown> = {}) {
  try {
    const { requireUser } = await import("@/lib/supabase.server");
    const { user } = await requireUser();
    await adminClient().from("admin_audit").insert({ actor: user.id, action: action.slice(0, 80), target, detail });
  } catch {
    /* Protokoll darf die Aktion nicht verhindern */
  }
}

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
    const { pendingMediaCount } = await import("@/lib/media.server");
    const [reports, penalties, artists, providers, tickets, errors, refunds, media] =
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
        pendingMediaCount(),
      ]);
    return { reports, penalties, artists, providers, tickets, errors, refunds, media };
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
              "id, owner, cat, name, loc, price_cents, verified, published, blocked, blocked_reason, business, created_at",
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
      await audit(`${data.section}:${"action" in data ? String(data.action) : "act"}`, String(data.id), {
        ...("text" in data && data.text ? { text: data.text.slice(0, 500) } : {}),
        ...("cents" in data ? { cents: (data as { cents?: number }).cents } : {}),
      });

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
              const { voucherCode, voucherValidUntil } =
                await import("@/showly/booking");
              const { apologyVoucherCents } = await import("@/showly/policies");
              const { data: bk } = await a.from("bookings").select("amount_cents").eq("id", p.booking_id).maybeSingle();
              for (let i = 0; i < 3; i++) {
                const { error } = await a.from("vouchers").insert({
                  code: voucherCode(),
                  owner: customer,
                  booking_id: p.booking_id,
                  amount_cents: apologyVoucherCents(bk?.amount_cents ?? 0),
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
          /* Suchmaschinen über neue oder entfernte Profile informieren */
          if (data.section === "artists" && data.action !== "unblock") {
            const { indexNow } = await import("@/lib/indexnow.server");
            await indexNow([`/kuenstler/${data.id}`]);
          }
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
          const { refundBooking } = await import("@/lib/money.server");
          const r = await refundBooking(data.id, {
            env: data.environment,
            ...(data.cents !== undefined ? { cents: data.cents } : {}),
          });
          if ("error" in r) return r;
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
    await audit("export", null);
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

/* ------------------------------------------------------------------ */
/** Tägliche Aufgaben sofort ausführen: verfallene Anfragen, Erinnerungen,
 *  fällige Auszahlungen, Löschfristen (lib/daily.server.ts) */
export const adminRunDaily = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await guard())) return DENIED;
  await audit("daily", null);
  const { runDaily } = await import("@/lib/daily.server");
  return { ok: true as const, result: await runDaily() };
});

/* ------------------------------------------------------------------ */
/** Provision je Kategorie oder Anbieter */
export const adminFees = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { op: "list" } | { op: "set"; scope: string; ref: string; rate: string | number } | { op: "delete"; id: number }) => d,
  )
  .handler(async ({ data }): Promise<{ rules: { id: number; scope: string; ref: string; rate: number }[]; standard: number } | { error: string }> => {
    if (!(await guard())) return DENIED;
    const a = adminClient();
    if (data.op === "set") {
      const { cleanRate } = await import("@/showly/feeRules");
      const rate = cleanRate(data.rate);
      const scope = String(data.scope);
      const ref = String(data.ref || "").trim().slice(0, 40);
      if (rate === null) return { error: "Provision zwischen 0 und 50 % angeben" };
      if (!["category", "artist", "baker", "deco"].includes(scope) || !/^[a-z0-9_-]{1,40}$/i.test(ref))
        return { error: "Kategorie bzw. Anbieter-Kennung angeben" };
      await a.from("fee_rules").upsert({ scope: scope as "category", ref, rate }, { onConflict: "scope,ref" });
      await audit("fee:set", `${scope}:${ref}`, { rate });
    }
    if (data.op === "delete" && Number.isInteger(data.id)) {
      await a.from("fee_rules").delete().eq("id", data.id);
      await audit("fee:delete", String(data.id));
    }
    const { FEE_RATE } = await import("@/showly/pricing");
    const { data: rows } = await a.from("fee_rules").select("id, scope, ref, rate").order("scope").order("ref");
    return { rules: (rows || []).map((r) => ({ ...r, rate: Number(r.rate) })), standard: FEE_RATE };
  });

/* ------------------------------------------------------------------ */
/** Rabattcodes und Geschenkgutscheine (Stripe-Promotion-Codes). Den Rabatt
 *  trägt Showly; Anbieter bekommen ihren vollen Anteil. */
export type PromoInfo = {
  id: string;
  code: string;
  active: boolean;
  off: string;
  used: number;
  max: number | null;
  expires: string | null;
};

export const adminPromos = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d:
        | { op: "list"; environment: StripeEnv }
        | {
            op: "create";
            environment: StripeEnv;
            code: string;
            percent?: number;
            euros?: number;
            max?: number;
            expires?: string;
            minEuros?: number;
          }
        | { op: "off"; environment: StripeEnv; id: string },
    ) => {
      if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Ungültige Umgebung");
      return d;
    },
  )
  .handler(async ({ data }): Promise<{ promos: PromoInfo[] } | { error: string }> => {
    if (!(await guard())) return DENIED;
    const stripe = createStripeClient(data.environment);
    try {
      if (data.op === "create") {
        const code = String(data.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9-]{3,30}$/.test(code)) return { error: "Code: 3–30 Zeichen, Buchstaben, Ziffern, Bindestrich" };
        const pct = Number(data.percent) || 0;
        const eur = Number(data.euros) || 0;
        if (!(pct > 0 && pct <= 90) === !(eur > 0 && eur <= 5000)) return { error: "Entweder Prozent (1–90) oder Euro-Betrag angeben" };
        const coupon = await stripe.coupons.create({
          ...(pct ? { percent_off: pct } : { amount_off: Math.round(eur * 100), currency: "eur" }),
          duration: "once",
          name: code,
        });
        const exp = data.expires && /^\d{4}-\d{2}-\d{2}$/.test(data.expires) ? Math.floor(Date.parse(data.expires + "T23:59:59Z") / 1000) : undefined;
        await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: coupon.id },
          code,
          ...(data.max && data.max > 0 ? { max_redemptions: Math.min(100000, Math.round(data.max)) } : {}),
          ...(exp ? { expires_at: exp } : {}),
          ...(data.minEuros && data.minEuros > 0
            ? { restrictions: { minimum_amount: Math.round(data.minEuros * 100), minimum_amount_currency: "eur" } }
            : {}),
        } as Parameters<typeof stripe.promotionCodes.create>[0]);
        await audit("promo:create", code, { pct, eur, max: data.max ?? null, expires: data.expires ?? null });
      }
      if (data.op === "off") {
        await stripe.promotionCodes.update(data.id, { active: false });
        await audit("promo:off", data.id);
      }
      const list = await stripe.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] } as Parameters<typeof stripe.promotionCodes.list>[0]);
      return {
        promos: list.data.map((p) => {
          const raw = p as unknown as { promotion?: { coupon?: { percent_off?: number | null; amount_off?: number | null } }; coupon?: { percent_off?: number | null; amount_off?: number | null } };
          const c = raw.promotion?.coupon ?? raw.coupon ?? {};
          return {
            id: p.id,
            code: p.code,
            active: p.active,
            off: c.percent_off ? `${c.percent_off} %` : c.amount_off ? `${(c.amount_off / 100).toFixed(2).replace(".", ",")} €` : "–",
            used: p.times_redeemed,
            max: p.max_redemptions ?? null,
            expires: p.expires_at ? new Date(p.expires_at * 1000).toISOString().slice(0, 10) : null,
          };
        }),
      };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/* ------------------------------------------------------------------ */
/** Berichte: Umsatz, Provision, Buchungen, Stornoquote, Top-Anbieter */
export interface AdminReport {
  from: string;
  to: string;
  revenueCents: number;
  feeCents: number;
  discountCents: number;
  orders: number;
  bookings: { total: number; confirmed: number; cancelled: number; declined: number; requested: number };
  cancelRate: number;
  disputes: number;
  /** Ersatzgarantie: Vertragsstrafen + Anteil der Provision (showly/guarantee.ts) */
  penaltiesCents: number;
  guaranteeCents: number;
  top: { kind: string; providerId: number | null; name: string; cents: number; count: number }[];
}

export const adminReport = createServerFn({ method: "POST" })
  .inputValidator((d: { from: string; to: string }) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(d.from) || !iso.test(d.to)) throw new Error("Ungültiger Zeitraum");
    return d;
  })
  .handler(async ({ data }): Promise<AdminReport | { error: string }> => {
    if (!(await guard())) return DENIED;
    const a = adminClient();
    const end = data.to + "T23:59:59Z";
    const [{ data: orders }, { data: subs }, { data: bks }] = await Promise.all([
      a.from("orders").select("id, total_cents, discount_cents, status, dispute_status").gte("created_at", data.from).lte("created_at", end).limit(10000),
      a
        .from("sub_orders")
        .select("provider_kind, provider_id, amount_cents, fee_cents, status, orders!inner(created_at, status)")
        .gte("orders.created_at", data.from)
        .lte("orders.created_at", end)
        .limit(20000),
      a.from("bookings").select("status").gte("created_at", data.from).lte("created_at", end).limit(20000),
    ]);
    const { data: pens } = await a
      .from("penalties")
      .select("amount_cents, status")
      .eq("status", "due")
      .gte("created_at", data.from)
      .lte("created_at", end)
      .limit(10000);
    const penaltiesCents = (pens || []).reduce((n, p) => n + p.amount_cents, 0);
    const paid = (orders || []).filter((o) => o.status === "paid");
    const b = { total: 0, confirmed: 0, cancelled: 0, declined: 0, requested: 0 };
    for (const x of bks || []) {
      b.total++;
      const st = String(x.status);
      if (st === "confirmed" || st === "completed") b.confirmed++;
      else if (st === "cancelled") b.cancelled++;
      else if (st === "declined") b.declined++;
      else if (st === "requested" || st === "pending") b.requested++;
    }
    const live = (subs || []).filter((s) => !["cancelled", "declined", "refunded"].includes(String(s.status)));
    const byProv = new Map<string, { kind: string; providerId: number | null; cents: number; count: number }>();
    for (const s of live) {
      const k = `${s.provider_kind}:${s.provider_id ?? "showly"}`;
      const e = byProv.get(k) ?? { kind: s.provider_kind, providerId: s.provider_id, cents: 0, count: 0 };
      e.cents += s.amount_cents;
      e.count++;
      byProv.set(k, e);
    }
    const top = [...byProv.values()].sort((x, y) => y.cents - x.cents).slice(0, 10);
    const artistIds = top.filter((t) => t.kind === "artist" && t.providerId).map((t) => t.providerId!);
    const provIds = top.filter((t) => t.kind !== "artist" && t.providerId).map((t) => t.providerId!);
    const names = new Map<string, string>();
    if (artistIds.length) {
      const { data: ar } = await a.from("artists").select("id, name").in("id", artistIds);
      for (const r of ar || []) names.set(`artist:${r.id}`, typeof r.name === "string" ? r.name : (r.name as { de?: string })?.de ?? "");
    }
    if (provIds.length) {
      const { data: pr } = await a.from("providers").select("id, data").in("id", provIds);
      for (const r of pr || []) {
        const d = (r.data || {}) as Record<string, unknown>;
        names.set(`p:${r.id}`, String(d["name"] || d["vendor"] || ""));
      }
    }
    return {
      from: data.from,
      to: data.to,
      revenueCents: paid.reduce((n, o) => n + o.total_cents, 0),
      feeCents: live.reduce((n, s) => n + s.fee_cents, 0),
      discountCents: paid.reduce((n, o) => n + (o.discount_cents ?? 0), 0),
      orders: paid.length,
      bookings: b,
      cancelRate: b.total ? (b.cancelled + b.declined) / b.total : 0,
      disputes: (orders || []).filter((o) => o.dispute_status).length,
      penaltiesCents,
      guaranteeCents: (await import("@/showly/guarantee")).guaranteePool({
        penaltiesCents,
        feeCents: live.reduce((n, s) => n + s.fee_cents, 0),
      }),
      top: top.map((t) => ({
        ...t,
        name:
          t.kind === "showly"
            ? "Showly-Shop"
            : (names.get(t.kind === "artist" ? `artist:${t.providerId}` : `p:${t.providerId}`) || `#${t.providerId}`),
      })),
    };
  });

/* ------------------------------------------------------------------ */
/** Audit-Log lesen */
export const adminAudit = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ rows: { id: number; email: string | null; action: string; target: string | null; detail: string; created_at: string }[] } | { error: string }> => {
    if (!(await guard())) return DENIED;
    const a = adminClient();
    const { data } = await a.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(300);
    const ids = [...new Set((data || []).map((r) => r.actor).filter((x): x is string => !!x))];
    const mails = new Map<string, string>();
    if (ids.length) {
      const { data: ps } = await a.from("profiles").select("id, email").in("id", ids);
      for (const p of ps || []) if (p.email) mails.set(p.id, p.email);
    }
    return {
      rows: (data || []).map((r) => ({
        id: r.id,
        email: r.actor ? (mails.get(r.actor) ?? null) : null,
        action: r.action,
        target: r.target,
        detail: r.detail && Object.keys(r.detail).length ? JSON.stringify(r.detail).slice(0, 300) : "",
        created_at: r.created_at,
      })),
    };
  },
);
