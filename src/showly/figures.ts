import { FIGURES, PROVIDER_EXTRA, ARTISTS, type Artist, type Lang } from "./data";

export function figureList(cat: string) {
  return FIGURES[cat] || [];
}

export function figName(cat: string, v: string, lang: Lang) {
  const f = figureList(cat).find((x) => x.id === v);
  return f ? (lang === "de" ? f.de : ((f as { es?: string }).es && lang === "es" ? (f as { es?: string }).es! : f.en)) : v;
}

export function realName(a: Artist): string {
  const extra = PROVIDER_EXTRA[String(a.id)];
  return (a as { real?: string }).real || extra?.real || "";
}

export function figuresOf(a: Artist): string[] {
  const extra = PROVIDER_EXTRA[String(a.id)];
  return (a as { figures?: string[] }).figures || extra?.figures || [];
}

export function providerOf(id: number): Artist | undefined {
  return ARTISTS.find((a) => a.id === id);
}

export function pwScore(pw: string) {
  const s = String(pw || "");
  if (s.length < 8)
    return {
      score: 0,
      de: "Zu kurz – mindestens 8 Zeichen",
      en: "Too short – at least 8 characters",
      es: "Demasiado corta: mínimo 8 caracteres",
    };
  let pts = 0;
  if (s.length >= 12) pts++;
  if (s.length >= 16) pts++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) pts++;
  if (/\d/.test(s)) pts++;
  if (/[^A-Za-z0-9]/.test(s)) pts++;
  if (/^(.)\1+$/.test(s) || /^(012|123|234|345|456|567|678|789|abc|qwe|pass|passwort|password)/i.test(s)) pts = 0;
  const i = Math.min(4, pts);
  return {
    score: i,
    de: ["Sehr schwach", "Schwach", "Mittel", "Stark", "Sehr stark"][i]!,
    en: ["Very weak", "Weak", "Medium", "Strong", "Very strong"][i]!,
    es: ["Muy débil", "Débil", "Media", "Fuerte", "Muy fuerte"][i]!,
  };
}

export function defaultPackages() {
  return [
    {
      id: "p1",
      icon: "clipboard",
      popular: false,
      price: 890,
      name: { de: "Basis-Paket", en: "Basic package" },
      dur: { de: "Beratung + Konzept", en: "consulting + concept" },
      inc: {
        de: ["Erstberatung", "Konzept schriftlich", "Dienstleister-Vorschläge"],
        en: ["Initial consulting", "Written concept", "Supplier suggestions"],
      },
    },
    {
      id: "p2",
      icon: "star",
      popular: true,
      price: 1890,
      name: { de: "Rundum-Paket", en: "All-round package" },
      dur: { de: "Planung + Eventtag", en: "planning + event day" },
      inc: {
        de: ["Alles aus Basis", "Komplette Organisation", "Ablaufregie am Eventtag"],
        en: ["Everything from Basic", "Complete organisation", "On-site direction"],
      },
    },
    {
      id: "p3",
      icon: "trophy",
      popular: false,
      price: 3200,
      name: { de: "Premium Full-Service", en: "Premium full service" },
      dur: { de: "Full Service · 12 Monate", en: "full service · 12 months" },
      inc: {
        de: ["Alles aus Rundum", "Projektleitung", "Team vor Ort", "Notfall-Hotline"],
        en: ["Everything from All-round", "Project lead", "On-site team", "Emergency hotline"],
      },
    },
  ];
}
