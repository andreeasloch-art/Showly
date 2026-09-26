import { seoHead } from "@/showly/seo";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { useImageStore } from "@/components/showly/ImagePick";
import {
  OfferFields,
  SpecPicker,
  emptyOffer,
  parsePrice,
  type OfferDraft,
} from "@/components/showly/BakerEditor";
import {
  createBaker,
  saveSweet,
  type SweetCat,
  isDirectSweet,
} from "@/showly/sweets";
import type { MediaRef } from "@/showly/media";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";
import { isBackendConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/torten/anbieten")({
  head: () => seoHead("/torten/anbieten", "/torten/anbieten"),
  component: Onboard,
});

const COPY = {
  de: {
    back: "Torten & Süßes",
    eyebrow: "Torten anbieten",
    h1: "Dein Profil für Torten, Kuchen & Candy Bars",
    sub: "Ob Konditorei oder Hobbyküche: In ein paar Minuten steht dein Profil mit Fotos und ersten Angeboten.",
    s1: "Wer bietet an?",
    private: "Privatperson",
    privateP: "Du backst zu Hause, nebenbei oder als Hobby.",
    business: "Konditorei oder Betrieb",
    businessP: "Bäckerei, Konditorei, Café, Candy-Bar-Verleih.",
    s2: "Dein Profil",
    name: (p: boolean) => (p ? "Dein Name im Profil" : "Name des Betriebs"),
    namePh: (p: boolean) => (p ? "z. B. Lisa backt" : "z. B. Konditorei Sonnenschein"),
    city: "Stadt",
    tagline: "Kurzbeschreibung",
    taglinePh: "z. B. Motivtorten für Kindergeburtstage",
    about: "Über dich",
    aboutPh: "Wie bist du zum Backen gekommen? Was macht deine Torten besonders?",
    specs: "Was backst du?",
    radius: "Lieferung bis (km)",
    radiusHint: "0 = nur Abholung",
    lead: "Vorlauf (Tage)",
    photos: "Fotos deiner Torten",
    photosP: "Bis zu 8 Fotos. Das erste wird dein Titelbild.",
    upload: "Fotos wählen",
    s3: "Dein erstes Angebot",
    s3P: "Weitere Angebote kannst du danach im Profil anlegen.",
    s4: "Rechtliches",
    legal: "Ich habe meine Tätigkeit beim zuständigen Lebensmittelüberwachungsamt angemeldet und halte die Hygieneregeln und die Kennzeichnung von Allergenen ein.",
    legalHint: "Auch wer privat gegen Geld backt, muss das in Deutschland anmelden. Das geht meist formlos beim Veterinär- und Lebensmittelaufsichtsamt.",
    terms: "Ich akzeptiere die",
    termsLink: "Nutzungsbedingungen",
    submit: "Profil anlegen",
    need: "Bitte Name, Stadt und mindestens eine Spezialität angeben.",
    needOffer: "Bitte für das erste Angebot Name und Preis angeben.",
    needLegal: "Bitte die Anmeldung und die Nutzungsbedingungen bestätigen.",
    loginNext: "Fast geschafft: Melde dich jetzt an, dann wird dein Profil angelegt. Sichtbar wird es, sobald wir es freigeschaltet haben.",
    review: "Profil angelegt. Wir prüfen es und schalten es in der Regel innerhalb von 2 Werktagen frei.",
    done: "Dein Profil ist angelegt. Hier kannst du es weiter bearbeiten.",
    note: "Dein Profil wird vorerst nur in diesem Browser gespeichert. Die Prüfung durch Showly folgt, bevor es öffentlich erscheint.",
  },
  en: {
    back: "Cakes & sweets",
    eyebrow: "Sell cakes",
    h1: "Your profile for cakes, bakes & candy bars",
    sub: "Patisserie or home kitchen: your profile with photos and first offers is ready in minutes.",
    s1: "Who is offering?",
    private: "Home baker",
    privateP: "You bake at home, on the side or as a hobby.",
    business: "Patisserie or business",
    businessP: "Bakery, patisserie, café, candy bar rental.",
    s2: "Your profile",
    name: (p: boolean) => (p ? "Your profile name" : "Business name"),
    namePh: (p: boolean) => (p ? "e.g. Lisa bakes" : "e.g. Sunshine Patisserie"),
    city: "City",
    tagline: "Short description",
    taglinePh: "e.g. themed cakes for kids' parties",
    about: "About you",
    aboutPh: "How did you start baking? What makes your cakes special?",
    specs: "What do you bake?",
    radius: "Delivery up to (km)",
    radiusHint: "0 = pickup only",
    lead: "Notice (days)",
    photos: "Photos of your cakes",
    photosP: "Up to 8 photos. The first is your cover.",
    upload: "Choose photos",
    s3: "Your first offer",
    s3P: "You can add more offers in your profile later.",
    s4: "Legal",
    legal: "I have registered my activity with the local food authority and follow hygiene rules and allergen labelling.",
    legalHint: "In Germany, home bakers selling for money must register too, usually informally with the local food authority.",
    terms: "I accept the",
    termsLink: "terms of use",
    submit: "Create profile",
    need: "Please add a name, city and at least one speciality.",
    needOffer: "Please add a name and price for your first offer.",
    needLegal: "Please confirm the registration and the terms.",
    loginNext: "Almost done: sign in now and your profile will be created. It goes live once we have approved it.",
    review: "Profile created. We review it and usually approve it within 2 business days.",
    done: "Your profile is ready. You can keep editing it here.",
    note: "For now your profile is only saved in this browser. Showly reviews it before it goes public.",
  },
  es: {
    back: "Tartas y dulces",
    eyebrow: "Vender tartas",
    h1: "Tu perfil para tartas, bizcochos y candy bars",
    sub: "Pastelería o cocina casera: tu perfil con fotos y primeras ofertas en pocos minutos.",
    s1: "¿Quién ofrece?",
    private: "Particular",
    privateP: "Horneas en casa, como extra o por afición.",
    business: "Pastelería o empresa",
    businessP: "Panadería, pastelería, cafetería, alquiler de candy bar.",
    s2: "Tu perfil",
    name: (p: boolean) => (p ? "Tu nombre en el perfil" : "Nombre del negocio"),
    namePh: (p: boolean) => (p ? "p. ej. Lisa hornea" : "p. ej. Pastelería Sol"),
    city: "Ciudad",
    tagline: "Descripción corta",
    taglinePh: "p. ej. tartas temáticas para cumpleaños infantiles",
    about: "Sobre ti",
    aboutPh: "¿Cómo empezaste a hornear? ¿Qué hace especiales tus tartas?",
    specs: "¿Qué horneas?",
    radius: "Entrega hasta (km)",
    radiusHint: "0 = solo recogida",
    lead: "Antelación (días)",
    photos: "Fotos de tus tartas",
    photosP: "Hasta 8 fotos. La primera es tu portada.",
    upload: "Elegir fotos",
    s3: "Tu primera oferta",
    s3P: "Luego puedes añadir más ofertas en tu perfil.",
    s4: "Aspectos legales",
    legal: "He registrado mi actividad ante la autoridad alimentaria y cumplo las normas de higiene y el etiquetado de alérgenos.",
    legalHint: "En Alemania, también los particulares que venden deben registrarse ante la autoridad alimentaria local.",
    terms: "Acepto las",
    termsLink: "condiciones de uso",
    submit: "Crear perfil",
    need: "Indica nombre, ciudad y al menos una especialidad.",
    needOffer: "Indica nombre y precio de tu primera oferta.",
    needLegal: "Confirma el registro y las condiciones.",
    loginNext: "Casi listo: inicia sesión y se creará tu perfil. Será visible cuando lo aprobemos.",
    review: "Perfil creado. Lo revisamos y normalmente lo aprobamos en 2 días laborables.",
    done: "Tu perfil está listo. Aquí puedes seguir editándolo.",
    note: "Por ahora tu perfil solo se guarda en este navegador. Showly lo revisa antes de publicarlo.",
  },
};

