/* Einträge aus der Datenbank für die Preisberechnung, nur auf dem Server.
 *
 * Kennungen ab 100000 stehen nicht im mitgelieferten Katalog, sondern in der
 * Datenbank: echte Künstler (artists), Torten und Deko von Anbietern
 * (provider_offers). Nur veröffentlichte und nicht gesperrte Einträge
 * zählen. Das Ergebnis geht als "extra" an pricing.ts, damit Browser und
 * Server weiter mit denselben Rechenregeln arbeiten. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Artist, ShopItem } from "@/showly/data";
import type { Sweet } from "@/showly/sweets";
import type { Extra } from "@/showly/pricing";

export const DB_FROM = 100000;

export interface Catalog {
  extra: Extra;
  /** Besitzer je Anbieter-Angebot (für baker_owner bzw. provider_owners) */
  offerOwner: Map<number, string>;
  /** Anbieter (provider id) je Angebot */
  offerProvider: Map<number, number>;
}

export async function loadCatalog(
  admin: SupabaseClient<Database>,
  ids: { artists?: number[]; sweets?: number[]; items?: number[] },
): Promise<Catalog> {
  const artists = new Map<number, Artist>();
  const sweets = new Map<number, Sweet>();
  const items = new Map<number, ShopItem>();
  const offerOwner = new Map<number, string>();
  const offerProvider = new Map<number, number>();

  const aIds = (ids.artists || []).filter((x) => x >= DB_FROM);
  if (aIds.length) {
    const { data } = await admin
      .from("artists")
      .select("id, name, price_cents, published, blocked, cat")
      .in("id", aIds);
    for (const r of data || []) {
      if (!r.published || r.blocked) continue;
      const name = r.name as { de?: string; en?: string };
      artists.set(r.id, {
        id: r.id,
        cat: r.cat,
        color: "#F1EAFF",
        price: r.price_cents / 100,
        minHours: 1,
        rating: 0,
        reviews: 0,
        name: { de: name.de || "", en: name.en || name.de || "" },
        loc: "",
        desc: "",
      });
    }
  }

  const oIds = [...(ids.sweets || []), ...(ids.items || [])].filter((x) => x >= DB_FROM);
  if (oIds.length) {
    const { data } = await admin
      .from("provider_offers")
      .select("id, kind, data, price_cents, rent_cents, direct, published, provider_id, providers!inner(owner, published, blocked)")
      .in("id", oIds);
    type Row = {
      id: number;
      kind: "sweet" | "deco";
      data: Record<string, unknown>;
      price_cents: number;
      rent_cents: number;
      direct: boolean;
      published: boolean;
      provider_id: number;
      providers: { owner: string; published: boolean; blocked: boolean };
    };
    for (const r of (data || []) as unknown as Row[]) {
      if (!r.published || !r.providers.published || r.providers.blocked) continue;
      offerOwner.set(r.id, r.providers.owner);
      offerProvider.set(r.id, r.provider_id);
      const d = r.data;
      const name = { de: String(d["name"] || ""), en: String(d["name"] || "") };
      if (r.kind === "sweet") {
        sweets.set(r.id, {
          id: r.id,
          bakerId: r.provider_id,
          cat: (String(d["cat"] || "cupcakes") as Sweet["cat"]),
          name,
          desc: { de: String(d["desc"] || ""), en: String(d["desc"] || "") },
          price: r.price_cents / 100,
          unit: (["person", "piece", "set"].includes(String(d["unit"])) ? d["unit"] : "piece") as Sweet["unit"],
          minQty: Math.max(1, Number(d["minQty"]) || 1),
          direct: r.direct,
        });
      } else {
        items.set(r.id, {
          id: r.id,
          cat: String(d["cat"] || "deco"),
          section: "deko",
          rent: r.rent_cents / 100,
          buy: r.price_cents / 100,
          rating: 0,
          reviews: 0,
          name,
          desc: { de: String(d["desc"] || ""), en: String(d["desc"] || "") },
        });
      }
    }
  }

  return {
    extra: {
      artist: (id) => artists.get(id),
      sweet: (id) => sweets.get(id),
      item: (id) => items.get(id),
    },
    offerOwner,
    offerProvider,
  };
}
