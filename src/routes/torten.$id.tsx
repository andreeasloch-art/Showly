import { SITE, headLang, seoHead } from "@/showly/seo";
import type { Lang } from "@/showly/data";
import { countView } from "@/showly/viewCount";
import { DemoNote } from "@/components/showly/DemoBadge";
import { ProviderStatusNote } from "@/components/showly/ProviderNotices";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { upsertPublicBaker } from "@/showly/cloudProviders";
import { bakerGraph } from "@/showly/schema";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import {
  BakerCard,
  KindBadge,
  MyRequests,
  RequestModal,
  SweetCard,
  catName,
  useSweetsCopy,
} from "@/components/showly/Sweets";
import { BakerEditor } from "@/components/showly/BakerEditor";
import { ProfileVideos } from "@/components/showly/MediaView";
import { AddOnShelf, suggestForBaker } from "@/components/showly/AddOns";
import {
  BAKERS,
  bakerBg,
  bakerOf,
  fromPrice,
  myBakerIds,
  sweetBg,
  sweetsOf,
  type Sweet,
} from "@/showly/sweets";

export const Route = createFileRoute("/torten/$id")({
  /* bearbeiten: eigenes Profil im Bearbeiten-Modus öffnen.
     angebot: von einer Angebotskarte gekommen; das Angebot wird angesteuert
     und kurz hervorgehoben. */
  validateSearch: (search: Record<string, unknown>): { bearbeiten?: boolean; angebot?: number } => {
    const out: { bearbeiten?: boolean; angebot?: number } = {};
    if (search["bearbeiten"] === true || search["bearbeiten"] === "1" || search["bearbeiten"] === 1) out.bearbeiten = true;
    const a = Number(search["angebot"]);
    if (Number.isInteger(a) && a > 0) out.angebot = a;
    return out;
  },
  /* Echte Profile schon auf dem Server laden, damit Suchmaschinen Text,
     Angebote und Preise ohne JavaScript sehen. Gibt es ein Profil aus der
     Datenbank nicht (mehr), antwortet der Server mit 404. */
  loader: async ({ params }) => {
    const id = Number(params.id);
    if (!(id >= 100000)) return { wire: null };
    const { publicBaker, parseBakers } = await import("@/utils/seo.functions");
    const wire = await publicBaker({ data: { id } }).catch(() => null);
    const [pb] = parseBakers(wire);
    if (pb) upsertPublicBaker(pb.provider, pb.offers);
    else if (typeof window === "undefined") throw notFound();
    return { wire };
  },
  head: (ctx) => bakerHead(ctx.params.id, headLang(ctx)),
  component: BakerProfile,
});

/* Titel, Beschreibung, Vorschaubild und strukturierte Daten je Profil.
   Beispiel-Anbieter und Profile ohne Angebote bleiben aus dem Suchindex. */
function bakerHead(idParam: string, lang: Lang) {
  const h = seoHead("/torten/$id", `/torten/${idParam}`, lang);
  const b = bakerOf(Number(idParam));
  if (!b) return { ...h, meta: [...h.meta, { name: "robots", content: "noindex, follow" }] };
  const tx = (v: unknown) => (typeof v === "string" ? v : ((v || {}) as Record<string, string>)[lang] || ((v || {}) as Record<string, string>)["de"] || "");
  const name = tx(b.name);
  const offers = sweetsOf(b.id);
  const title =
    lang === "en"
      ? `${name} – cakes & sweets${b.city ? ` in ${b.city}` : ""} | Showly`
      : lang === "es"
        ? `${name} – tartas y dulces${b.city ? ` en ${b.city}` : ""} | Showly`
        : `${name} – Torten & Süßes${b.city ? ` in ${b.city}` : ""} | Showly`;
  const raw = (tx(b.tagline) + " " + tx(b.about)).replace(/\s+/g, " ").trim();
  const description = raw.length > 155 ? raw.slice(0, 152).replace(/\s\S*$/, "") + " …" : raw || h.meta[1]!.content!;
  const indexable = !b.demo && b.id >= 100000 && offers.length > 0;
  const meta = h.meta.map((m) =>
    "title" in m
      ? { title }
      : m.name === "description" || m.property === "og:description" || m.name === "twitter:description"
        ? { ...m, content: description }
        : m.property === "og:title" || m.name === "twitter:title"
          ? { ...m, content: title }
          : m.property === "og:image" || m.name === "twitter:image"
            ? { ...m, content: `${SITE}/api/bild/torten/${b.id}` }
            : m.property === "og:image:alt"
              ? { ...m, content: name }
              : m,
  ).filter((m) => !("property" in m) || (m.property !== "og:image:width" && m.property !== "og:image:height"));
  return {
    meta: indexable ? meta : [...meta, { name: "robots", content: "noindex, follow" }],
    links: h.links,
    ...(indexable ? { scripts: [{ type: "application/ld+json", children: bakerGraph(b, offers, lang) }] } : {}),
  };
}

