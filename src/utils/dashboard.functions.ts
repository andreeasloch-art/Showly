/* Anbieter-Dashboard über die Datenbank: Übersicht für alle Anbieter
 * (Künstler, Planer, Konditoreien, Deko- und Kostümanbieter).
 *
 *  - Was diese Woche verdient wurde und was diese Woche ausgezahlt wird
 *  - Offene Auszahlungen, Monat, die letzten 8 Wochen
 *  - Statistik: Profilaufrufe, Anfragen, Buchungen, Conversion (30 Tage)
 *  - Urlaubsmodus
 *  - Abrechnung je Monat als CSV (Gutschrift-Übersicht)
 * Aufrufe werden nur als Zahl je Profil und Tag gezählt, ohne Personendaten. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow, clientIp } from "@/lib/guard.server";

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Montag der Woche (deutsche Zeit genügt hier auf Tagesbasis) */
export function weekStart(dayISO: string): string {
  const d = new Date(dayISO + "T12:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return iso(d.getTime() - wd * DAY);
}

/* ---------------------------------------------------------------------------
 * Aufruf zählen (Profilseite)
 * ------------------------------------------------------------------------ */
export const trackView = createServerFn({ method: "POST" })
  .inputValidator((d: { kind: string; ref: number }) => ({
    kind: d.kind === "baker" || d.kind === "deco" ? d.kind : "artist",
    ref: Math.max(0, Math.round(Number(d.ref)) || 0),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (data.ref < 100000) return { ok: false }; // Beispielprofile zählen nicht
    if (!(await allow("view", `${clientIp()}:${data.kind}:${data.ref}`))) return { ok: false };
    await adminClient().rpc("bump_view", { p_kind: data.kind, p_ref: data.ref }).then(undefined, () => null);
    return { ok: true };
  });

/* ---------------------------------------------------------------------------
 * Übersicht
 * ------------------------------------------------------------------------ */
export interface OverviewPayout {
  id: number;
  label: string;
  eventDay: string;
  payoutOn: string;
  netCents: number;
  grossCents: number;
  status: string;
  frozen: boolean;
}
export interface Overview {
  week: { from: string; to: string; grossCents: number; netCents: number; count: number };
  payoutThisWeekCents: number;
  paidThisWeekCents: number;
  openCents: number;
  monthNetCents: number;
  weeks: { from: string; netCents: number }[];
  upcoming: OverviewPayout[];
  stats: { views: number; requests: number; booked: number; conversion: number };
  away: { until: string | null };
  hasAccount: boolean;
}

async function mine(uid: string) {
  const db = adminClient();
  const [{ data: arts }, { data: provs }] = await Promise.all([
    db.from("artists").select("id, away_until").eq("owner", uid),
    db.from("providers").select("id, kind, data").eq("owner", uid),
  ]);
  return { db, artists: arts || [], providers: provs || [] };
}

export const providerOverview = createServerFn({ method: "POST" }).handler(async (): Promise<Overview | { error: string }> => {
  const ctx = await me();
  if (!ctx) return { error: "Bitte melde dich an" };
  const uid = ctx.user.id;
  const { db, artists, providers } = await mine(uid);
  const artistIds = artists.map((a) => a.id);
  if (!artistIds.length && !providers.length) return { error: "Kein Anbieterprofil" };

  const today = iso(Date.now());
  const from = weekStart(today);
  const to = iso(new Date(from + "T12:00:00Z").getTime() + 6 * DAY);
  const from8 = iso(new Date(from + "T12:00:00Z").getTime() - 7 * 7 * DAY);
  const month = today.slice(0, 7);

  /* Alle Auszahlungen dieses Anbieters (Künstler über artist_id, sonst owner) */
  const filter = artistIds.length ? `owner.eq.${uid},artist_id.in.(${artistIds.join(",")})` : `owner.eq.${uid}`;
  const { data: pays } = await db.from("payouts").select("*").or(filter).order("payout_on", { ascending: false }).limit(1000);
  const bookingIds = (pays || []).map((p) => p.booking_id).filter((x): x is number => !!x);
  const { data: bks } = bookingIds.length ? await db.from("bookings").select("id, day").in("id", bookingIds) : { data: [] as { id: number; day: string }[] };
  const dayOf = new Map((bks || []).map((b) => [b.id, b.day]));
  const rows = (pays || [])
    .filter((p) => p.status !== "cancelled")
    .map((p) => ({ ...p, eventDay: (p.booking_id ? dayOf.get(p.booking_id) : p.event_day) ?? p.payout_on }));

  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const week = rows.filter((p) => inRange(p.eventDay, from, to));
  const weeks: { from: string; netCents: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const wf = iso(new Date(from + "T12:00:00Z").getTime() - i * 7 * DAY);
    const wt = iso(new Date(wf + "T12:00:00Z").getTime() + 6 * DAY);
    weeks.push({ from: wf, netCents: rows.filter((p) => inRange(p.eventDay, wf, wt)).reduce((n, p) => n + p.net_cents, 0) });
  }

  /* Statistik der letzten 30 Tage */
  const since = iso(Date.now() - 30 * DAY);
  const refs = [
    ...artistIds.map((id) => ({ kind: "artist", ref: id })),
    ...providers.map((p) => ({ kind: p.kind as string, ref: p.id })),
  ];
  let views = 0;
  for (const r of refs) {
    const { data: v } = await db.from("provider_views").select("views").eq("kind", r.kind as "artist").eq("ref", r.ref).gte("day", since);
    views += (v || []).reduce((n, x) => n + x.views, 0);
  }
  let requests = 0;
  let booked = 0;
  if (artistIds.length) {
    const { data: b } = await db.from("bookings").select("status").in("artist_id", artistIds).gte("created_at", since + "T00:00:00Z");
    requests += (b || []).length;
    booked += (b || []).filter((x) => ["confirmed", "completed"].includes(x.status)).length;
  }
  const baker = providers.find((p) => p.kind === "baker");
  if (baker) {
    const { data: s } = await db.from("sweet_requests").select("status").eq("baker_owner", uid).gte("created_at", since + "T00:00:00Z");
    requests += (s || []).length;
    booked += (s || []).filter((x) => ["confirmed", "booked"].includes(x.status)).length;
  }
  if (providers.some((p) => p.kind === "deco")) {
    const { data: o } = await db.from("shop_orders").select("status").contains("provider_owners", [uid]).gte("created_at", since + "T00:00:00Z");
    requests += (o || []).length;
    booked += (o || []).filter((x) => x.status !== "cancelled" && x.status !== "pending").length;
  }

  const { data: acc } = await db.from("payout_accounts").select("payouts_enabled").eq("profile_id", uid).maybeSingle();
  const awayUntil =
    artists.find((a) => a.away_until && a.away_until >= today)?.away_until ??
    (providers.map((p) => String(((p.data || {}) as Record<string, unknown>)["awayUntil"] || "")).find((d) => d && d >= today) || null);

  return {
    week: {
      from,
      to,
      grossCents: week.reduce((n, p) => n + p.gross_cents, 0),
      netCents: week.reduce((n, p) => n + p.net_cents, 0),
      count: week.length,
    },
    payoutThisWeekCents: rows.filter((p) => inRange(p.payout_on, from, to)).reduce((n, p) => n + p.net_cents, 0),
    paidThisWeekCents: rows.filter((p) => p.status === "paid" && inRange(p.payout_on, from, to)).reduce((n, p) => n + p.net_cents, 0),
    openCents: rows.filter((p) => p.status === "scheduled" || p.status === "held").reduce((n, p) => n + (p.status === "held" ? p.reserve_cents : p.net_cents), 0),
    monthNetCents: rows.filter((p) => p.eventDay.startsWith(month)).reduce((n, p) => n + p.net_cents, 0),
    weeks: weeks.filter((w) => w.from >= from8),
    upcoming: rows
      .filter((p) => p.status === "scheduled" || p.status === "held")
      .sort((a, b) => a.payout_on.localeCompare(b.payout_on))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        label: p.booking_id ? "Auftritt" : p.kind === "baker" ? "Torten-Bestellung" : "Shop-Bestellung",
        eventDay: p.eventDay,
        payoutOn: p.status === "held" && p.reserve_until ? p.reserve_until : p.payout_on,
        netCents: p.status === "held" ? p.reserve_cents : p.net_cents,
        grossCents: p.gross_cents,
        status: p.status,
        frozen: p.frozen === true,
      })),
    stats: { views, requests, booked, conversion: views ? Math.round((booked / views) * 1000) / 10 : 0 },
    away: { until: awayUntil },
    hasAccount: acc?.payouts_enabled === true,
  };
});

