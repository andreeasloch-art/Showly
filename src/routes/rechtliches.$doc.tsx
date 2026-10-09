import { headLang, seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LEGAL_DOCS, LEGAL_DOCS_ES } from "@/showly/legal";
import { useShowly } from "@/showly/store";
import { Footer } from "@/components/showly/Footer";
import { openConsentSettings } from "@/showly/consent";

const TABS: [string, string][] = [
  ["imprint", "legal.imprint"],
  ["privacy", "legal.privacy"],
  ["security", "sec.tab"],
  ["cookies", "legal.cookies"],
  ["terms", "legal.terms"],
  ["withdrawal", "legal.withdrawal"],
  ["accessibility", "legal.accessibility"],
];

const EXTRA: Record<string, Record<string, string>> = {
  withdrawal: { de: "Widerruf", en: "Withdrawal", es: "Desistimiento" },
  accessibility: { de: "Barrierefreiheit", en: "Accessibility", es: "Accesibilidad" },
};

/* Eigener Titel und eigene Beschreibung je Dokument, sonst sehen
   Suchmaschinen sieben Seiten mit demselben Titel. */
const DOC_SEO: Record<string, Record<"de" | "en" | "es", [string, string]>> = {
  imprint: {
    de: ["Impressum | Showly", "Impressum von Showly: Anbieter, Anschrift, Kontakt per E-Mail und Angaben nach § 5 DDG."],
    en: ["Imprint | Showly", "Imprint of Showly: provider, address, contact by email and legal information under German law."],
    es: ["Aviso legal | Showly", "Aviso legal de Showly: responsable, dirección, contacto por correo y datos legales."],
  },
  privacy: {
    de: ["Datenschutzerklärung | Showly", "Welche Daten Showly verarbeitet, wofür, wie lange und welche Rechte du hast. Hosting in der EU."],
    en: ["Privacy policy | Showly", "Which data Showly processes, why, for how long and which rights you have. Hosted in the EU."],
    es: ["Política de privacidad | Showly", "Qué datos trata Showly, para qué, durante cuánto tiempo y qué derechos tienes. Alojamiento en la UE."],
  },
  security: {
    de: ["Sicherheit | Showly", "Wie Showly Zahlungen, Konten, Uploads und Daten schützt: Verschlüsselung, Zwei-Faktor, Virenprüfung."],
    en: ["Security | Showly", "How Showly protects payments, accounts, uploads and data: encryption, two-factor login, virus scanning."],
    es: ["Seguridad | Showly", "Cómo protege Showly pagos, cuentas, archivos y datos: cifrado, doble factor y análisis de virus."],
  },
  cookies: {
    de: ["Cookies und Speicher | Showly", "Welche Cookies und Browser-Speicher Showly nutzt, welche freiwillig sind und wie du deine Wahl änderst."],
    en: ["Cookies and storage | Showly", "Which cookies and browser storage Showly uses, which are optional and how to change your choice."],
    es: ["Cookies y almacenamiento | Showly", "Qué cookies y almacenamiento usa Showly, cuáles son opcionales y cómo cambiar tu elección."],
  },
  terms: {
    de: ["AGB | Showly", "Allgemeine Geschäftsbedingungen von Showly für Kunden und Anbieter: Buchung, Zahlung, Storno, Provision."],
    en: ["Terms and conditions | Showly", "Showly terms for customers and providers: booking, payment, cancellation and commission."],
    es: ["Condiciones generales | Showly", "Condiciones de Showly para clientes y proveedores: reserva, pago, cancelación y comisión."],
  },
  withdrawal: {
    de: ["Widerrufsbelehrung | Showly", "Dein Widerrufsrecht bei Showly je Produktart, mit Muster-Formular und Widerrufsbutton."],
    en: ["Right of withdrawal | Showly", "Your right of withdrawal at Showly for each product type, with model form and withdrawal button."],
    es: ["Derecho de desistimiento | Showly", "Tu derecho de desistimiento en Showly por tipo de producto, con formulario y botón de desistimiento."],
  },
  accessibility: {
    de: ["Barrierefreiheit | Showly", "Erklärung zur Barrierefreiheit von Showly: Stand, bekannte Einschränkungen und Kontakt für Hinweise."],
    en: ["Accessibility | Showly", "Accessibility statement of Showly: status, known limitations and how to report barriers."],
    es: ["Accesibilidad | Showly", "Declaración de accesibilidad de Showly: estado, limitaciones conocidas y contacto."],
  },
};

function legalHead(doc: string, lang: "de" | "en" | "es") {
  const h = seoHead("/rechtliches/$doc", `/rechtliches/${doc}`, lang);
  const s = DOC_SEO[doc]?.[lang];
  if (!s) return { ...h, meta: [...h.meta, { name: "robots", content: "noindex, follow" }] };
  const [title, description] = s;
  const meta = h.meta.map((m) =>
    "title" in m
      ? { title }
      : m.name === "description" || m.property === "og:description" || m.name === "twitter:description"
        ? { ...m, content: description }
        : m.property === "og:title" || m.name === "twitter:title"
          ? { ...m, content: title }
          : m,
  );
  return { ...h, meta };
}

export const Route = createFileRoute("/rechtliches/$doc")({
  head: (ctx) => legalHead(ctx.params.doc, headLang(ctx)),
  component: Legal,
});

function Legal() {
  const { t, lang } = useShowly();
  const navigate = useNavigate();
  const { doc } = useParams({ from: "/rechtliches/$doc" });
  const docs = lang === "es" ? LEGAL_DOCS_ES : LEGAL_DOCS;
  const active = docs[doc] ? doc : "imprint";

  return (
    <div className="page active">
      <section className="section">
        <div className="section-inner" style={{ maxWidth: 920 }}>
          <div className="section-head" style={{ textAlign: "left" }}>
            <h2>{t("legal.h")}</h2>
          </div>
          <div className="legal-tabs">
            {TABS.map(([id, key]) => (
              <button
                key={id}
                className={"legal-tab" + (id === active ? " on" : "")}
                onClick={() => navigate({ to: "/rechtliches/$doc", params: { doc: id } })}
              >
                {EXTRA[id]?.[lang] ?? EXTRA[id]?.["de"] ?? t(key)}
              </button>
            ))}
          </div>
          {active === "cookies" && (
            <button type="button" className="home-btn primary legal-consent-btn" onClick={openConsentSettings}>
              {lang === "en" ? "Open privacy settings" : lang === "es" ? "Abrir ajustes de privacidad" : "Einstellungen öffnen"}
            </button>
          )}
          <div
            className="legal-doc"
            dangerouslySetInnerHTML={{ __html: docs[active] || LEGAL_DOCS[active]! }}
          />
        </div>
      </section>
      <Footer />
    </div>
  );
}
