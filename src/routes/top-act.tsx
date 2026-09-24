import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useShowly } from "@/showly/store";
import { CATS } from "@/showly/data";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { setPending } from "@/showly/pending";
import { SPOTLIGHT_PRICE, SPOTLIGHT_PRICE_ID, getSpotlightFor, daysLeft } from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import stageImg from "@/assets/spotlight-stage.jpg";

export const Route = createFileRoute("/top-act")({
  /* Aus dem Künstler-Portal kommen Act, Sparte und Profil schon mit. */
  validateSearch: (search: Record<string, unknown>) => {
    const str = (k: string) =>
      typeof search[k] === "string" ? (search[k] as string).slice(0, 200) : undefined;
    return { city: str("city"), name: str("name"), cat: str("cat"), link: str("link") };
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
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TopActPage,
});

const COPY = {
  de: {
    eyebrow: "Premium-Platzierung",
    h1a: "Top Act",
    h1b: "der Woche",
    lead: `7 Tage ganz oben auf der Startseite – über allen Suchergebnissen. ${SPOTLIGHT_PRICE} € pro Woche, einmalig bezahlt.`,
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
    scopeAny: "Jede Stadt der Welt hat ihren eigenen Top Act der Woche. Du bezahlst nur für deine Stadt und Umgebung.",
    taken: (c: string, n: number) =>
      `In ${c} läuft aktuell schon ein Top Act (noch ${n} Tage). Danach ist der Platz wieder frei.`,
  },
  en: {
    eyebrow: "Premium placement",
    h1a: "Top act",
    h1b: "of the week",
    lead: `7 days at the very top of the homepage – above all search results. €${SPOTLIGHT_PRICE} per week, one payment.`,
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
    scopeAny: "Every city in the world has its own top act of the week. You only pay for your city and its area.",
    taken: (c: string, n: number) =>
      `${c} already has a running top act (${n} days left). The spot frees up afterwards.`,
  },
  es: {
    eyebrow: "Colocación premium",
    h1a: "Top act",
    h1b: "de la semana",
    lead: `7 días en lo más alto de la portada, por encima de los resultados. ${SPOTLIGHT_PRICE} € por semana, un solo pago.`,
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
    scopeAny: "Cada ciudad del mundo tiene su propio top act de la semana. Solo pagas por tu ciudad y su zona.",
    taken: (c: string, n: number) =>
      `${c} ya tiene un top act activo (quedan ${n} días). Después el lugar queda libre.`,
  },
} as const;

function TopActPage() {
  const { lang, catLabel, session } = useShowly() as any;
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
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

  const running = f.city.trim() ? getSpotlightFor(f.city.trim()) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || !f.city.trim() || !f.tagline.trim()) {
      setErr(T.err);
      return;
    }
    setPending({
      kind: "spotlight",
      total: SPOTLIGHT_PRICE,
      title: T.title,
      lines: [
        {
          name: T.title,
          amountInCents: SPOTLIGHT_PRICE * 100,
          quantity: 1,
          priceId: SPOTLIGHT_PRICE_ID,
        },
      ],
      ...(f.email.trim() ? { email: f.email.trim() } : {}),
      spot: {
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

          <form className="topact-form" onSubmit={submit}>
            <h2>{T.formH}</h2>
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
            {running && (
              <p className="topact-taken">{T.taken(f.city.trim(), daysLeft(running))}</p>
            )}
            <label>
              {T.tagline}
              <input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
            </label>
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
              <input
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </label>
            {err && <div className="topact-err">{err}</div>}
            <button className="topact-pay" type="submit">
              {T.pay}
            </button>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}
