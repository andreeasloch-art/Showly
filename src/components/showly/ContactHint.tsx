/* Hinweis unter Textfeldern, sobald Kontaktdaten erkannt werden, und die
 * Prüfung vor dem Absenden. Regeln stehen in showly/contactGuard.ts. */
import { useMemo } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { contactMessage } from "@/showly/contactGuard";

export function ContactHint({ text }: { text: string }) {
  const { lang } = useShowly();
  const msg = useMemo(() => contactMessage(text, lang), [text, lang]);
  if (!msg) return null;
  return (
    <p className="contact-hint" role="alert">
      <Icon name="shield" />
      <span>{msg}</span>
    </p>
  );
}

/** Vor dem Absenden: false und Hinweis, wenn in einem der Texte Kontaktdaten stehen */
export function useContactCheck() {
  const { lang, toast } = useShowly();
  return (...texts: (string | undefined | null)[]) => {
    for (const t of texts) {
      const msg = t ? contactMessage(t, lang) : null;
      if (msg) {
        toast(msg);
        return false;
      }
    }
    return true;
  };
}