const COPY = {
  de: {
    back: "Torten & Süßes",
    notFound: "Dieses Profil gibt es nicht (mehr).",
    about: "Über uns",
    aboutPrivate: "Über mich",
    specialties: "Spezialitäten",
    offers: "Angebote",
    noOffers: "Noch keine Angebote eingestellt.",
    facts: "Gut zu wissen",
    since: (y: number) => `Auf Showly seit ${y}`,
    diets: "Ernährung",
    contact: "Kontakt",
    contactNote: "Kontaktdaten werden nach der Zusage geteilt. Schreib über „Anfragen“.",
    ask: "Unverbindlich anfragen",
    askP: "Wähle ein Angebot und schick deine Wünsche. Du bezahlst den Richtpreis sofort; günstiger oder Absage = Geld zurück, teurer = du bestätigst und zahlst nach.",
    reviews: (n: number) => (n === 1 ? "1 Bewertung" : `${n} Bewertungen`),
    noReviews: "Noch keine Bewertungen",
    owner: "Das ist dein Profil.",
    edit: "Profil bearbeiten",
    done: "Fertig",
    more: "Weitere Anbieter",
    privateNote: "Privatperson mit angemeldetem Lebensmittelbetrieb",
  },
  en: {
    back: "Cakes & sweets",
    notFound: "This profile doesn't exist (anymore).",
    about: "About us",
    aboutPrivate: "About me",
    specialties: "Specialities",
    offers: "Offers",
    noOffers: "No offers yet.",
    facts: "Good to know",
    since: (y: number) => `On Showly since ${y}`,
    diets: "Diets",
    contact: "Contact",
    contactNote: "Contact details are shared after confirmation. Use “Request”.",
    ask: "Request without obligation",
    askP: "Pick an offer and send your wishes. You pay the estimate now; cheaper or declined = money back, higher = you confirm and pay the rest.",
    reviews: (n: number) => (n === 1 ? "1 review" : `${n} reviews`),
    noReviews: "No reviews yet",
    owner: "This is your profile.",
    edit: "Edit profile",
    done: "Done",
    more: "More bakers",
    privateNote: "Home baker with registered food business",
  },
  es: {
    back: "Tartas y dulces",
    notFound: "Este perfil ya no existe.",
    about: "Sobre nosotros",
    aboutPrivate: "Sobre mí",
    specialties: "Especialidades",
    offers: "Ofertas",
    noOffers: "Aún no hay ofertas.",
    facts: "Bueno saber",
    since: (y: number) => `En Showly desde ${y}`,
    diets: "Dietas",
    contact: "Contacto",
    contactNote: "Los datos de contacto se comparten tras la confirmación. Usa “Solicitar”.",
    ask: "Solicitar sin compromiso",
    askP: "Elige una oferta y envía tus deseos. Pagas ahora el precio orientativo; si baja o rechaza, te devolvemos; si sube, lo confirmas y pagas el resto.",
    reviews: (n: number) => (n === 1 ? "1 opinión" : `${n} opiniones`),
    noReviews: "Aún sin opiniones",
    owner: "Este es tu perfil.",
    edit: "Editar perfil",
    done: "Listo",
    more: "Más reposteros",
    privateNote: "Particular con actividad alimentaria registrada",
  },
} as const;

