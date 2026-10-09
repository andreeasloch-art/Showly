import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, isPaymentConfigured } from "@/lib/stripe";
import { isBackendConfigured } from "@/lib/supabase";
import { useShowly } from "@/showly/store";
import { CATS } from "@/showly/data";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { OG_IMAGE, SITE } from "@/showly/seo";
import { setPending } from "@/showly/pending";
import { SPOTLIGHT_PRICE, SPOTLIGHT_PRICE_ID, getSpotlightsFor, SPOTLIGHT_SLOTS, daysLeft } from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import stageImg from "@/assets/spotlight-stage.jpg";

export const Route = createFileRoute("/top-act")({
  /* Aus dem Künstler-Portal kommen Act, Sparte und Profil schon mit. */
  validateSearch: (search: Record<string, unknown>) => {
    const str = (k: string) =>
      typeof search[k] === "string" ? (search[k] as string).slice(0, 200) : undefined;
    const paid = str("bezahlt");
    return {
      city: str("city"),
      name: str("name"),
      cat: str("cat"),
      link: str("link"),
      /* Rückkehr aus der Zahlung (Stripe-Sitzung) */
      ...(paid && /^cs_[A-Za-z0-9_]+$/.test(paid) ? { bezahlt: paid } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Top Act der Woche buchen – Showly" },
      {
        name: "description",
        content: `Sichere dir den Top-Platz auf der Showly-Startseite: 7 Tage prominente Platzierung für ${SPOTLIGHT_PRICE} € pro Woche.`,
      },
      { property: "og:title", content: "Top Act der Woche buchen – Showly" },
      {
        property: "og:description",
        content: "7 Tage ganz oben auf der Startseite – die sichtbarste Platzierung für deinen Act.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/top-act` }],
  }),
  component: TopActPage,
});

const COPY = {
  de: {
    eyebrow: "Premium-Platzierung",
    h1a: "Top Act",
    h1b: "der Woche",
    lead: `7 Tage ganz oben auf der Startseite. Je Stadt gibt es 5 Plätze, die sich alle paar Sekunden abwechseln. ${SPOTLIGHT_PRICE} € pro Woche, einmalig bezahlt.`,
    p1: "Ganz oben auf der Startseite",
    p2: "Eigenes Bild, Name, Ort und Slogan",
    p3: "Direkter Link zu deinem Profil",
    formH: "Deine Platzierung",
    name: "Künstlername",
    cat: "Kategorie",
    city: "Ort",
    tagline: "Slogan (kurzer Satz)",
    image: "Bild-URL (optional)",
    link: "Link zu deinem Profil (optional)",
    email: "E-Mail für die Bestätigung",
    pay: `Jetzt buchen · ${SPOTLIGHT_PRICE} €`,
    err: "Bitte Künstlername, Ort und Slogan ausfüllen.",
    title: "Top Act der Woche (7 Tage)",
    scope: (c: string) => `Du buchst den Top-Platz nur für ${c} und Umgebung – ${SPOTLIGHT_PRICE} € pro Woche.`,
    scopeAny: "Jede Stadt hat 5 Plätze für Top Acts der Woche. Du bezahlst nur für deine Stadt und Umgebung.",
    taken: (c: string, n: number) =>
      `In ${c} sind gerade alle 5 Plätze belegt (der nächste wird in ${n} Tagen frei).`,
  },
  en: {
    eyebrow: "Premium placement",
    h1a: "Top act",
    h1b: "of the week",
    lead: `7 days at the very top of the homepage. Each city has 5 spots that take turns every few seconds. €${SPOTLIGHT_PRICE} per week, one payment.`,
    p1: "Top of the homepage",
    p2: "Your image, name, city and slogan",
    p3: "Direct link to your profile",
    formH: "Your placement",
    name: "Artist name",
    cat: "Category",
    city: "City",
    tagline: "Slogan (one short line)",
    image: "Image URL (optional)",
    link: "Link to your profile (optional)",
    email: "Email for the confirmation",
    pay: `Book now · €${SPOTLIGHT_PRICE}`,
    err: "Please fill in artist name, city and slogan.",
    title: "Top act of the week (7 days)",
    scope: (c: string) => `You are booking the top spot for ${c} and nearby only – €${SPOTLIGHT_PRICE} per week.`,
    scopeAny: "Every city has 5 top act spots per week. You only pay for your city and its area.",
    taken: (c: string, n: number) =>
      `All 5 spots in ${c} are taken right now (the next one frees up in ${n} days).`,
  },
  es: {
    eyebrow: "Colocación premium",
    h1a: "Top act",
    h1b: "de la semana",
    lead: `7 días en lo más alto de la portada. Cada ciudad tiene 5 lugares que se turnan cada pocos segundos. ${SPOTLIGHT_PRICE} € por semana, un solo pago.`,
    p1: "Arriba del todo en la portada",
    p2: "Tu imagen, nombre, ciudad y eslogan",
    p3: "Enlace directo a tu perfil",
    formH: "Tu colocación",
    name: "Nombre artístico",
    cat: "Categoría",
    city: "Ciudad",
    tagline: "Eslogan (una frase corta)",
    image: "URL de imagen (opcional)",
    link: "Enlace a tu perfil (opcional)",
    email: "Correo para la confirmación",
    pay: `Reservar · ${SPOTLIGHT_PRICE} €`,
    err: "Rellena nombre, ciudad y eslogan.",
    title: "Top act de la semana (7 días)",
    scope: (c: string) => `Reservas el top act solo para ${c} y alrededores: ${SPOTLIGHT_PRICE} € por semana.`,
    scopeAny: "Cada ciudad tiene 5 lugares de top act por semana. Solo pagas por tu ciudad y su zona.",
    taken: (c: string, n: number) =>
      `En ${c} están ocupados los 5 lugares (el próximo queda libre en ${n} días).`,
  },
} as const;

/* Texte für Wochenwahl, freien Termin und Zahlung */
const W = {
  de: {
    weeks: "Dauer",
    week: (n: number) => (n === 1 ? "1 Woche" : `${n} Wochen`),
    total: (eur: number) => `Gesamt ${eur} €`,
    pay: (eur: number) => `Jetzt buchen und bezahlen · ${eur} €`,
    free: (d: string) => `Frei ab ${d}`,
    left: (n: number) => (n === 1 ? "Heute noch 1 von 5 Plätzen frei." : `Heute noch ${n} von 5 Plätzen frei.`),
    full: "Heute sind alle 5 Plätze belegt.",
    fromProfile: "Name, Sparte, Bild und Link kommen aus deinem Künstlerprofil.",
    login: "Den Top-Platz buchen Künstler mit ihrem Konto. Bitte melde dich an.",
    loginBtn: "Anmelden",
    booked: "Gebucht! Du bist Top Act der Woche. Die Bestätigung mit deinem Zeitraum kommt per E-Mail.",
    paying: (a: string, b: string) => `Zeitraum ${a} bis ${b} ist 30 Minuten für dich reserviert.`,
    back: "Zurück",
  },
  en: {
    weeks: "Duration",
    week: (n: number) => (n === 1 ? "1 week" : `${n} weeks`),
    total: (eur: number) => `Total €${eur}`,
    pay: (eur: number) => `Book and pay now · €${eur}`,
    free: (d: string) => `Free from ${d}`,
    left: (n: number) => (n === 1 ? "1 of 5 spots still free today." : `${n} of 5 spots still free today.`),
    full: "All 5 spots are taken today.",
    fromProfile: "Name, category, image and link come from your artist profile.",
    login: "Artists book the top spot with their account. Please sign in.",
    loginBtn: "Sign in",
    booked: "Booked! You are top act of the week. The confirmation with your dates follows by email.",
    paying: (a: string, b: string) => `${a} to ${b} is reserved for you for 30 minutes.`,
    back: "Back",
  },
  es: {
    weeks: "Duración",
    week: (n: number) => (n === 1 ? "1 semana" : `${n} semanas`),
    total: (eur: number) => `Total ${eur} €`,
    pay: (eur: number) => `Reservar y pagar · ${eur} €`,
    free: (d: string) => `Libre desde ${d}`,
    left: (n: number) => (n === 1 ? "Hoy queda 1 de 5 lugares libre." : `Hoy quedan ${n} de 5 lugares libres.`),
    full: "Hoy están ocupados los 5 lugares.",
    fromProfile: "Nombre, categoría, imagen y enlace salen de tu perfil de artista.",
    login: "Los artistas reservan el top act con su cuenta. Inicia sesión.",
    loginBtn: "Iniciar sesión",
    booked: "¡Reservado! Eres top act de la semana. Recibirás la confirmación con tus fechas por correo.",
    paying: (a: string, b: string) => `Del ${a} al ${b} queda reservado 30 minutos para ti.`,
    back: "Volver",
  },
} as const;

const dmy = (d: string) => d.split("-").reverse().join(".");

function TopActPage() {
  const { lang, catLabel, session } = useShowly() as any;
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const X = W[(lang as "de" | "en" | "es") ?? "de"] ?? W.de;
  const navigate = useNavigate();
  const { bezahlt } = Route.useSearch();
  /* Mit Datenbank: echte Buchung über den Server, sonst Vorschau im Browser */
  const cloud = isBackendConfigured();
  const loggedIn = !!session?.backend;
  const [weeks, setWeeks] = useState(1);
  const [status, setStatus] = useState<{ nextFree: string; freeToday: number } | null>(null);
  const [pay, setPay] = useState<{ clientSecret: string; startsOn: string; endsOn: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const total = SPOTLIGHT_PRICE * weeks;
  const { city: myCity } = useViewerCity();
  const { city: cityParam, name: nameParam, cat: catParam, link: linkParam } = Route.useSearch();
  const [f, setF] = useState({
    name: nameParam ?? "",
    cat: catParam && CATS.some((c) => c.id === catParam) ? catParam : (CATS[0]?.id ?? "magician"),
    city: cityParam ?? "",
    tagline: "",
    image: "",
    /* Nur Verweise innerhalb von Showly übernehmen, keine fremden Adressen */
    link: linkParam && linkParam.startsWith("/kuenstler/") ? linkParam : "",
    email: (session?.email as string) || "",
  });
  const [err, setErr] = useState("");
  const [touchedCity, setTouchedCity] = useState(!!cityParam);

  // Stadt automatisch aus dem erkannten Standort vorbelegen
  if (!touchedCity && !f.city && myCity) {
    setTouchedCity(true);
    setF((x) => ({ ...x, city: myCity }));
  }

  /* Ohne Datenbank: belegte Plätze aus diesem Browser */
  const inCity = f.city.trim() ? getSpotlightsFor(f.city.trim()) : [];
  const running =
    inCity.length >= SPOTLIGHT_SLOTS ? inCity.reduce((a, b) => (a.until <= b.until ? a : b)) : null;

  /* Freier Zeitraum in der gewählten Stadt */
  useEffect(() => {
    if (!cloud || f.city.trim().length < 2) return setStatus(null);
    const t = window.setTimeout(async () => {
      const { topActStatus } = await import("@/utils/spotlight.functions");
      const r = await topActStatus({ data: { city: f.city.trim(), weeks } }).catch(() => null);
      setStatus(r && !("error" in r) ? r : null);
    }, 400);
    return () => window.clearTimeout(t);
  }, [cloud, f.city, weeks]);

  /* Rückkehr aus der Zahlung: Platz fest buchen */
  useEffect(() => {
    if (!bezahlt) return;
    void (async () => {
      const { topActSettle } = await import("@/utils/spotlight.functions");
      const r = await topActSettle({ data: { sessionId: bezahlt, environment: getStripeEnvironment() } }).catch(() => ({ error: "Zahlung konnte nicht geprüft werden" }));
      if ("error" in r) setErr(r.error);
      else {
        setDone("ok");
        const { loadCloudSpotlights } = await import("@/showly/spotlight");
        void loadCloudSpotlights();
      }
    })();
  }, [bezahlt]);

  async function submitCloud() {
    if (!f.city.trim() || !f.tagline.trim()) return setErr(T.err);
    setErr("");
    setBusy(true);
    const { topActCheckout } = await import("@/utils/spotlight.functions");
    const r = await topActCheckout({
      data: {
        city: f.city.trim(),
        weeks,
        tagline: f.tagline.trim(),
        returnUrl: `${window.location.origin}/top-act?bezahlt={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    }).catch(() => ({ error: "Hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return setErr(r.error);
    setPay(r);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cloud) return void submitCloud();
    if (!f.name.trim() || !f.city.trim() || !f.tagline.trim()) {
      setErr(T.err);
      return;
    }
    setPending({
      kind: "spotlight",
      total,
      title: T.title,
      lines: [
        {
          name: T.title,
          amountInCents: SPOTLIGHT_PRICE * 100,
          quantity: weeks,
          priceId: SPOTLIGHT_PRICE_ID,
        },
      ],
      ...(f.email.trim() ? { email: f.email.trim() } : {}),
      spot: {
        weeks,
        name: f.name.trim(),
        cat: f.cat,
        city: f.city.trim(),
        tagline: f.tagline.trim(),
        ...(f.image.trim() ? { image: f.image.trim() } : {}),
        ...(f.link.trim() ? { link: f.link.trim() } : {}),
      },
    });
    navigate({ to: "/checkout" });
  }

  return (
    <div className="page active">
      <section className="topact-hero">
        <img className="topact-bg" src={stageImg} alt="" aria-hidden="true" width={1280} height={960} />
        <div className="topact-inner">
          <div className="topact-copy">
            <div className="topact-eyebrow">
              <Icon name="trophy" /> {T.eyebrow}
            </div>
            <h1 className="topact-h1">
              <span>{T.h1a}</span>
              <br />
              <span className="grad3d">{T.h1b}</span>
            </h1>
            <p className="topact-lead">{T.lead}</p>
            <ul className="topact-list">
              <li>
                <Icon name="star" /> {T.p1}
              </li>
              <li>
                <Icon name="eye" /> {T.p2}
              </li>
              <li>
                <Icon name="shield" /> {T.p3}
              </li>
            </ul>
          </div>

          {done ? (
            <div className="topact-form">
              <h2>{T.formH}</h2>
              <p className="topact-ok">{X.booked}</p>
              <button className="topact-pay" type="button" onClick={() => navigate({ to: "/" })}>
                Showly
              </button>
            </div>
          ) : pay ? (
            <div className="topact-form">
              <h2>{T.formH}</h2>
              <p className="topact-scope">{X.paying(dmy(pay.startsOn), dmy(pay.endsOn))}</p>
              <div id="checkout" className="topact-checkout">
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: pay.clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
              <button className="topact-back" type="button" onClick={() => setPay(null)}>
                {X.back}
              </button>
            </div>
          ) : cloud && !loggedIn ? (
            <div className="topact-form">
              <h2>{T.formH}</h2>
              <p className="topact-scope">{X.login}</p>
              <button className="topact-pay" type="button" onClick={() => navigate({ to: "/anmelden" })}>
                {X.loginBtn}
              </button>
            </div>
          ) : (
          <form className="topact-form" onSubmit={submit}>
            <h2>{T.formH}</h2>
            {cloud ? (
              <p className="topact-scope">{X.fromProfile}</p>
            ) : (
              <>
                <label>
                  {T.name}
                  <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </label>
                <label>
                  {T.cat}
                  <select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
                    {CATS.filter((c) => c.id !== "all").map((c) => (
                      <option key={c.id} value={c.id}>
                        {catLabel(c.id)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              {T.city}
              <input
                value={f.city}
                onChange={(e) => {
                  setTouchedCity(true);
                  setF({ ...f, city: e.target.value });
                }}
              />
            </label>
            <p className="topact-scope">
              {f.city.trim() ? T.scope(f.city.trim()) : T.scopeAny}
            </p>
            {cloud && status ? (
              <p className={status.freeToday ? "topact-free" : "topact-taken"}>
                {(status.freeToday ? X.left(status.freeToday) : X.full) + " "}
                {X.free(dmy(status.nextFree))}
              </p>
            ) : (
              !cloud && running && <p className="topact-taken">{T.taken(f.city.trim(), daysLeft(running))}</p>
            )}
            <label>
              {X.weeks}
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {X.week(n)} · {SPOTLIGHT_PRICE * n} €
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T.tagline}
              <input value={f.tagline} maxLength={120} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
            </label>
            {!cloud && (
              <>
                <label>
                  {T.image}
                  <input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} />
                </label>
                <label>
                  {T.link}
                  <input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
                </label>
                <label>
                  {T.email}
                  <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </label>
              </>
            )}
            {err && <div className="topact-err">{err}</div>}
            <button className="topact-pay" type="submit" disabled={busy || (cloud && !isPaymentConfigured())}>
              {X.pay(total)}
            </button>
          </form>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
