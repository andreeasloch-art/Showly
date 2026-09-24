/* Hinweis für Kunden: Ist der Künstler sofort buchbar oder muss er erst
 * zusagen? Steht auf der Profilseite, im Buchungsfenster und in der Kasse. */
import type { Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { isInstant } from "@/showly/booking";

const COPY = {
  de: {
    instant: "Sofort bestätigt",
    instantP: "Freie Termine sind direkt verbindlich gebucht.",
    request: "Bestätigung innerhalb von 48 Std.",
    requestP: (n: string) => `${n} sagt zu oder ab. Bezahlt wird erst bei Zusage.`,
  },
  en: {
    instant: "Instantly confirmed",
    instantP: "Free slots are booked right away.",
    request: "Confirmation within 48 hrs",
    requestP: (n: string) => `${n} accepts or declines. You only pay once they accept.`,
  },
  es: {
    instant: "Confirmación inmediata",
    instantP: "Los huecos libres se reservan al momento.",
    request: "Confirmación en 48 h",
    requestP: (n: string) => `${n} acepta o rechaza. Solo pagas si acepta.`,
  },
} as const;

export function BookingModeNote({ artist, compact }: { artist: Artist; compact?: boolean }) {
  const { lang, L, hydrated } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  /* Die Einstellung kann im Browser gespeichert sein, die der Server beim
     ersten Zeichnen nicht kennt. Erst danach anzeigen, sonst passt die
     Server-Fassung nicht zur Browser-Fassung. */
  if (!hydrated) return null;
  const instant = isInstant(artist);
  return (
    <div className={"bm-note" + (instant ? " instant" : " request") + (compact ? " compact" : "")}>
      <Icon name={instant ? "check" : "clock"} />
      <span>
        <b>{instant ? C.instant : C.request}</b>
        {!compact && <small>{instant ? C.instantP : C.requestP(String(L(artist.name)))}</small>}
      </span>
    </div>
  );
}
