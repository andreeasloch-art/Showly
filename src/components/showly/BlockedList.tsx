/* Blockierte Personen im Konto, mit "Aufheben". */
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { unblockAuthor } from "@/showly/moderation";
import { useModeration } from "@/components/showly/ReportMenu";

const COPY = {
  de: { h: "Blockierte Personen", p: "Von diesen Personen siehst du keine Beiträge, Kommentare und Bewertungen.", undo: "Aufheben", none: "Du hast niemanden blockiert." },
  en: { h: "Blocked people", p: "You don't see posts, comments or reviews from these people.", undo: "Unblock", none: "You haven't blocked anyone." },
  es: { h: "Personas bloqueadas", p: "No ves publicaciones, comentarios ni reseñas de estas personas.", undo: "Desbloquear", none: "No has bloqueado a nadie." },
} as const;

export function BlockedList() {
  const { lang } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const { blocked } = useModeration();
  return (
    <section className="blk">
      <h3>{C.h}</h3>
      <p>{blocked.length ? C.p : C.none}</p>
      {blocked.length > 0 && (
        <ul>
          {blocked.map((n) => (
            <li key={n}>
              <span>
                <Icon name="user" /> {n}
              </span>
              <button type="button" onClick={() => unblockAuthor(n)}>
                {C.undo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
