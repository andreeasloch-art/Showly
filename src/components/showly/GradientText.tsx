import { useShowly } from "@/showly/store";

/* Hervorgehobenes Wort in der Überschrift.
 *
 * Erste Wahl ist das gezeichnete Wort aus der Bildwerkstatt: dieselbe
 * Handschrift wie die Wortmarke, mit den Überlagerungen und dem Farbverlauf
 * des Logos. Es liegt freigestellt in public (siehe scripts/brand/word.mjs).
 *
 * Das Wort selbst steht trotzdem als Text in der Überschrift, nur unsichtbar:
 * So liest jede Suchmaschine die Überschrift vollständig, auch eine, die
 * Textalternativen von Bildern übergeht. Das Bild ist dafür von Vorlesehilfen
 * ausgenommen, sonst käme das Wort zweimal.
 *
 * Für Sprachen, zu denen es noch kein Bild gibt, bleibt die gesetzte Fassung:
 * Fredoka, die runde Schrift der Wortmarke, mit dem aus dem Logo gemessenen
 * Farbfeld an den Buchstaben ausgeschnitten. Sobald ein Wort gezeichnet
 * vorliegt, kommt es unten in ART dazu und gilt sofort.
 *
 * Das Seitenverhältnis steht hier, damit die Zeile schon vor dem Laden des
 * Bildes ihre endgültige Höhe hat und nichts nachspringt.
 *
 * em und top sind je Sprache eigens gesetzt, nicht aus Geschmack, sondern
 * gemessen: Jedes Wort ist unterschiedlich hoch gezeichnet, weil oben mal
 * Umlautpunkte stehen und mal nichts. Bei gleicher Bildhöhe erschiene das
 * eine Wort größer als das andere. Die Werte gleichen x-Höhe und Versalhöhe
 * über die drei Sprachen an (auf gut zweieinhalb Prozent genau), top hält
 * dabei den Abstand zur Zeile darüber gleich. */
const ART: Record<string, { src: string; ratio: number; em: number; top: number }> = {
  de: { src: "/wort-kuenstler.webp", ratio: 4.126, em: 0.9, top: 0.06 },
  en: { src: "/wort-artist.webp", ratio: 3.434, em: 0.83, top: 0.11 },
  es: { src: "/wort-artista.webp", ratio: 3.847, em: 0.86, top: 0.09 },
};

export function GradientText({ text, className = "" }: { text: string; className?: string }) {
  const { lang } = useShowly();
  const art = ART[lang];

  if (art)
    return (
      <>
        <img
          className={"grad-art " + className}
          src={art.src}
          alt=""
          aria-hidden="true"
          style={{
            aspectRatio: String(art.ratio),
            height: art.em + "em",
            marginTop: art.top + "em",
          }}
          decoding="async"
        />
        {/* Das Leerzeichen trennt die beiden Zeilen, sonst liest eine
            Vorlesehilfe "deinenKünstler" in einem Wort. */}
        <span className="sr-only">{" " + text}</span>
      </>
    );

  return <span className={"grad grad-paint " + className}>{text}</span>;
}
