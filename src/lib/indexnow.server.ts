/* IndexNow: Bing, Yandex, Seznam, Naver und weitere Suchmaschinen sofort
 * über neue, geänderte oder entfernte Seiten benachrichtigen (Bing speist
 * damit auch Copilot). Google nutzt IndexNow nicht; dort genügen Sitemap und
 * Search Console.
 *
 * Einrichtung (docs/seo/BING-WEBMASTER-SETUP.md): einen Schlüssel aus 32
 * Zeichen (a–z, 0–9) erzeugen und in Lovable unter Secrets als INDEXNOW_KEY
 * eintragen. Die App liefert ihn unter /indexnow-key.txt aus (keyLocation).
 * Ohne Schlüssel passiert nichts, solange die Seite noch nicht live ist.
 *
 * Ein Fehler beim Benachrichtigen darf nie eine Freischaltung aufhalten:
 * die Funktion wirft nicht. */
import { LANGS, SITE, langUrl } from "@/showly/seo";

export function indexNowKey(): string | null {
  const k = (process.env["INDEXNOW_KEY"] || "").trim();
  return /^[a-zA-Z0-9-]{8,128}$/.test(k) ? k : null;
}

/** Pfade wie "/kuenstler/100004"; alle Sprachfassungen werden gemeldet */
export async function indexNow(paths: string[]): Promise<boolean> {
  const key = indexNowKey();
  if (!key || !paths.length || !/^https:\/\//.test(SITE)) return false;
  const urlList = [...new Set(paths.flatMap((p) => LANGS.map((l) => langUrl(p, l))))].slice(0, 10000);
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/indexnow-key.txt`, urlList }),
      signal: AbortSignal.timeout(5000),
    });
    /* 200 angenommen, 202 angenommen (Schlüssel wird noch geprüft) */
    return res.status === 200 || res.status === 202;
  } catch {
    return false;
  }
}
