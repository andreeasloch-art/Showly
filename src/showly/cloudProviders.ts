/* Torten- und Deko-Anbieter aus der Datenbank in den Katalog holen, und
 * Änderungen eigener Anbieterprofile an den Server schicken.
 *
 * Freigeschaltete Anbieter und ihre Angebote liest jeder über die
 * öffentlichen Sichten. Das eigene Profil sieht und bearbeitet der Anbieter
 * auch vor der Freischaltung. Kennungen ab 100000 kommen aus der Datenbank;
 * sie überschneiden sich nicht mit den Beispielen im Katalog.
 *
 * Fotos liegen bisher nur im Browser (IndexedDB) und gehen deshalb nicht mit
 * in die Datenbank; Angebote aus der Datenbank zeigen das gewählte
 * Standardbild. */
import { SHOP_ITEMS, type ShopItem } from "./data";
import { BAKERS, SWEETS, setCloudOwnBakers, type Baker, type Sweet } from "./sweets";
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { removeOffer, saveOffer, saveProvider } from "@/utils/provider.functions";

export const DB_FROM = 100000;
export const isCloudId = (id: number) => id >= DB_FROM;

type Row = { id: number; kind: string; data: Record<string, unknown> };
type OfferRow = {
  id: number;
  provider_id: number;
  kind: string;
  data: Record<string, unknown>;
  price_cents: number;
  rent_cents: number;
  direct: boolean;
};

const L = (v: unknown) => {
  const t = String(v || "");
  return { de: t, en: t };
};

function bakerFromRow(r: Row, own: boolean, published: boolean): Baker {
  const d = r.data;
  return {
    id: r.id,
    kind: d["kind"] === "private" ? "private" : "business",
    name: L(d["name"]),
    city: String(d["city"] || ""),
    rating: 0,
    reviews: 0,
    since: Number(d["since"]) || new Date().getFullYear(),
    tagline: L(d["tagline"]),
    about: L(d["about"]),
    specialties: (Array.isArray(d["specialties"]) ? d["specialties"] : []) as Baker["specialties"],
    leadDays: Number(d["leadDays"]) || 7,
    radiusKm: Number(d["radiusKm"]) || 0,
    verified: published,
    coverImg: Number(d["coverImg"]) || 1,
    diets: (Array.isArray(d["diets"]) ? d["diets"] : []) as string[],
    foodRegistered: d["foodRegistered"] === true,
    ...(own ? { own: true } : {}),
  };
}

function sweetFromOffer(o: OfferRow): Sweet {
  const d = o.data;
  return {
    id: o.id,
    bakerId: o.provider_id,
    cat: String(d["cat"] || "cupcakes") as Sweet["cat"],
    name: L(d["name"]),
    desc: L(d["desc"]),
    price: o.price_cents / 100,
    unit: (["person", "piece", "set"].includes(String(d["unit"])) ? d["unit"] : "piece") as Sweet["unit"],
    minQty: Number(d["minQty"]) || 1,
    img: Number(d["img"]) || 1,
    direct: o.direct,
  };
}

function itemFromOffer(o: OfferRow, vendor: string): ShopItem {
  const d = o.data;
  return {
    id: o.id,
    section: "deko",
    cat: String(d["cat"] || "deco"),
    occ: (Array.isArray(d["occ"]) ? d["occ"] : []) as string[],
    vendor,
    rent: o.rent_cents / 100,
    buy: o.price_cents / 100,
    rating: 0,
    reviews: 0,
    name: L(d["name"]),
    desc: L(d["desc"]),
  };
}

function upsert<T extends { id: number }>(list: T[], x: T) {
  const i = list.findIndex((y) => y.id === x.id);
  if (i >= 0) list[i] = x;
  else list.push(x);
}

let publicLoaded = false;

/** Freigeschaltete Anbieter laden (einmal) und das eigene Profil, falls
 *  angemeldet. Gibt die eigenen Profile zurück. */
