/* Anbieter-Konten für Torten und Deko, Server-Seite.
 *
 * Jede angemeldete Person kann ein Torten- und ein Deko-Profil anlegen.
 * Sichtbar für Kunden wird es erst, wenn die Verwaltung es freischaltet
 * (Nachweise: Registrierung beim Lebensmittelamt bzw. Gewerbe). Angebote
 * pflegt nur der Besitzer; Texte prüft der Server auf Kontaktdaten. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow } from "@/lib/guard.server";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown, min: number, max: number, dflt: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : dflt;
};

async function noContact(...texts: string[]) {
  const { findContact } = await import("@/showly/contactGuard");
  return texts.every((t) => !t || findContact(t).length === 0);
}

async function ctxOrError() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
export type ProviderKind = "baker" | "deco";

/** Nur die bekannten Felder, gekürzt. Kontaktangaben werden nicht gespeichert. */
function cleanProviderData(kind: ProviderKind, d: Record<string, unknown>) {
  /* Steuerhinweis bestätigt (AGB § 18 Abs. 5); bei Deko zusätzlich privat
     oder gewerblich, Bäcker geben das über "kind" an */
  const taxAckAt = s(d["taxAckAt"], 40);
  if (kind === "deco")
    return { vendor: s(d["vendor"], 80), city: s(d["city"], 60), business: d["business"] === true, taxAckAt };
  const cats = ["wedding", "birthday", "motif", "cupcakes", "macarons", "candybar", "cakepops", "donuts", "cookies", "vegan", "other"];
  return {
    kind: d["kind"] === "private" ? "private" : "business",
    name: s(d["name"], 80),
    city: s(d["city"], 60),
    tagline: s(d["tagline"], 120),
    about: s(d["about"], 1500),
    specialties: Array.isArray(d["specialties"])
      ? (d["specialties"] as unknown[]).map((x) => String(x)).filter((x) => cats.includes(x) || /^[a-z]{2,20}$/.test(x)).slice(0, 10)
      : [],
    leadDays: n(d["leadDays"], 1, 120, 7),
    radiusKm: n(d["radiusKm"], 0, 800, 20),
    diets: Array.isArray(d["diets"]) ? (d["diets"] as unknown[]).map((x) => s(x, 30)).filter(Boolean).slice(0, 8) : [],
    coverImg: n(d["coverImg"], 1, 14, 1),
    foodRegistered: d["foodRegistered"] === true,
    since: n(d["since"], 2000, 2100, new Date().getFullYear()),
    taxAckAt,
  };
}

export const saveProvider = createServerFn({ method: "POST" })
  .inputValidator((d: { kind: ProviderKind; data: Record<string, unknown> }) => {
    if (d.kind !== "baker" && d.kind !== "deco") throw new Error("Ungültige Art");
    if (!d.data || typeof d.data !== "object") throw new Error("Angaben fehlen");
    return { kind: d.kind, data: cleanProviderData(d.kind, d.data) };
  })
  .handler(async ({ data }): Promise<{ id: number } | { error: string }> => {
    const ctx = await ctxOrError();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("offer", ctx.user.id))) return { error: TOO_MANY };
    const d = data.data as Record<string, unknown>;
    if (data.kind === "baker") {
      if (!d["name"] || !d["city"]) return { error: "Name und Ort fehlen" };
      /* AGB § 17 Abs. 4: Lebensmittelbetrieb registriert */
      if (!d["foodRegistered"]) return { error: "Bitte bestätige die Registrierung beim Lebensmittelamt" };
    } else if (!d["vendor"]) return { error: "Name fehlt" };
    if (!(await noContact(String(d["tagline"] || ""), String(d["about"] || ""), String(d["name"] || d["vendor"] || ""))))
      return { error: "Bitte keine Kontaktdaten im Profil" };

    const admin = adminClient();
    const now = new Date().toISOString();
    const { data: prev } = await admin
      .from("providers")
      .select("id, data")
      .eq("owner", ctx.user.id)
      .eq("kind", data.kind)
      .maybeSingle();
    /* Bestätigung bleibt beim Bearbeiten erhalten; neu anlegen nur mit */
    if (!d["taxAckAt"]) d["taxAckAt"] = (prev?.data as Record<string, unknown> | undefined)?.["taxAckAt"] || "";
    if (!d["taxAckAt"]) return { error: "Bitte bestätige den Hinweis zu Steuern" };
    if (prev) {
      await admin.from("providers").update({ data: d, updated_at: now }).eq("id", prev.id);
      return { id: prev.id };
    }
    const { data: ins, error } = await admin
      .from("providers")
      .insert({ owner: ctx.user.id, kind: data.kind, data: d })
      .select("id")
      .single();
    if (error || !ins) return { error: "Profil konnte nicht angelegt werden" };
    return { id: ins.id };
  });

/* ------------------------------------------------------------------ */
export interface OfferInput {
  offerId?: number;
  kind: "sweet" | "deco";
  data: Record<string, unknown>;
  priceCents: number;
  rentCents?: number;
  direct?: boolean;
}

