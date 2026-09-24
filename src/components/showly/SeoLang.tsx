/* Hält Titel/Beschreibung/og-Tags und <html lang> synchron zur aktiven Sprache. */
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { OG_LOCALE, SITE, seoText } from "@/showly/seo";

function keyForPath(pathname: string): string {
  if (pathname.startsWith("/kuenstler/")) return "/kuenstler/$id";
  if (pathname.startsWith("/rechtliches/")) return "/rechtliches/$doc";
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean;
}

function setMeta(selector: string, attr: string, name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function SeoLang() {
  const { lang } = useShowly();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const t = seoText(keyForPath(pathname), lang);
    document.documentElement.lang = lang;
    setMeta(
      'meta[property="og:locale"]',
      "property",
      "og:locale",
      OG_LOCALE[lang],
    );
    setMeta('meta[name="language"]', "name", "language", lang);
    if (!t) return;
    document.title = t.title;
    setMeta('meta[name="description"]', "name", "description", t.description);
    setMeta('meta[property="og:title"]', "property", "og:title", t.title);
    setMeta('meta[property="og:description"]', "property", "og:description", t.description);
    setMeta('meta[property="og:url"]', "property", "og:url", `${SITE}${pathname}`);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", t.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", t.description);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
  }, [lang, pathname]);

  return null;
}
