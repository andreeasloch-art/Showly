/* Rücksprung nach der Anmeldung bei Google oder nach dem Klick im Bestätigungslink.
 *
 * Supabase hängt den Einmalcode an die Adresse. Hier wird er gegen eine Sitzung
 * getauscht, danach ist die Adresszeile wieder sauber und es geht weiter zu der
 * Seite, von der die Anmeldung ausging. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Footer } from "@/components/showly/Footer";
import { isBackendConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/rueckkehr")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s["next"] === "string" ? s["next"] : "/dashboard",
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    error_description:
      typeof s["error_description"] === "string" ? s["error_description"] : undefined,
  }),
  component: AuthReturn,
});

const COPY = {
  de: { wait: "Anmeldung wird abgeschlossen …", fail: "Anmeldung fehlgeschlagen", back: "Zurück zur Anmeldung" },
  en: { wait: "Finishing sign-in …", fail: "Sign-in failed", back: "Back to sign-in" },
  es: { wait: "Terminando el inicio de sesión …", fail: "No se pudo iniciar sesión", back: "Volver" },
} as const;

function AuthReturn() {
  const { next, code, error_description } = Route.useSearch();
  const { lang } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [err, setErr] = useState(error_description ?? "");

  useEffect(() => {
    if (!isBackendConfigured()) return void navigate({ to: "/konto" });
    if (error_description) return;

    void (async () => {
      try {
        if (code) {
          const { error } = await supabase().auth.exchangeCodeForSession(code);
          if (error) return setErr(error.message);
        }
        /* Nur Ziele innerhalb der eigenen Seite zulassen. Ein offener
           Weiterleiter wäre sonst eine Einladung für Betrugsseiten. */
        const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
        window.location.replace(safe);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [code, next, error_description, navigate]);

  return (
    <div className="page active konto-page">
      <div className="konto-wrap">
        <div className="konto-card">
          {err ? (
            <>
              <h1 className="konto-h1">{T.fail}</h1>
              <p className="konto-sub">{err}</p>
              <button className="btn-primary" onClick={() => navigate({ to: "/anmelden" })}>
                {T.back}
              </button>
            </>
          ) : (
            <p className="konto-sub">{T.wait}</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