/* ---------------------------------------------------------------------------
 * Urlaubsmodus: bis zu einem Datum keine neuen Buchungen/Bestellungen
 * ------------------------------------------------------------------------ */
export const setAwayMode = createServerFn({ method: "POST" })
  .inputValidator((d: { until: string | null }) => ({ until: d.until && /^\d{4}-\d{2}-\d{2}$/.test(d.until) ? d.until : null }))
  .handler(async ({ data }): Promise<{ ok: true; blocked: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const uid = ctx.user.id;
    const { db, artists, providers } = await mine(uid);
    const today = iso(Date.now());
    if (data.until && data.until < today) return { error: "Das Datum liegt in der Vergangenheit" };
    if (data.until && data.until > iso(Date.now() + 180 * DAY)) return { error: "Höchstens 6 Monate am Stück" };
    let blocked = 0;
    for (const a of artists) {
      const { data: cur } = await db.from("artists").select("away_from, away_until").eq("id", a.id).maybeSingle();
      /* alten Urlaub freigeben (nur die Tage, die der Urlaubsmodus gesperrt hat) */
      if (cur?.away_from && cur.away_until)
        await db.from("availability").delete().eq("artist_id", a.id).eq("slot", "all").gte("day", cur.away_from).lte("day", cur.away_until);
      if (data.until) {
        const days: string[] = [];
        for (let t = new Date(today + "T12:00:00Z").getTime(); iso(t) <= data.until; t += DAY) days.push(iso(t));
        /* Bestehende Buchungen bleiben bestehen; neue sind an diesen Tagen nicht möglich */
        await db.from("availability").upsert(days.map((day) => ({ artist_id: a.id, day, slot: "all", blocked: true })));
        blocked += days.length;
      }
      await db.from("artists").update({ away_from: data.until ? today : null, away_until: data.until }).eq("id", a.id);
    }
    for (const p of providers) {
      const d = { ...((p.data || {}) as Record<string, unknown>), awayUntil: data.until ?? "" };
      await db.from("providers").update({ data: d }).eq("id", p.id);
    }
    return { ok: true, blocked };
  });