function BakerProfile() {
  const { id } = Route.useParams();
  const { bearbeiten, angebot } = Route.useSearch();
  const { L, fmt, num, lang, hydrated } = useShowly();
  const S = useSweetsCopy();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [asking, setAsking] = useState<Sweet | null>(null);
  const [mine, setMine] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    setMine(myBakerIds().includes(Number(id)));
    countView("baker", Number(id));
  }, [id]);

  /* Kommt man über eine Angebotskarte, steht das Angebot mitten im Bild und
     leuchtet kurz auf. Profil, Infos und die übrigen Angebote bleiben drum
     herum sichtbar. */
  useEffect(() => {
    if (!angebot) return;
    let el: HTMLElement | null = null;
    const t = window.setTimeout(() => {
      el = document.getElementById("sweet-" + angebot);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash");
    }, 250);
    const t2 = window.setTimeout(() => el?.classList.remove("flash"), 2850);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [angebot, id, hydrated]);

  const b = bakerOf(Number(id));
  /* Selbst angelegte Profile liegen im Browser und sind erst nach dem Laden da */
  if (!b && !hydrated) return <div className="page active ui26 bk-page" />;
  if (!b) {
    return (
      <div className="page active ui26 bk-page">
        <div className="bk-wrap">
          <div className="empty-state">
            <div className="ic">
              <Icon name="search" />
            </div>
            <h3>{C.notFound}</h3>
            <Link className="home-btn primary" to="/torten">
              {C.back}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const editing = mine && !!bearbeiten;
  const offers = sweetsOf(b.id);
  const cheapest = fromPrice(b.id);
  const media = b.photos || [];
  const photos = media.filter((m) => m.kind !== "video");
  const thumbs = [photos[1], photos[2]];
  const others = BAKERS.filter((x) => x.id !== b.id)
    .sort((x, y) => Number(y.specialties.some((c) => b.specialties.includes(c))) - Number(x.specialties.some((c) => b.specialties.includes(c))))
    .slice(0, 3);

  function setEditing(on: boolean) {
    navigate({ to: "/torten/$id", params: { id }, search: on ? { bearbeiten: true } : {}, resetScroll: false });
  }

  return (
    <div className="page active ui26 bk-page">
      <div className="bk-wrap">
        <div className="bk-crumbs">
          <Link to="/torten">
            <Icon name="arrow" /> {C.back}
          </Link>
        </div>

        {mine && (
          <div className="bk-owner">
            <span>
              <Icon name="user" /> {C.owner}
            </span>
            <button className="home-btn primary" onClick={() => setEditing(!editing)}>
              <Icon name={editing ? "check" : "sparkle"} />
              {editing ? C.done : C.edit}
            </button>
          </div>
        )}

        {editing ? (
          <BakerEditor b={b} onSaved={() => bump((n) => n + 1)} />
        ) : (
          <>
            <div className="bk-gallery">
              <div className="bk-main-img" style={bakerBg(b)} />
              {thumbs.map((p, i) => (
                <div
                  key={i}
                  className="bk-thumb"
                  style={(p && mediaBg(p.id)) || (offers[i] ? sweetBg(offers[i]!) : bakerBg(b))}
                />
              ))}
            </div>

            <ProfileVideos items={media} title="Videos" />

            <div className="bk-layout">
              <div className="bk-body">
                <header className="bk-head">
                  <div className="bk-kicker">
                    <KindBadge b={b} />
                    {b.verified && (
                      <span className="bk-flag">
                        <Icon name="check" /> {S.verified}
                      </span>
                    )}
                  </div>
                  <h1>{L(b.name)}</h1>
                  <p className="bk-tagline">{L(b.tagline)}</p>
                  <div className="bk-meta">
                    <span>
                      {b.reviews > 0 ? (
                        <>
                          <span className="star">★</span> <b>{num(b.rating)}</b> · {C.reviews(b.reviews)}
                        </>
                      ) : (
                        C.noReviews
                      )}
                    </span>
                    <span>
                      <Icon name="pin" /> {b.city}
                    </span>
                    <span>
                      <Icon name="clock" /> {S.lead(b.leadDays)}
                    </span>
                    <span>
                      <Icon name="cart" /> {S.delivery(b.radiusKm)}
                    </span>
                  </div>
                  {b.demo ? <DemoNote /> : <ProviderStatusNote business={b.kind !== "private"} />}
                </header>

                <section className="bk-sec">
                  <h2>{b.kind === "private" ? C.aboutPrivate : C.about}</h2>
                  <p className="bk-text">{L(b.about)}</p>
                  {b.kind === "private" && b.foodRegistered && (
                    <p className="pe-note">
                      <Icon name="shield" /> {C.privateNote}
                    </p>
                  )}
                </section>

                <section className="bk-sec">
                  <h2>{C.specialties}</h2>
                  <div className="bk-chips">
                    {b.specialties.map((c) => (
                      <span key={c}>{catName(c, lang)}</span>
                    ))}
                    {(b.diets || []).map((d) => (
                      <span key={d} className="diet">
                        {d}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="bk-sec">
                  <h2>{C.offers}</h2>
                  {offers.length ? (
                    <div className="act-grid prod-grid bk-offers">
                      {offers.map((s) => (
                        <SweetCard s={s} key={s.id} onAsk={setAsking} showBaker={false} />
                      ))}
                    </div>
                  ) : (
                    <p className="bk-text muted">{C.noOffers}</p>
                  )}
                </section>

                <section className="bk-sec">
                  <h2>{C.facts}</h2>
                  <ul className="bk-facts">
                    <li>
                      <Icon name="calendar" /> {C.since(b.since)}
                    </li>
                    <li>
                      <Icon name="clock" /> {S.lead(b.leadDays)}
                    </li>
                    <li>
                      <Icon name="pin" /> {S.delivery(b.radiusKm)}
                    </li>
                    <li>
                      <Icon name="lock" /> {C.contactNote}
                    </li>
                  </ul>
                </section>

                <MyRequests bakerId={b.id} />
              </div>

              <aside className="bk-side">
                <div className="bk-side-card">
                  {cheapest && (
                    <div className="bk-side-price">
                      <small>{S.from}</small> <b>{fmt(cheapest.price)}</b> <small>{S.unit[cheapest.unit]}</small>
                    </div>
                  )}
                  <h3>{C.ask}</h3>
                  <p>{C.askP}</p>
                  <ul className="bk-pick">
                    {offers.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        <button onClick={() => setAsking(s)}>
                          <span className="bk-pick-img" style={sweetBg(s)} />
                          <span className="bk-pick-name">{L(s.name)}</span>
                          <span className="bk-pick-price">
                            {fmt(s.price)} {S.unit[s.unit]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {offers[0] && (
                    <button className="home-btn primary" onClick={() => setAsking(offers[0]!)}>
                      <Icon name="mail" /> {S.ask}
                    </button>
                  )}
                </div>
              </aside>
            </div>

            <div className="bk-addons">
              <AddOnShelf
                artists={suggestForBaker(b).artists}
                deco={suggestForBaker(b).deco.slice(0, 4)}
                title={S.moreForEvent}
                sub={S.moreForEventP}
              />
            </div>

            {others.length > 0 && (
              <section className="bk-sec bk-more">
                <h2>{C.more}</h2>
                <div className="act-grid">
                  {others.map((x) => (
                    <BakerCard b={x} key={x.id} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <Footer />
      {asking && <RequestModal s={asking} onClose={() => setAsking(null)} />}
    </div>
  );
}
