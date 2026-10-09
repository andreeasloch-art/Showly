/* Profilaufruf zählen (nur echte Profile aus der Datenbank, einmal pro
 * Sitzung und Profil). Gespeichert wird nur die Zahl pro Tag. */
export function countView(kind: "artist" | "baker" | "deco", ref: number) {
  if (typeof window === "undefined" || !(ref >= 100000)) return;
  const key = `showly.view.${kind}.${ref}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* ohne Speicher trotzdem zählen; der Server begrenzt pro Adresse */
  }
  void import("@/utils/dashboard.functions")
    .then(({ trackView }) => trackView({ data: { kind, ref } }))
    .catch(() => null);
}