function Onboard() {
  const okText = useContactCheck();
  const { lang, toast, session, queueBakerSignup } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const store = useImageStore();
  const input = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<"private" | "business">("private");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [specs, setSpecs] = useState<SweetCat[]>(["birthday"]);
  const [radius, setRadius] = useState(10);
  const [lead, setLead] = useState(5);
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<OfferDraft>(emptyOffer("birthday"));
  const [legal, setLegal] = useState(false);
  const [terms, setTerms] = useState(false);
  const isPrivate = kind === "private";
  const int = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

  async function addPhotos(files: FileList | null) {
    const room = 8 - photos.length;
    if (!files?.length || room <= 0) return;
    setBusy(true);
    const refs = await store(files, room);
    setBusy(false);
    setPhotos((p) => [...p, ...refs]);
  }

  function submit() {
    if (!name.trim() || !city.trim() || !specs.length) return toast(C.need);
    const price = parsePrice(offer.price);
    if (!offer.name.trim() || !price) return toast(C.needOffer);
    if (!legal || !terms) return toast(C.needLegal);
    if (!okText(tagline, about, offer.name, offer.desc)) return;
    /* Mit Datenbank: Profil und erstes Angebot auf dem Server, sichtbar nach
       Freischaltung durch die Verwaltung */
    if (isBackendConfigured()) {
      const signup = {
        baker: {
          kind,
          name: name.trim().slice(0, 80),
          city: city.trim().slice(0, 60),
          since: new Date().getFullYear(),
          tagline: tagline.trim().slice(0, 120),
          about: about.trim().slice(0, 1500),
          specialties: specs,
          leadDays: Math.max(1, lead),
          radiusKm: radius,
          coverImg: 1,
          foodRegistered: true,
        },
        offer: {
          name: offer.name.trim().slice(0, 100),
          desc: offer.desc.trim().slice(0, 600),
          cat: offer.cat,
          price,
          unit: offer.unit,
          minQty: offer.unit === "set" ? 1 : offer.minQty,
          direct: offer.direct ?? isDirectSweet({ cat: offer.cat }),
        },
      };
      void queueBakerSignup(signup).then((id) => {
        if (!session?.backend) {
          toast(C.loginNext);
          setTimeout(() => navigate({ to: "/anmelden" }), 800);
          return;
        }
        if (id) {
          toast(C.review);
          navigate({ to: "/torten/$id", params: { id: String(id) }, search: { bearbeiten: true } });
        }
      });
      return;
    }
    const b = createBaker({
      kind,
      name: name.trim().slice(0, 80),
      city: city.trim().slice(0, 60),
      since: new Date().getFullYear(),
      tagline: tagline.trim().slice(0, 120),
      about: about.trim().slice(0, 1500),
      specialties: specs,
      leadDays: Math.max(1, lead),
      radiusKm: radius,
      coverImg: 1,
      photos,
      foodRegistered: true,
    });
    saveSweet({
      bakerId: b.id,
      name: offer.name.trim().slice(0, 100),
      desc: offer.desc.trim().slice(0, 600),
      cat: offer.cat,
      price,
      unit: offer.unit,
      minQty: offer.unit === "set" ? 1 : offer.minQty,
      direct: offer.direct ?? isDirectSweet({ cat: offer.cat }),
      photo: offer.photo,
    });
    toast(C.done);
    navigate({ to: "/torten/$id", params: { id: String(b.id) }, search: { bearbeiten: true } });
  }

  return (
    <div className="page active ui26 bk-page onboard26">
      <div className="bk-wrap narrow">
        <div className="bk-crumbs">
          <Link to="/torten">
            <Icon name="arrow" /> {C.back}
          </Link>
        </div>
        <header className="ob-head">
          <span className="home-eyebrow">{C.eyebrow}</span>
          <h1>{C.h1}</h1>
          <p>{C.sub}</p>
        </header>

        <div className="pe-main">
          <section className="pe-card">
            <h3 className="ob-step">
              <span>1</span> {C.s1}
            </h3>
            <div className="ob-kinds" role="radiogroup">
              {(
                [
                  ["private", "heart", C.private, C.privateP],
                  ["business", "crown", C.business, C.businessP],
                ] as const
              ).map(([k, ic, h, p]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={"ob-kind" + (kind === k ? " on" : "")}
                  onClick={() => setKind(k)}
                >
                  <span className="pe-ic">
                    <Icon name={ic} />
                  </span>
                  <b>{h}</b>
                  <small>{p}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>2</span> {C.s2}
            </h3>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">{C.name(isPrivate)}</span>
                <input value={name} maxLength={80} placeholder={C.namePh(isPrivate)} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">{C.city}</span>
                <input value={city} maxLength={60} autoComplete="address-level2" onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
            <label className="pe-field">
              <span className="pe-label">{C.tagline}</span>
              <input value={tagline} maxLength={120} placeholder={C.taglinePh} onChange={(e) => setTagline(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.about}</span>
              <textarea rows={5} value={about} maxLength={1500} placeholder={C.aboutPh} onChange={(e) => setAbout(e.target.value)} />
              <ContactHint text={tagline + "\n" + about} />
            </label>
            <div className="pe-field">
              <span className="pe-label">{C.specs}</span>
              <SpecPicker value={specs} onChange={setSpecs} />
            </div>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">{C.radius}</span>
                <input type="number" min={0} max={300} value={radius} onChange={(e) => setRadius(int(e.target.value, 300))} />
                <span className="pe-hint">{C.radiusHint}</span>
              </label>
              <label className="pe-field">
                <span className="pe-label">{C.lead}</span>
                <input type="number" min={1} max={120} value={lead} onChange={(e) => setLead(int(e.target.value, 120))} />
              </label>
            </div>
            <div className="pe-field">
              <span className="pe-label">{C.photos}</span>
              <span className="pe-hint">{C.photosP}</span>
              <div className="pe-photos">
                {photos.map((m, i) => (
                  <figure className={"pe-photo" + (i === 0 ? " cover" : "")} key={m.id}>
                    <span className="pe-photo-img" style={mediaBg(m.id) ?? undefined} />
                    <figcaption>
                      <button type="button" className="danger" onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}>
                        <Icon name="trash" />
                      </button>
                    </figcaption>
                  </figure>
                ))}
                {photos.length < 8 && (
                  <button type="button" className="pe-photo-add" onClick={() => input.current?.click()} disabled={busy}>
                    <Icon name="plus" />
                    <span>{C.upload}</span>
                    <small>{photos.length}/8</small>
                  </button>
                )}
                <input
                  ref={input}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>3</span> {C.s3}
            </h3>
            <p className="pe-hint">{C.s3P}</p>
            <OfferFields d={offer} onChange={setOffer} />
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>4</span> {C.s4}
            </h3>
            <label className="ob-check">
              <input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} />
              <span>
                {C.legal}
                <small>{C.legalHint}</small>
              </span>
            </label>
            <label className="ob-check">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                {C.terms}{" "}
                <Link to="/rechtliches/$doc" params={{ doc: "terms" }} target="_blank">
                  {C.termsLink}
                </Link>
                .
              </span>
            </label>
            <p className="pe-note">
              <Icon name="lock" /> {C.note}
            </p>
            <button className="home-btn primary ob-submit" onClick={submit}>
              {C.submit}
              <Icon name="arrow" />
            </button>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
