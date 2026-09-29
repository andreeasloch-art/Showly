/* Kennzeichnung der Beispielprofile und -artikel aus dem Katalog.
 *
 * Hinter ihnen steht kein echter Anbieter. Sie zeigen nur, wie ein Profil
 * aussieht, haben keine Bewertungen und lassen sich mit echter Zahlung
 * nicht buchen (der Server lehnt sie ab, siehe pricing.ts priceLines). */
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { isBackendConfigured } from "@/lib/supabase";

const COPY = {
  de: {
    badge: "Beispiel",
    title: "Beispielprofil, kein echter Anbieter",
    h: "Beispielprofil",
    p: "Dieses Profil zeigt, wie ein Angebot auf Showly aussieht. Dahinter steht kein echter Anbieter, und es hat keine echten Bewertungen.",
    live: "Es kann nicht gebucht oder gekauft werden.",
    practice: "In dieser Vorschau kannst du den Ablauf ausprobieren; es wird nichts bezahlt.",
  },
  en: {
    badge: "Example",
    title: "Example profile, not a real provider",
    h: "Example profile",
    p: "This profile shows what an offer on Showly looks like. There is no real provider behind it and it has no real reviews.",
    live: "It cannot be booked or bought.",
    practice: "In this preview you can try the process; nothing is charged.",
  },
  es: {
    badge: "Ejemplo",
    title: "Perfil de ejemplo, no es un proveedor real",
    h: "Perfil de ejemplo",
    p: "Este perfil muestra cómo se ve una oferta en Showly. No hay un proveedor real detrás y no tiene opiniones reales.",
    live: "No se puede reservar ni comprar.",
    practice: "En esta vista previa puedes probar el proceso; no se cobra nada.",
  },
} as const;

function useCopy() {
  const { lang } = useShowly();
  return COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
}

/** Mit echter Datenbank sind Beispiele nicht buchbar */
export const demoBookable = () => !isBackendConfigured();

export function DemoBadge({ className = "" }: { className?: string }) {
  const C = useCopy();
  return (
    <span className={"demo-badge " + className} title={C.title}>
      {C.badge}
      <span className="sr-only">: {C.title}</span>
    </span>
  );
}

export function DemoNote() {
  const C = useCopy();
  return (
    <div className="demo-note" role="note">
      <Icon name="eye" />
      <div>
        <b>{C.h}</b>
        <p>
          {C.p} {demoBookable() ? C.practice : C.live}
        </p>
      </div>
    </div>
  );
}
