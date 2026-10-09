import { headLang, seoHead } from "@/showly/seo";
import { PrivacyAck, usePrivacyCopy } from "@/components/showly/PrivacyAck";
import { FEE_RATE } from "@/showly/pricing";
import { StatusChoice, TaxAck, TaxNotice } from "@/components/showly/ProviderNotices";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ARTISTS, CATS } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, bgOf } from "@/showly/ui";
import { defaultPackages, pwScore } from "@/showly/figures";
import { Footer } from "@/components/showly/Footer";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS, travelOption } from "@/showly/travel";
import { localProfileExists, saveArtistProfile, saveAccount } from "@/showly/persist";
import { isBackendConfigured } from "@/lib/supabase";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";
import { AccountStep } from "@/components/showly/AccountStep";
import { loginId } from "@/showly/phone";

export const Route = createFileRoute("/mitmachen")({
  head: (ctx) => seoHead("/mitmachen", "/mitmachen", headLang(ctx)),
  component: Become,
});

const PLANNER_CATS = ["eventplanner", "weddingplanner"];

/* Texte, die es nur im neuen Aufbau dieser Seite gibt. */
const COPY = {
  de: {
    pill: "Für Künstler · kostenlos registrieren",
    calc: "Verdienst berechnen",
    t1: "0 € Anmeldung",
    t2: "20 % nur, wenn du gebucht wirst",
    t3: "Eigene Preise und Termine",
    example: "Beispielansicht",
    newReq: "Neue Buchungsanfrage",
    reqMeta: "Hochzeit · München",
    payout: "Auszahlung",
    booked: "Sa · gebucht",
    per: "/ Std.",
    formH: "Das bekommst du",
    formL: [
      "Eigenes Profil mit Bildern, Paketen und Bewertungen",
      "Kalender, in dem Kunden freie Termine sehen",
      "Buchungen mit sicherer Zahlung und Auszahlung nach dem Event",
      "15 % Rabatt auf Kostüme im Showly-Shop",
    ],
  },
  en: {
    pill: "For artists · start for free",
    calc: "Calculate earnings",
    t1: "€0 to sign up",
    t2: "20% only when you get booked",
    t3: "Your own prices and dates",
    example: "Example view",
    newReq: "New booking request",
    reqMeta: "Wedding · Munich",
    payout: "Payout",
    booked: "Sat · booked",
    per: "/ hr",
    formH: "What you get",
    formL: [
      "Your own profile with photos, packages and reviews",
      "A calendar where clients see your free dates",
      "Bookings with secure payment and payout after the event",
      "15% off costumes in the Showly shop",
    ],
  },
  es: {
    pill: "Para artistas · empieza gratis",
    calc: "Calcular ingresos",
    t1: "0 € de alta",
    t2: "20 % solo si te reservan",
    t3: "Tus propios precios y fechas",
    example: "Vista de ejemplo",
    newReq: "Nueva solicitud de reserva",
    reqMeta: "Boda · Múnich",
    payout: "Pago",
    booked: "Sáb · reservado",
    per: "/ h",
    formH: "Lo que obtienes",
    formL: [
      "Tu propio perfil con fotos, paquetes y opiniones",
      "Un calendario donde los clientes ven tus fechas libres",
      "Reservas con pago seguro y cobro después del evento",
      "15 % de descuento en disfraces de la tienda Showly",
    ],
  },
} as const;