export async function hydrateDbProviders(ownerId?: string): Promise<{ baker?: number; deco?: number }> {
  if (!isBackendConfigured()) return {};
  const sb = supabase();
  if (!publicLoaded) {
    publicLoaded = true;
    const [provs, offers] = await Promise.all([
      sb.from("providers_public").select("id, kind, data").limit(1000),
      sb.from("provider_offers_public").select("*").limit(3000),
    ]);
    const vendors = new Map<number, string>();
    for (const p of provs.data || []) {
      if (p.kind === "baker") upsert(BAKERS, bakerFromRow(p, false, true));
      else vendors.set(p.id, String((p.data as Record<string, unknown>)["vendor"] || ""));
    }
    for (const o of (offers.data || []) as OfferRow[]) {
      if (o.kind === "sweet") upsert(SWEETS, sweetFromOffer(o));
      else upsert(SHOP_ITEMS, itemFromOffer(o, vendors.get(o.provider_id) || ""));
    }
  }
  const mine: { baker?: number; deco?: number } = {};
  if (ownerId) {
    const { data: provs } = await sb.from("providers").select("id, kind, data, published").eq("owner", ownerId);
    const ids = (provs || []).map((p) => p.id);
    for (const p of provs || []) {
      if (p.kind === "baker") {
        upsert(BAKERS, bakerFromRow(p, true, p.published));
        mine.baker = p.id;
      } else mine.deco = p.id;
    }
    setCloudOwnBakers(mine.baker ? [mine.baker] : []);
    if (ids.length) {
      const { data: offers } = await sb.from("provider_offers").select("*").in("provider_id", ids);
      const vendor = String(((provs || []).find((p) => p.kind === "deco")?.data as Record<string, unknown> | undefined)?.["vendor"] || "");
      for (const o of (offers || []) as OfferRow[]) {
        if (o.kind === "sweet") upsert(SWEETS, { ...sweetFromOffer(o), own: true });
        else upsert(SHOP_ITEMS, { ...itemFromOffer(o, vendor), own: true });
      }
    }
  }
  return mine;
}

/* ---------------- eigene Profile und Angebote ändern ---------------- */

type Result<T> = T | { error: string };

export async function saveBakerCloud(b: Partial<Baker>): Promise<Result<{ id: number }>> {
  return saveProvider({
    data: {
      kind: "baker",
      data: {
        kind: b.kind,
        name: typeof b.name === "string" ? b.name : (b.name as { de?: string } | undefined)?.de,
        city: b.city,
        tagline: typeof b.tagline === "string" ? b.tagline : (b.tagline as { de?: string } | undefined)?.de,
        about: typeof b.about === "string" ? b.about : (b.about as { de?: string } | undefined)?.de,
        specialties: b.specialties,
        leadDays: b.leadDays,
        radiusKm: b.radiusKm,
        diets: b.diets,
        coverImg: b.coverImg,
        foodRegistered: b.foodRegistered,
        since: b.since,
        taxAckAt: b.taxAckAt,
      },
    },
  });
}

const txt = (v: unknown) => (typeof v === "string" ? v : String((v as { de?: string } | undefined)?.de ?? ""));

export async function saveSweetCloud(s: Omit<Sweet, "id" | "own" | "bakerId"> & { id?: number | undefined }) {
  return saveOffer({
    data: {
      ...(s.id && isCloudId(s.id) ? { offerId: s.id } : {}),
      kind: "sweet",
      data: { name: txt(s.name), desc: txt(s.desc), cat: s.cat, unit: s.unit, minQty: s.minQty, img: s.img ?? 1 },
      priceCents: Math.round(s.price * 100),
      direct: !!s.direct,
    },
  });
}

export async function removeSweetCloud(id: number) {
  const r = await removeOffer({ data: { offerId: id } });
  if ("ok" in r) {
    const i = SWEETS.findIndex((x) => x.id === id);
    if (i >= 0) SWEETS.splice(i, 1);
  }
  return r;
}

export async function saveDecoCloud(d: {
  vendor: string;
  business: boolean;
  cat: string;
  occ: string[];
  name: string;
  desc: string;
  buy: number;
  rent: number;
}): Promise<Result<{ id: number }>> {
  const p = await saveProvider({
    data: { kind: "deco", data: { vendor: d.vendor, business: d.business, taxAckAt: new Date().toISOString() } },
  });
  if ("error" in p) return p;
  return saveOffer({
    data: {
      kind: "deco",
      data: { name: d.name, desc: d.desc, cat: d.cat, occ: d.occ },
      priceCents: Math.round(d.buy * 100),
      rentCents: Math.round(d.rent * 100),
    },
  });
}