/* ---------------------------------------------------------------------------
 * Abrechnung eines Monats als CSV (Übersicht der Gutschriften)
 * ------------------------------------------------------------------------ */
export const monthStatement = createServerFn({ method: "POST" })
  .inputValidator((d: { month: string }) => ({ month: /^\d{4}-\d{2}$/.test(d.month) ? d.month : new Date().toISOString().slice(0, 7) }))
  .handler(async ({ data }): Promise<{ csv: string; filename: string } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const uid = ctx.user.id;
    const { db, artists } = await mine(uid);
    const ids = artists.map((a) => a.id);
    const filter = ids.length ? `owner.eq.${uid},artist_id.in.(${ids.join(",")})` : `owner.eq.${uid}`;
    const { data: pays } = await db.from("payouts").select("*").or(filter).limit(2000);
    const bookingIds = (pays || []).map((p) => p.booking_id).filter((x): x is number => !!x);
    const { data: bks } = bookingIds.length ? await db.from("bookings").select("id, day").in("id", bookingIds) : { data: [] as { id: number; day: string }[] };
    const dayOf = new Map((bks || []).map((b) => [b.id, b.day]));
    const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const rows = (pays || [])
      .map((p) => ({ ...p, eventDay: (p.booking_id ? dayOf.get(p.booking_id) : p.event_day) ?? p.payout_on }))
      .filter((p) => p.eventDay.startsWith(data.month))
      .sort((a, b) => a.eventDay.localeCompare(b.eventDay));
    const status: Record<string, string> = { scheduled: "geplant", held: "Einbehalt", paid: "ausgezahlt", cancelled: "entfällt" };
    const head = ["Datum", "Art", "Kundenpreis (€)", "Provision (€)", "Gebühr schnellere Auszahlung (€)", "Verrechnete Vertragsstrafe (€)", "Auszahlung (€)", "Auszahlung am", "Status"];
    const lines = rows.map((p) =>
      [
        p.eventDay.split("-").reverse().join("."),
        p.booking_id ? "Auftritt" : p.kind === "baker" ? "Torten" : "Shop",
        eur(p.gross_cents),
        eur(p.fee_cents),
        eur(p.express_fee_cents ?? 0),
        eur(p.offset_cents ?? 0),
        eur(p.net_cents),
        p.payout_on.split("-").reverse().join("."),
        status[p.status] ?? p.status,
      ].join(";"),
    );
    const sum = rows.filter((p) => p.status !== "cancelled");
    lines.push(["Summe", "", eur(sum.reduce((n, p) => n + p.gross_cents, 0)), eur(sum.reduce((n, p) => n + p.fee_cents, 0)), "", "", eur(sum.reduce((n, p) => n + p.net_cents, 0)), "", ""].join(";"));
    return { csv: "﻿" + [head.join(";"), ...lines].join("\r\n"), filename: `showly-abrechnung-${data.month}.csv` };
  });
