/* Datenschutzhinweis in Formularen.
 *
 * Für Registrierung, Buchung und Kontakt ist die Rechtsgrundlage der Vertrag
 * bzw. die Anfrage selbst (Art. 6 Abs. 1 lit. b DSGVO), nicht eine
 * Einwilligung. Deshalb bestätigt man hier, die Hinweise gelesen zu haben.
 * Echte Einwilligungen (z. B. Veröffentlichung einer Bewertung mit Namen)
 * stehen jeweils als eigenes Häkchen beim Formular. */
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";

const COPY = {
  de: {
    ack: "Ich habe die",
    link: "Datenschutzhinweise",
    ack2: "gelesen. Meine Angaben werden nur zur Bearbeitung dieses Vorgangs verwendet.",
    need: "Bitte bestätige, dass du die Datenschutzhinweise gelesen hast.",
  },
  en: {
    ack: "I have read the",
    link: "privacy notice",
    ack2: ". My details are only used to handle this request.",
    need: "Please confirm that you have read the privacy notice.",
  },
  es: {
    ack: "He leído la",
    link: "información de privacidad",
    ack2: ". Mis datos solo se usan para tramitar esta solicitud.",
    need: "Confirma que has leído la información de privacidad.",
  },
} as const;

export function usePrivacyCopy() {
  const { lang } = useShowly();
  return COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
}

export function PrivacyAck({
  checked,
  onChange,
  id = "privacy-ack",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  const C = usePrivacyCopy();
  return (
    <label className="reg-check privacy-ack" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
      <span>
        {C.ack}{" "}
        <Link to="/rechtliches/$doc" params={{ doc: "privacy" }} target="_blank">
          {C.link}
        </Link>
        {C.ack2.startsWith(".") ? "" : " "}
        {C.ack2}
      </span>
    </label>
  );
}