function Become() {
  const okText = useContactCheck();
  const { t, lang, fmt, num, toast, setSession, catLabel, L, session, queueArtistSignup } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [role, setRole] = useState<"artist" | "planner" | "sweets">("artist");
  const [fee, setFee] = useState(80);
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    pw: "",
    hp: "",
    cat: "fairy",
    stage: "",
    figfree: "",
    loc: "",
    radius: String(DEFAULT_RADIUS_KM),
    price: "",
    desc: "",
  });
  const [figs, setFigs] = useState<string[]>([]);
  /* Pflichtangaben (AGB §§ 9, 18): privat oder gewerblich, Regeln zu Absage
     und Nichterscheinen, Steuerhinweis. Vertragsstrafen in AGB sind nur
     gegenüber Unternehmern zulässig; Privatanbieter bekommen deshalb nur das
     Stufenmodell (Einschränkung, Sperre) ohne Geldstrafe. */
  const [business, setBusiness] = useState<boolean | null>(null);
  const [rulesOk, setRulesOk] = useState(false);
  const [taxOk, setTaxOk] = useState(false);
  const [adult, setAdult] = useState(false);
  const [privOk, setPrivOk] = useState(false);
  /* Konto per E-Mail oder Handynummer (Übungsmodus), mit Datenbank per
     Einmal-Code im letzten Schritt (AccountStep) */
  const [via, setVia] = useState<"mail" | "phone">("mail");
  const [acct, setAcct] = useState(false);
  const cloud = isBackendConfigured();
  const P = usePrivacyCopy();
  const RG =
    {
      de: {
        rules:
          "Ich kenne die Regeln bei Absage und Nichterscheinen: Absage ab 14 Tagen vorher ohne Folgen, darunter 15 % der Gage als Vertragsstrafe, unter 48 Stunden 25 %, bei Nichterscheinen 100 %, außer bei einem belegten Notfall. Strafen werden mit der nächsten Auszahlung verrechnet; 3 Verwarnungen in 12 Monaten führen zur Sperre (AGB § 9).",
        rulesPriv:
          "Ich kenne die Regeln bei Absage und Nichterscheinen: Absage ab 14 Tagen vorher ohne Folgen. Spätere Absagen und Nichterscheinen ohne belegten Notfall sind Verwarnungen; 3 in 12 Monaten führen zur Sperre des Profils (AGB § 9).",
        rulesLink: "AGB lesen",
        adult: "Ich bin mindestens 18 Jahre alt.",
        adultNeed: "Anbieten können nur Volljährige. Bitte bestätige, dass du mindestens 18 bist.",
        need: "Bitte wähle privat oder gewerblich und bestätige die Punkte unten.",
        sweets: "Torten, Deko & Süßes",
        sweetsH: "Du bietest Torten, Süßes oder Deko an?",
        sweetsP: "Dafür gibt es eine eigene Anmeldung mit Angeboten, Fotos und Preisen. Privat oder als Betrieb.",
        sweetsCake: "Torten & Süßes anbieten",
        sweetsDeco: "Deko anbieten",
        loginNext: "Fast geschafft: Melde dich jetzt an, dann wird dein Profil angelegt.",
        oneH: "Ein Profil für alle deine Acts",
        oneP: "Jede Person hat bei Showly genau ein Profil. Alle Figuren, Rollen und Acts, die du anbietest, trägst du in diesem einen Profil ein, auch später jederzeit. Ein zweites Konto derselben Person erkennt die Ausweisprüfung, es wird nicht freigeschaltet.",
        haveH: "Du hast schon ein Profil",
        haveP: "Neue Figuren und Acts fügst du in deinem bestehenden Profil hinzu. Ein zweites Profil ist nicht möglich.",
        haveBtn: "Zu meinem Profil",
        dupLocal: "Für diese Person gibt es schon ein Profil. Melde dich mit deinem Konto an und trag neue Acts dort ein.",
        viaMail: "E-Mail",
        viaPhone: "Handynummer",
        phone: "Handynummer",
        phonePh: "0151 23456789",
        badPhone: "Bitte eine gültige Handynummer eingeben, etwa 0151 23456789.",
        cloudAcct: "Dein Konto bestätigst du im letzten Schritt mit einem Code per SMS an deine Handynummer oder per E-Mail. Ein Passwort brauchst du nicht.",
      },
      en: {
        rules:
          "I know the rules for cancellations and no-shows: cancelling 14 days or more before is free, below that a penalty of 15% of the fee, 25% under 48 hours, 100% for a no-show, unless there is a proven emergency. Penalties are offset against the next payout; 3 warnings in 12 months lead to a ban (T&C § 9).",
        rulesPriv:
          "I know the rules for cancellations and no-shows: cancelling 14 days or more before is free. Later cancellations and no-shows without a proven emergency are warnings; 3 in 12 months lead to suspension of the profile (T&C § 9).",
        rulesLink: "Read T&C",
        adult: "I am at least 18 years old.",
        adultNeed: "Only adults can offer services. Please confirm that you are at least 18.",
        need: "Please choose private or commercial and confirm the points below.",
        sweets: "Cakes, decor & sweets",
        sweetsH: "You offer cakes, sweets or decor?",
        sweetsP: "There is a separate sign-up with offers, photos and prices. Private or as a business.",
        sweetsCake: "Offer cakes & sweets",
        sweetsDeco: "Offer decor",
        loginNext: "Almost done: sign in now and your profile will be created.",
        oneH: "One profile for all your acts",
        oneP: "Every person has exactly one profile on Showly. Add all the characters, roles and acts you offer to this one profile, now or any time later. A second account of the same person is detected by the identity check and will not be activated.",
        haveH: "You already have a profile",
        haveP: "Add new characters and acts to your existing profile. A second profile is not possible.",
        haveBtn: "Go to my profile",
        dupLocal: "There is already a profile for this person. Sign in with your account and add new acts there.",
        viaMail: "Email",
        viaPhone: "Mobile number",
        phone: "Mobile number",
        phonePh: "+49 151 23456789",
        badPhone: "Please enter a valid mobile number, e.g. +49 151 23456789.",
        cloudAcct: "In the last step you confirm your account with a code sent by text message to your mobile number or by email. No password needed.",
      },
      es: {
        rules:
          "Conozco las reglas de cancelación y ausencia: cancelar con 14 días o más de antelación es gratis; después, penalización del 15 % del caché, del 25 % a menos de 48 horas y del 100 % si no me presento, salvo emergencia justificada. Se descuenta del próximo pago; 3 avisos en 12 meses llevan al bloqueo (CG § 9).",
        rulesPriv:
          "Conozco las reglas de cancelación y ausencia: cancelar con 14 días o más de antelación es gratis. Las cancelaciones posteriores y las ausencias sin emergencia justificada son avisos; 3 en 12 meses llevan al bloqueo del perfil (CG § 9).",
        rulesLink: "Leer CG",
        adult: "Tengo al menos 18 años.",
        adultNeed: "Solo pueden ofrecer servicios mayores de edad. Confirma que tienes al menos 18 años.",
        need: "Elige particular o profesional y confirma los puntos de abajo.",
        sweets: "Tartas, deco y dulces",
        sweetsH: "¿Ofreces tartas, dulces o decoración?",
        sweetsP: "Hay un registro propio con ofertas, fotos y precios. Como particular o empresa.",
        sweetsCake: "Ofrecer tartas y dulces",
        sweetsDeco: "Ofrecer decoración",
        loginNext: "Casi listo: inicia sesión y se creará tu perfil.",
        oneH: "Un perfil para todas tus actuaciones",
        oneP: "En Showly cada persona tiene un solo perfil. Todos los personajes, papeles y actuaciones que ofreces van en ese perfil, ahora o más adelante. La verificación de identidad detecta una segunda cuenta de la misma persona y no se activa.",
        haveH: "Ya tienes un perfil",
        haveP: "Añade nuevos personajes y actuaciones en tu perfil actual. No es posible un segundo perfil.",
        haveBtn: "Ir a mi perfil",
        dupLocal: "Ya existe un perfil para esta persona. Inicia sesión con tu cuenta y añade allí nuevas actuaciones.",
        viaMail: "Correo",
        viaPhone: "Móvil",
        phone: "Número de móvil",
        phonePh: "600 123 456",
        badPhone: "Introduce un móvil válido, p. ej. 600 123 456.",
        cloudAcct: "En el último paso confirmas tu cuenta con un código por SMS a tu móvil o por correo. No necesitas contraseña.",
      },
    }[(lang as "de" | "en" | "es") ?? "de"] ?? null;
  const planner = role === "planner";

  const cats = useMemo(
    () =>
      CATS.filter(
        (c) =>
          c.id !== "all" && (planner ? PLANNER_CATS.includes(c.id) : !PLANNER_CATS.includes(c.id)),
      ),
    [planner],
  );

  const pw = pwScore(form.pw);
  /* Was beim Künstler ankommt: Gage abzüglich 20 % Showly-Gebühr, genau wie
     bei der Auszahlung (pricing.ts, bookingPrice) */
  const net = Math.round(fee * (1 - FEE_RATE));
  const svc = fee - net;

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickRole(r: "artist" | "planner" | "sweets") {
    setRole(r);
    if (r === "sweets") return;
    setFigs([]);
    set("cat", r === "planner" ? "eventplanner" : "fairy");
  }

  function scrollToId(id: string) {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Eine Person, ein Profil (AGB § 3 Abs. 5): Wer schon ein Anbieterprofil
     hat, ergänzt dort weitere Figuren und Acts statt ein zweites anzulegen. */
  const hasProfile = session?.providerId !== undefined && session.role !== "customer";

  function submit() {
    if (form.hp) return;
    if (hasProfile) return toast(RG!.haveP);
    const real = `${form.first} ${form.last}`.trim();
    if (!real || !form.loc.trim()) return toast(t("toast.regNeed"));
    if (!okText(form.desc)) return;
    if (business === null || !rulesOk || !taxOk) return toast(RG!.need);
    if (!privOk) return toast(P.need);
    /* Ohne Datenbank: Zugang über E-Mail oder Handynummer plus Passwort */
    const login = cloud ? "" : loginId(form.email, lang);
    if (!cloud) {
      if (!login || (via === "mail") !== login.includes("@"))
        return toast(via === "mail" ? t("sec.badEmail") : RG!.badPhone);
      if (pw.score < 2) return toast(t("sec.weakPw"));
    }
    const cat = form.cat;
    if (!CATS.some((c) => c.id === cat)) return toast(t("sec.badCat"));
    /* Datensparsamkeit: kein Geburtsdatum, nur die Bestätigung der
       Volljährigkeit. Das Alter prüft die Ausweisprüfung ohnehin. */
    if (!adult) return toast(RG!.adultNeed);
    /* Gage immer pro Stunde. Planer geben den Preis ihres kleinsten Pakets an. */
    const price = parseInt(form.price || "0", 10) || (planner ? 890 : 80);
    const id = Math.max(...ARTISTS.map((a) => a.id)) + 1;
    const catObj = CATS.find((c) => c.id === cat);
    const custom = form.figfree
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);
    const prof = {
      id,
      cat,
      icon: catObj ? catObj.icon : "mask",
      color: "#F1EAFF",
      price: planner ? Math.min(price, 890) : price,
      minHours: 1,
      adultConfirmedAt: new Date().toISOString(),
      rating: 0,
      reviews: 0,
      verified: true,
      superhost: false,
      events: 0,
      responseTime: { de: "48 Std.", en: "48h", es: "48 h" },
      responseRate: "100%",
      shopIds: [],
      name: form.stage || real,
      real,
      figures: [...figs, ...custom],
      loc: form.loc,
      radiusKm: parseInt(form.radius, 10) || DEFAULT_RADIUS_KM,
      exp: { de: "1 Jahr", en: "1 year" },
      desc: form.desc || (planner ? t("reg.plannerOpt") : t("reg.artistOpt")),
      tags: [catLabel(cat)],
      langs: { de: ["Deutsch"], en: ["German"] },
      includes: planner
        ? {
            de: ["Beratung", "Planung", "Koordination"],
            en: ["Consulting", "Planning", "Coordination"],
          }
        : { de: ["Auftritt", "Kostüm", "Musik"], en: ["Performance", "Costume", "Music"] },
      specs: [catLabel(cat)],
      rev: [],
      business,
      rulesAcceptedAt: new Date().toISOString(),
      taxAckAt: new Date().toISOString(),
      ...(planner ? { kind: "planner", packages: defaultPackages() } : {}),
    };
    /* Mit Datenbank: Konto über die echte Anmeldung, Profil legt der Server
       an. Kein Passwort im Browser. Sichtbar wird das Profil nach der
       Ausweisprüfung. */
    if (isBackendConfigured()) {
      queueArtistSignup({
        cat,
        stage: form.stage,
        real,
        loc: form.loc,
        price: prof.price,
        desc: String(prof.desc),
        planner,
        figures: [...figs, ...custom],
        radiusKm: prof.radiusKm,
        adult: true,
        business,
        rulesAcceptedAt: prof.rulesAcceptedAt,
        taxAck: true,
      });
      if (!session?.backend) {
        /* Konto direkt hier bestätigen, per SMS-Code oder E-Mail. Danach legt
           der Store das gemerkte Profil an (pendingArtist). */
        setAcct(true);
        return;
      }
      toast(t("toast.registered"));
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
      return;
    }
    if (localProfileExists(login!, real)) return toast(RG!.dupLocal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ARTISTS.push(prof as any);
    saveArtistProfile(prof);
    saveAccount({
      email: login!,
      pw: form.pw,
      name: real,
      role: planner ? "planner" : "artist",
      providerId: id,
    });
    setSession({
      name: real,
      email: login!,
      role: planner ? "planner" : "artist",
      providerId: id,
    });
    toast(t("toast.registered"));
    setTimeout(() => navigate({ to: "/dashboard" }), 800);
  }

  /* Querbeet durch den Katalog: je ein Act aus möglichst vielen Sparten,
     damit das laufende Band zeigt, wie breit Showly aufgestellt ist. */
  const showcase = useMemo(() => {
    const wanted = [
      "band",
      "superhero",
      "magician",
      "musician",
      "street",
      "dancer",
      "walkingact",
      "acrobat",
      "comedy",
      "clown",
      "facepaint",
      "dj",
      "fairy",
    ];
    return wanted
      .map((c) => ARTISTS.find((a) => a.cat === c))
      .filter((a): a is (typeof ARTISTS)[number] => !!a);
  }, []);

  /* Das Beispielprofil im Kopfbereich ist ein echter Act aus dem Katalog,
     klar als Beispiel beschriftet. */
  const sample = ARTISTS.find((a) => a.cat === "magician") ?? ARTISTS[0]!;

  const benefits: [string, number][] = [
    ["money", 1],
    ["calendar", 2],
    ["mask", 3],
    ["star", 4],
    ["shield", 5],
    ["chart", 6],
  ];

  /* Stand des Reglers als Anteil, für die farbige Spur links vom Knopf */
  const feePct = ((fee - 20) / (500 - 20)) * 100;

  return (
    <div className="page active ui26 join26">
      <section className="home-hero join26-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-pill rise" style={{ ["--d" as string]: "0ms" }}>
              <span className="home-pill-dot" aria-hidden="true" />
              {C.pill}
            </div>
            <h1 className="home-h1 rise" style={{ ["--d" as string]: "70ms" }}>
              {t("become.h1")}
            </h1>
            <p className="home-lead rise" style={{ ["--d" as string]: "140ms" }}>
              {t("become.sub")}
            </p>
            <div className="join26-cta rise" style={{ ["--d" as string]: "210ms" }}>
              <button className="home-btn primary" onClick={() => scrollToId("register-section")}>
                {t("become.cta")}
                <Icon name="arrow" />
              </button>
              <button className="home-btn soft" onClick={() => scrollToId("earn-section")}>
                {C.calc}
              </button>
            </div>
            <ul className="home-trust rise" style={{ ["--d" as string]: "280ms" }}>
              <li>
                <Icon name="check" />
                <span>{C.t1}</span>
              </li>
              <li>
                <Icon name="check" />
                <span>{C.t2}</span>
              </li>
              <li>
                <Icon name="check" />
                <span>{C.t3}</span>
              </li>
            </ul>
          </div>

          {/* Beispiel, wie ein Profil und die ersten Buchungen aussehen.
              Reiner Schmuck, deshalb für Vorlesehilfen ausgeblendet. */}
          <div className="join26-stage" aria-hidden="true">
            <div className="join26-profile">
              <div className="join26-profile-img" style={bgOf(sample)} />
              <div className="join26-profile-body">
                <div className="act-card-row">
                  <b>{String(L(sample.name))}</b>
                  <span className="act-card-new">{t("card.new")}</span>
                </div>
                <span className="join26-profile-meta">
                  {catLabel(sample.cat)} · {String(L(sample.loc))}
                </span>
                <div className="act-card-row">
                  <span className="act-card-price">
                    <b>{fmt(sample.price)}</b> <small>{C.per}</small>
                  </span>
                  <span className="act-card-ok">
                    <Icon name="check" /> {t("card.verified")}
                  </span>
                </div>
              </div>
              <span className="join26-example">{C.example}</span>
            </div>

            <div className="join26-toast t-req">
              <span className="join26-toast-ic violet">
                <Icon name="calendar" />
              </span>
              <span>
                <b>{C.newReq}</b>
                <small>
                  {C.reqMeta} · {fmt(480)}
                </small>
              </span>
            </div>
            <div className="join26-toast t-pay">
              <span className="join26-toast-ic green">
                <Icon name="money" />
              </span>
              <span>
                <b>{C.payout}</b>
                <small>+ {fmt(Math.round(sample.price))}</small>
              </span>
            </div>
            <div className="join26-toast t-cal">
              <span className="join26-toast-ic coral">
                <Icon name="check" />
              </span>
              <span>
                <b>{C.booked}</b>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Laufendes Band mit Beispielprofilen */}
      <section className="join26-faces" aria-label={t("become.facesNote")}>
        <p>{t("become.facesNote")}</p>
        <div className="join26-marquee">
          <div className="join26-marquee-track">
            {[...showcase, ...showcase].map((a, k) => (
              <span className="join26-face" key={a.id + "-" + k} aria-hidden={k >= showcase.length}>
                <span className="join26-face-img" style={bgOf(a, "center 30%")} />
                <span>
                  <b>{String(L(a.name))}</b>
                  <small>{catLabel(a.cat)}</small>
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="home-how join26-benefits">
        <div className="home-how-inner">
          <div className="home-sec-head" data-reveal>
            <span className="home-eyebrow">{t("become.benefitsEyebrow")}</span>
            <h2>{t("become.benefitsH2")}</h2>
            <p>{t("become.benefitsSub")}</p>
          </div>
          <div className="join26-bento reveal-stagger">
            {benefits.map(([ico, n]) => (
              <div className={"join26-tile" + (n === 1 ? " big" : "")} key={n}>
                <span className="join26-tile-ic">
                  <Icon name={ico} />
                </span>
                <h3>{t(`become.c${n}t`)}</h3>
                <p>
                  {t(`become.c${n}p`)}{" "}
                  {n === 3 && (
                    <button className="join26-link" onClick={() => navigate({ to: "/shop" })}>
                      {t("become.c3link")} <Icon name="arrow" />
                    </button>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="join26-earn" id="earn-section">
        <div className="join26-earn-card" data-reveal>
          <div className="join26-earn-text">
            <span className="home-eyebrow on-dark">{t("earn.eyebrow")}</span>
            <h2>{t("earn.h2")}</h2>
            <p>{t("earn.sub")}</p>
            <p className="join26-earn-how">
              <Icon name="sparkle" /> <strong>{t("earn.howT")}</strong> {t("earn.howP")}
            </p>
          </div>
          <div className="join26-calc">
            <label className="join26-calc-lbl" htmlFor="fee-range">
              {t("earn.yourFee")}
            </label>
            <div className="join26-calc-fee">{fmt(fee)}</div>
            <input
              id="fee-range"
              className="join26-range"
              type="range"
              min={20}
              max={500}
              step={5}
              value={fee}
              onChange={(e) => setFee(parseInt(e.target.value, 10))}
              style={{ ["--pct" as string]: feePct + "%" }}
            />
            <div className="join26-range-scale">
              <span>{fmt(20)}</span>
              <span>{fmt(500)}</span>
            </div>
            <div className="join26-calc-split">
              <div className="join26-calc-box">
                <small>{t("earn.clientPays")}</small>
                <b>− {fmt(svc)}</b>
                <span>{t("earn.note", { p: fmt(fee) })}</span>
              </div>
              <div className="join26-calc-box you">
                <small>{t("earn.youGet")}</small>
                <b>{fmt(net)}</b>
                <span>{t("earn.hundred")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="join26-register" id="register-section">
        <div className="join26-register-inner">
          <aside className="join26-register-side" data-reveal>
            <span className="home-eyebrow">{t("become.eyebrow")}</span>
            <h2>{planner ? t("reg.h2P") : t("reg.h2")}</h2>
            <p>{planner ? t("reg.subP") : t("reg.sub")}</p>
            <h3>{C.formH}</h3>
            <ul>
              {C.formL.map((x) => (
                <li key={x}>
                  <Icon name="check" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="register-form join26-form">
            <div className="join26-form-q">{t("reg.roleQ")}</div>
            <div className="join26-seg" role="group" aria-label={t("reg.roleQ")}>
              <button
                className={"join26-seg-btn" + (!planner ? " on" : "")}
                aria-pressed={!planner}
                onClick={() => pickRole("artist")}
              >
                <Icon name="mask" />
                <span>{t("reg.artistOpt")}</span>
              </button>
              <button
                className={"join26-seg-btn" + (planner ? " on" : "")}
                aria-pressed={planner}
                onClick={() => pickRole("planner")}
              >
                <Icon name="eventplanner" />
                <span>{t("reg.plannerOpt")}</span>
              </button>
              <button
                className={"join26-seg-btn" + (role === "sweets" ? " on" : "")}
                aria-pressed={role === "sweets"}
                onClick={() => pickRole("sweets")}
              >
                <Icon name="gift" />
                <span>{RG!.sweets}</span>
              </button>
            </div>
            {role !== "sweets" &&
              (hasProfile ? (
                <div className="join26-one have" role="status">
                  <Icon name="shield" />
                  <div>
                    <b>{RG!.haveH}</b>
                    <p>{RG!.haveP}</p>
                    <Link to="/dashboard" className="home-btn primary">
                      {RG!.haveBtn}
                      <Icon name="arrow" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="join26-one">
                  <Icon name="mask" />
                  <div>
                    <b>{RG!.oneH}</b>
                    <p>{RG!.oneP}</p>
                  </div>
                </div>
              ))}
            {role === "sweets" ? (
              <div className="join26-sweets">
                <h3>{RG!.sweetsH}</h3>
                <p>{RG!.sweetsP}</p>
                <Link to="/torten/anbieten" className="home-btn primary wide">
                  {RG!.sweetsCake}
                  <Icon name="arrow" />
                </Link>
                <Link to="/shop" search={{ bereich: "deko", anbieten: 1 }} className="home-btn ghost wide">
                  {RG!.sweetsDeco}
                  <Icon name="arrow" />
                </Link>
                <TaxNotice compact />
              </div>
            ) : hasProfile ? null : (
            <>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="reg-first">{t("reg.first")}</label>
                <input
                  id="reg-first"
                  type="text"
                  placeholder="Maria"
                  value={form.first}
                  onChange={(e) => set("first", e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="reg-last">{t("reg.last")}</label>
                <input
                  id="reg-last"
                  type="text"
                  placeholder="Müller"
                  value={form.last}
                  onChange={(e) => set("last", e.target.value)}
                />
              </div>
            </div>
            {cloud ? (
              !session?.backend && (
                <p className="join26-acct">
                  <Icon name="lock" /> {RG!.cloudAcct}
                </p>
              )
            ) : (
            <>
            <div className="konto-tabs join26-via" role="tablist">
              {(["mail", "phone"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={via === v}
                  className={"konto-tab" + (via === v ? " on" : "")}
                  onClick={() => {
                    setVia(v);
                    set("email", "");
                  }}
                >
                  {v === "mail" ? RG!.viaMail : RG!.viaPhone}
                </button>
              ))}
            </div>
            <div className="input-group">
              <label htmlFor="reg-email">{via === "mail" ? t("reg.email") : RG!.phone}</label>
              <input
                id="reg-email"
                type={via === "mail" ? "email" : "tel"}
                inputMode={via === "mail" ? "email" : "tel"}
                maxLength={254}
                autoComplete={via === "mail" ? "email" : "tel"}
                placeholder={via === "mail" ? "maria@mail.com" : RG!.phonePh}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-pw">{t("reg.pw")}</label>
              <input
                id="reg-pw"
                type="password"
                maxLength={128}
                autoComplete="new-password"
                placeholder={t("reg.pwph")}
                value={form.pw}
                onChange={(e) => set("pw", e.target.value)}
              />
              <div className="pw-meter" aria-hidden="true">
                {[0, 1, 2, 3].map((k) => (
                  <i
                    className={"pw-seg" + (form.pw && k < pw.score ? " on" + pw.score : "")}
                    key={k}
                  />
                ))}
              </div>
              <div className="pw-lbl" role="status" aria-live="polite">
                {form.pw
                  ? `${t("sec.pwLabel")}: ${lang === "de" ? pw.de : lang === "es" ? pw.es : pw.en}`
                  : ""}
              </div>
            </div>
            </>
            )}
            <label className="reg-check">
              <input id="reg-adult" type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>{RG!.adult}</span>
            </label>
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="reg-hp">Bitte leer lassen</label>
              <input
                id="reg-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.hp}
                onChange={(e) => set("hp", e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-cat">{planner ? t("reg.plannerCat") : t("reg.cat")}</label>
              <select
                id="reg-cat"
                value={form.cat}
                onChange={(e) => {
                  set("cat", e.target.value);
                  setFigs([]);
                }}
              >
                {cats.map((c) => (
                  <option value={c.id} key={c.id}>
                    {catLabel(c.id)}
                  </option>
                ))}
              </select>
            </div>
            {!planner && (
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="reg-stage">{t("fig.stage")}</label>
                  <input
                    id="reg-stage"
                    type="text"
                    placeholder={t("fig.stagePh")}
                    value={form.stage}
                    onChange={(e) => set("stage", e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="reg-figfree">{t("fig.custom")}</label>
                  <input
                    id="reg-figfree"
                    type="text"
                    placeholder={t("fig.customPh")}
                    value={form.figfree}
                    onChange={(e) => set("figfree", e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="reg-loc">{t("reg.loc")}</label>
                {/* Ortsvorschläge statt freiem Tippen: verhindert Schreibfehler,
                    nach denen das Profil in der Ortssuche nicht auftaucht. */}
                <CityAutocomplete
                  id="reg-loc"
                  value={form.loc}
                  onChange={(v) => set("loc", v)}
                  placeholder={t("reg.locph")}
                  showScopeToggle={false}
                />
              </div>
              <div className="input-group">
                <label htmlFor="reg-radius">{t("reg.radius")}</label>
                <select
                  id="reg-radius"
                  value={form.radius}
                  onChange={(e) => set("radius", e.target.value)}
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>
                      {travelOption(km, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="reg-price">{t("reg.price")}</label>
                <input
                  id="reg-price"
                  type="number"
                  min={0}
                  step={10}
                  placeholder={planner ? "890" : "80"}
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="reg-desc">{t("reg.desc")}</label>
              <textarea
                id="reg-desc"
                rows={3}
                placeholder={t("reg.descph")}
                value={form.desc}
                onChange={(e) => set("desc", e.target.value)}
              />
              <ContactHint text={form.desc} />
            </div>
            {planner && (
              <div className="join26-hint">
                <Icon name="gift" /> {t("reg.pkgHint")}
              </div>
            )}
            <StatusChoice value={business} onChange={setBusiness} />
            <label className="reg-check">
              <input
                id="reg-rules"
                type="checkbox"
                checked={rulesOk}
                onChange={(e) => setRulesOk(e.target.checked)}
              />
              <span>
                {business === false ? RG!.rulesPriv : RG!.rules}{" "}
                <Link
                  to="/rechtliches/$doc"
                  params={{ doc: "terms" }}
                  target="_blank"
                >
                  {RG!.rulesLink}
                </Link>
              </span>
            </label>
            <TaxNotice compact />
            <TaxAck checked={taxOk} onChange={setTaxOk} />
            <PrivacyAck checked={privOk} onChange={setPrivOk} id="reg-privacy" />
            {acct && (
              <AccountStep
                onClose={() => setAcct(false)}
                onDone={() => {
                  setAcct(false);
                  toast(t("toast.registered"));
                  setTimeout(() => navigate({ to: "/dashboard" }), 800);
                }}
              />
            )}
            <button className="home-btn primary wide" onClick={submit}>
              {planner ? t("reg.btnP") : t("reg.btn")}
              <Icon name="arrow" />
            </button>
            <div className="join26-terms">{t("reg.terms")}</div>
            </>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
