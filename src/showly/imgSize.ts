/* Bildgrößen: Die mitgelieferten Bilder liegen in voller Größe (800 px
   breit) und als kleine Fassung (480 px, Ordner s/, etwa halb so groß).
   Karten im Raster, Vorschaubilder und Warenkorb nehmen "s"; große
   Ansichten (Profil, Galerie, Act der Woche) die volle Größe. Eigene Fotos
   der Anbieter bleiben, wie sie sind. */
export type ImgSize = "s" | "l";
export function sizedSrc(src: string, size: ImgSize = "l"): string {
  return size === "s" ? src.replace(/^(\.?\/)(acts|shop|sweets|venues)\/(\d+\.webp)$/, "$1$2/s/$3") : src;
}
