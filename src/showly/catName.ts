/* Name einer Sparte außerhalb von React (z. B. für Seitentitel im head()) */
import { I18N, type Lang } from "./data";
import { ES } from "./i18n.es";

export function catName(cat: string, lang: Lang): string {
  const key = `cat.${cat}`;
  return (lang === "es" ? ES[key] : I18N[lang]?.[key]) || I18N["de"]?.[key] || cat;
}
