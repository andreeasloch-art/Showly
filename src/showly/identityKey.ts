/* Eine Person, ein Profil: Grundlage für den Prüfwert aus der Ausweisprüfung.
 *
 * Aus Vorname, Nachname und Geburtsdatum entsteht eine einheitliche
 * Zeichenkette. Der Server macht daraus einen HMAC (lib/identity.server.ts)
 * und speichert nur diesen. Die Schreibweise wird vereinheitlicht, damit
 * Personalausweis und Reisepass derselben Person denselben Wert ergeben:
 * Akzente und Umlaute fallen weg (ü wird u, ß wird ss), Groß- und
 * Kleinschreibung zählt nicht, Namensteile werden sortiert (manche Ausweise
 * führen den zweiten Vornamen, andere nicht im selben Feld). Das
 * Ausstellungsland gehört bewusst nicht dazu, sonst käme jemand mit zwei
 * Staatsangehörigkeiten mit dem zweiten Pass durch. */

export interface IdentityParts {
  first: string | null | undefined;
  last: string | null | undefined;
  dob:
    | { day?: number | null; month?: number | null; year?: number | null }
    | null
    | undefined;
}

function nameParts(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Einheitliche Zeichenkette oder null, wenn Angaben fehlen */
export function identityKeyInput(p: IdentityParts): string | null {
  const parts = [...nameParts(p.first || ""), ...nameParts(p.last || "")];
  const d = p.dob;
  if (parts.length < 2 || !d?.day || !d.month || !d.year) return null;
  /* Doppelte Namensteile nur einmal, Reihenfolge egal */
  const names = [...new Set(parts)].sort().join(" ");
  const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return `${names}|${date}`;
}