export const saveOffer = createServerFn({ method: "POST" })
  .inputValidator((d: OfferInput) => {
    if (d.kind !== "sweet" && d.kind !== "deco") throw new Error("Ungültige Art");
    const x = d.data || {};
    const data =
      d.kind === "sweet"
        ? {
            name: s(x["name"], 100),
            desc: s(x["desc"], 600),
            cat: s(x["cat"], 20) || "cupcakes",
            unit: ["person", "piece", "set"].includes(String(x["unit"])) ? String(x["unit"]) : "piece",
            minQty: n(x["minQty"], 1, 5000, 1),
            img: n(x["img"], 1, 14, 1),
          }
        : {
            name: s(x["name"], 100),
            desc: s(x["desc"], 600),
            cat: s(x["cat"], 30) || "deco",
            occ: Array.isArray(x["occ"]) ? (x["occ"] as unknown[]).map((o) => s(o, 20)).filter(Boolean).slice(0, 6) : [],
          };
    if (!data.name) throw new Error("Name fehlt");
    return {
      offerId: Number.isInteger(d.offerId) ? d.offerId : undefined,
      kind: d.kind,
      data,
      priceCents: n(d.priceCents, 0, 10_000_000, 0),
      rentCents: n(d.rentCents ?? 0, 0, 10_000_000, 0),
      direct: !!d.direct,
    };
  })
  .handler(async ({ data }): Promise<{ id: number } | { error: string }> => {
    const ctx = await ctxOrError();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("offer", ctx.user.id))) return { error: TOO_MANY };
    if (!(await noContact(String(data.data.name), String(data.data.desc))))
      return { error: "Bitte keine Kontaktdaten im Angebot" };
    if (data.priceCents <= 0 && data.rentCents <= 0) return { error: "Preis fehlt" };
    const admin = adminClient();
    const { data: prov } = await admin
      .from("providers")
      .select("id")
      .eq("owner", ctx.user.id)
      .eq("kind", data.kind === "sweet" ? "baker" : "deco")
      .maybeSingle();
    if (!prov) return { error: "Erst ein Anbieterprofil anlegen" };
    const row = {
      provider_id: prov.id,
      kind: data.kind,
      data: data.data,
      price_cents: data.priceCents,
      rent_cents: data.rentCents,
      direct: data.kind === "sweet" ? data.direct : false,
      updated_at: new Date().toISOString(),
    };
    if (data.offerId) {
      const { data: upd } = await admin
        .from("provider_offers")
        .update(row)
        .eq("id", data.offerId)
        .eq("provider_id", prov.id)
        .select("id")
        .maybeSingle();
      if (!upd) return { error: "Angebot nicht gefunden" };
      return { id: upd.id };
    }
    const { data: ins, error } = await admin.from("provider_offers").insert(row).select("id").single();
    if (error || !ins) return { error: "Angebot konnte nicht gespeichert werden" };
    return { id: ins.id };
  });

export const removeOffer = createServerFn({ method: "POST" })
  .inputValidator((d: { offerId: number }) => {
    if (!Number.isInteger(d.offerId)) throw new Error("Ungültiges Angebot");
    return d;
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await ctxOrError();
    if (!ctx) return { error: "Bitte melde dich an" };
    const admin = adminClient();
    const { data: own } = await admin.from("providers").select("id").eq("owner", ctx.user.id);
    const ids = (own || []).map((p) => p.id);
    if (!ids.length) return { error: "Keine Berechtigung" };
    await admin.from("provider_offers").delete().eq("id", data.offerId).in("provider_id", ids);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/** Anfragen und Bestellungen, die bei diesem Anbieter eingegangen sind */
export const providerInbox = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await ctxOrError();
  if (!ctx) return { sweets: [], orders: [] };
  const [sw, or] = await Promise.all([
    ctx.sb.from("sweet_requests").select("*").eq("baker_owner", ctx.user.id).order("created_at", { ascending: false }).limit(200),
    ctx.sb.from("shop_orders").select("*").contains("provider_owners", [ctx.user.id]).order("created_at", { ascending: false }).limit(200),
  ]);
  return { sweets: sw.data || [], orders: or.data || [] };
});

/** Anbieter beantwortet eine Torten-Anfrage: annehmen (mit Endpreis) oder ablehnen */
export const respondSweet = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: number; accept: boolean; priceCents?: number }) => {
    if (!Number.isInteger(d.requestId)) throw new Error("Ungültige Anfrage");
    return { requestId: d.requestId, accept: !!d.accept, priceCents: d.priceCents ? n(d.priceCents, 100, 10_000_000, 0) : 0 };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await ctxOrError();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const admin = adminClient();
    const { data: r } = await admin.from("sweet_requests").select("id, baker_owner, status").eq("id", data.requestId).maybeSingle();
    if (!r || r.baker_owner !== ctx.user.id) return { error: "Keine Berechtigung" };
    if (r.status !== "sent") return { error: "Anfrage ist nicht mehr offen" };
    await admin
      .from("sweet_requests")
      .update(data.accept ? { status: "confirmed", ...(data.priceCents ? { price_cents: data.priceCents } : {}) } : { status: "declined" })
      .eq("id", r.id);
    return { ok: true };
  });
