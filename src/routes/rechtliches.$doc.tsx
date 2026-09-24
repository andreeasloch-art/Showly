import { seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LEGAL_DOCS, LEGAL_DOCS_ES } from "@/showly/legal";
import { useShowly } from "@/showly/store";
import { Footer } from "@/components/showly/Footer";

const TABS: [string, string][] = [
  ["imprint", "legal.imprint"],
  ["privacy", "legal.privacy"],
  ["security", "sec.tab"],
  ["cookies", "legal.cookies"],
  ["terms", "legal.terms"],
];

export const Route = createFileRoute("/rechtliches/$doc")({
  head: ({ params }) => seoHead("/rechtliches/$doc", `/rechtliches/${params.doc}`),
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
                {t(key)}
              </button>
            ))}
          </div>
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
