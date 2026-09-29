/* Cookie- und Einwilligungsbanner.
 *
 * Erste Ebene: "Alle ablehnen", "Einstellungen" und "Alle akzeptieren" in
 * gleicher Größe und gleichem Gewicht. Solange niemand zustimmt, lädt die App
 * nichts von fremden Servern (siehe showly/consent.ts). Impressum und
 * Datenschutz bleiben erreichbar, das Banner verdeckt die Seite nicht. */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { getConsent, hasDecided, saveConsent, subscribeOpen } from "@/showly/consent";

const COPY = {
  de: {
    h: "Datenschutz-Einstellungen",
    p: "Wir speichern im Browser nur, was für Anmeldung, Warenkorb und Sprache nötig ist. Zwei Funktionen sind freiwillig: die Adresssuche über einen externen Dienst und das Merken deiner zuletzt gesuchten Städte. Du kannst deine Wahl jederzeit unten auf der Seite unter „Cookie-Einstellungen“ ändern.",
    reject: "Alle ablehnen",
    settings: "Einstellungen",
    accept: "Alle akzeptieren",
    save: "Auswahl speichern",
    nec: "Notwendig",
    necP: "Anmeldung, Warenkorb, Sprache, Zahlungsabwicklung und diese Einstellung. Immer aktiv.",
    places: "Adress- und Ortssuche",
    placesP: "Vorschläge beim Tippen einer Adresse und das Erkennen deiner Stadt über Photon (Komoot GmbH, Potsdam). Dabei gehen dein Suchtext bzw. Standort und deine IP-Adresse an Komoot. Ohne Zustimmung nutzt die App nur die eingebaute Städteliste.",
    comfort: "Komfort",
    comfortP: "Merkt sich deine zuletzt gewählte Stadt und welche Top-Acts du angeklickt hast, nur in diesem Browser. Nichts davon wird übertragen.",
    always: "Immer aktiv",
    privacy: "Datenschutz",
    imprint: "Impressum",
  },
  en: {
    h: "Privacy settings",
    p: "We only store what sign-in, cart and language need in your browser. Two features are optional: address search via an external service and remembering the cities you searched for. You can change your choice any time under “Cookie settings” at the bottom of the page.",
    reject: "Reject all",
    settings: "Settings",
    accept: "Accept all",
    save: "Save selection",
    nec: "Necessary",
    necP: "Sign-in, cart, language, payment and this setting. Always active.",
    places: "Address and place search",
    placesP: "Suggestions while typing an address and detecting your city via Photon (Komoot GmbH, Potsdam, Germany). Your search text or location and your IP address are sent to Komoot. Without consent the app only uses its built-in city list.",
    comfort: "Comfort",
    comfortP: "Remembers your last chosen city and which top acts you clicked, only in this browser. Nothing is transmitted.",
    always: "Always active",
    privacy: "Privacy",
    imprint: "Legal notice",
  },
  es: {
    h: "Ajustes de privacidad",
    p: "Solo guardamos en el navegador lo necesario para el inicio de sesión, el carrito y el idioma. Dos funciones son opcionales: la búsqueda de direcciones mediante un servicio externo y recordar las ciudades que buscaste. Puedes cambiar tu elección en cualquier momento en «Ajustes de cookies», al pie de la página.",
    reject: "Rechazar todo",
    settings: "Ajustes",
    accept: "Aceptar todo",
    save: "Guardar selección",
    nec: "Necesarias",
    necP: "Inicio de sesión, carrito, idioma, pago y este ajuste. Siempre activas.",
    places: "Búsqueda de direcciones y lugares",
    placesP: "Sugerencias al escribir una dirección y detección de tu ciudad mediante Photon (Komoot GmbH, Potsdam, Alemania). Tu texto de búsqueda o ubicación y tu dirección IP se envían a Komoot. Sin consentimiento, la app solo usa su lista de ciudades.",
    comfort: "Comodidad",
    comfortP: "Recuerda tu última ciudad elegida y qué top acts pulsaste, solo en este navegador. No se transmite nada.",
    always: "Siempre activas",
    privacy: "Privacidad",
    imprint: "Aviso legal",
  },
} as const;

export function ConsentBanner() {
  const { lang } = useShowly();
  const C = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [places, setPlaces] = useState(false);
  const [comfort, setComfort] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!hasDecided()) setOpen(true);
    return subscribeOpen(() => {
      const c = getConsent();
      setPlaces(!!c?.places);
      setComfort(!!c?.comfort);
      setDetail(true);
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (open) first.current?.focus();
  }, [open, detail]);

  if (!open) return null;

  const decide = (p: boolean, c: boolean) => {
    saveConsent({ places: p, comfort: c });
    setOpen(false);
    setDetail(false);
  };

  return (
    <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-h" aria-describedby="consent-p">
      <h2 id="consent-h">{C.h}</h2>
      <p id="consent-p">{C.p}</p>

      {detail && (
        <fieldset className="consent-cats">
          <legend className="sr-only">{C.settings}</legend>
          <label className="consent-cat">
            <input type="checkbox" checked disabled />
            <span>
              <b>
                {C.nec} <small>({C.always})</small>
              </b>
              <small>{C.necP}</small>
            </span>
          </label>
          <label className="consent-cat">
            <input type="checkbox" checked={places} onChange={(e) => setPlaces(e.target.checked)} />
            <span>
              <b>{C.places}</b>
              <small>{C.placesP}</small>
            </span>
          </label>
          <label className="consent-cat">
            <input type="checkbox" checked={comfort} onChange={(e) => setComfort(e.target.checked)} />
            <span>
              <b>{C.comfort}</b>
              <small>{C.comfortP}</small>
            </span>
          </label>
        </fieldset>
      )}

      <div className="consent-btns">
        <button ref={first} type="button" className="consent-btn" onClick={() => decide(false, false)}>
          {C.reject}
        </button>
        {detail ? (
          <button type="button" className="consent-btn" onClick={() => decide(places, comfort)}>
            {C.save}
          </button>
        ) : (
          <button type="button" className="consent-btn" onClick={() => setDetail(true)}>
            {C.settings}
          </button>
        )}
        <button type="button" className="consent-btn" onClick={() => decide(true, true)}>
          {C.accept}
        </button>
      </div>
      <p className="consent-links">
        <Link to="/rechtliches/$doc" params={{ doc: "privacy" }}>
          {C.privacy}
        </Link>
        {" · "}
        <Link to="/rechtliches/$doc" params={{ doc: "imprint" }}>
          {C.imprint}
        </Link>
      </p>
    </div>
  );
}
