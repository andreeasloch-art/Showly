/* Sprechende Adressen für Profile und Stadtseiten (rein, getestet in
 * slugs.test.ts).
 *
 *   /kuenstler/berlin/zauberer/max-mustermann-100023
 *
 * Die Zahl am Ende ist die Kennung des Profils. Sie bleibt gleich, auch wenn
 * jemand umzieht, die Kategorie wechselt oder sich umbenennt; dann leitet
 * die alte Adresse mit 301 auf die neue weiter. Zwei gleichnamige Zauberer in
 * Berlin bekommen so trotzdem verschiedene Adressen. */

/** Kategorie → deutsches Wort in der Adresse (so, wie Leute suchen) */
export const CAT_SLUG: Record<string, string> = {
  fairy: "maerchenfiguren",
  magician: "zauberer",
  mentalist: "mentalist",
  hypnotist: "hypnotiseur",
  santa: "weihnachtsmann",
  dj: "dj",
  musician: "musiker",
  band: "band",
  dancer: "taenzer",
  clown: "clown",
  facepaint: "kinderschminken",
  acrobat: "akrobat",
  comedy: "comedian",
  walkingact: "walking-act",
  pantomime: "pantomime",
  street: "strassenkuenstler",
  host: "moderator",
  photographer: "fotograf",
  superhero: "superheld",
  eventplanner: "eventplaner",
  weddingplanner: "hochzeitsplaner",
};

export const SLUG_CAT: Record<string, string> = Object.fromEntries(Object.entries(CAT_SLUG).map(([k, v]) => [v, k]));

/** Für Adressen, mit deutscher Umschrift: München → muenchen, Weiß → weiss */
export function slugify(v: string): string {
  return String(v || "")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Named = { id: number; cat: string; name: unknown; loc?: unknown };
const de = (v: unknown): string => (typeof v === "string" ? v : String(((v || {}) as Record<string, string>)["de"] || ""));

/** Teile der sprechenden Adresse eines Künstlerprofils */
export function artistParams(a: Named): { stadt: string; kategorie: string; name: string } {
  return {
    stadt: slugify(de(a.loc)) || "deutschland",
    kategorie: CAT_SLUG[a.cat] || slugify(a.cat) || "kuenstler",
    name: `${slugify(de(a.name)).slice(0, 60).replace(/-$/, "") || "profil"}-${a.id}`,
  };
}

export function artistPath(a: Named): string {
  const p = artistParams(a);
  return `/kuenstler/${p.stadt}/${p.kategorie}/${p.name}`;
}

/** Kennung aus dem letzten Teil der Adresse ("max-mustermann-100023" → 100023) */
export function idFromSlug(name: string): number {
  const m = /(?:^|-)(\d{1,12})$/.exec(String(name || ""));
  return m ? Number(m[1]) : 0;
}
