import { seoHead } from "@/showly/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ARTISTS, CATS } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, bgOf } from "@/showly/ui";
import { defaultPackages, pwScore } from "@/showly/figures";
import { Footer } from "@/components/showly/Footer";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS, travelOption } from "@/showly/travel";
import { saveArtistProfile, saveAccount } from "@/showly/persist";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";

export const Route = createFileRoute("/mitmachen")({
  head: () => seoHead("/mitmachen", "/mitmachen"),
  component: Become,
});

const PLANNER_CATS = ["eventplanner", "weddingplanner"];

/* Texte, die es nur im neuen Aufbau dieser Seite gibt. */
const COPY = {
  de: {
    pill: "Für Künstler · kostenlos starten",
    calc: "Verdienst berechnen",
    t1: "0 € Anmeldung",
    t2: "100 % deiner Gage",
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
    t2: "100% of your fee",
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
    t2: "100 % de tu caché",
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
  const { t, lang, fmt, num, toast, setSession, catLabel, L } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [role, setRole] = useState<"artist" | "planner">("artist");
  const [fee, setFee] = useState(80);
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    pw: "",
    hp: "",
    birth: "",
    cat: "fairy",
    stage: "",
    figfree: "",
    loc: "",
    radius: String(DEFAULT_RADIUS_KM),
    price: "",
    desc: "",
  });
  const [figs, setFigs] = useState<string[]>([]);
  /* Pflichtangaben für die Regeln zu Absage und Nichterscheinen (AGB §§ 9,
     18): Vertragsstrafen in AGB sind nur gegenüber Unternehmern zulässig,
     und die Klausel soll nicht im Kleingedruckten verschwinden. */
  const [business, setBusiness] = useState(false);
  const [rulesOk, setRulesOk] = useState(false);
  const RG =
    {
      de: {
        business:
          "Ich trete gewerblich oder selbständig auf (nicht nur als Hobby).",
        rules:
          "Ich kenne die Regeln bei Absage und Nichterscheinen: Absage bis 24 Stunden vorher ohne Folgen, danach 50 % der Gage als Vertragsstrafe, bei Nichterscheinen 100 %, außer bei einem belegten Notfall (AGB § 9).",
        rulesLink: "AGB lesen",
        need: "Bitte bestätige die beiden Punkte unten.",
      },
      en: {
        business:
          "I perform on a commercial or self-employed basis (not just as a hobby).",
        rules:
          "I know the rules for cancellations and no-shows: cancel up to 24 hours before without consequences, after that a penalty of 50% of the fee, 100% for a no-show, unless there is a proven emergency (T&C § 9).",
        rulesLink: "Read T&C",
        need: "Please confirm the two points below.",
      },
      es: {
        business:
          "Actúo de forma profesional o como autónomo (no solo como afición).",
        rules:
          "Conozco las reglas de cancelación y ausencia: cancelar hasta 24 horas antes sin consecuencias; después, penalización del 50 % del caché y del 100 % si no me presento, salvo emergencia justificada (CG § 9).",
        rulesLink: "Leer CG",
        need: "Confirma los dos puntos de abajo.",
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
  const svc = Math.round(fee * 0.2);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickRole(r: "artist" | "planner") {
    setRole(r);
    setFigs([]);
    set("cat", r === "planner" ? "eventplanner" : "fairy");
  }

  function scrollToId(id: string) {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit() {
    if (form.hp) return;
    const real = `${form.first} ${form.last}`.trim();
    if (!real || !form.loc.trim()) return toast(t("toast.regNeed"));
    if (!okText(form.desc)) return;
    if (!business || !rulesOk) return toast(RG!.need);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return toast(t("sec.badEmail"));
    if (pw.score < 2) return toast(t("sec.weakPw"));
    const cat = form.cat;
    if (!CATS.some((c) => c.id === cat)) return toast(t("sec.badCat"));
    /* Geburtsdatum: Pflicht, liegt in der Vergangenheit und ergibt ein
       plausibles Alter. Es lässt sich später nicht mehr selbst ändern, weil
       es mit dem Ausweis abgeglichen wird. */
    const born = form.birth ? new Date(form.birth + "T00:00:00") : null;
    const age = born ? (Date.now() - born.getTime()) / (365.25 * 86_400_000) : NaN;
    if (!born || Number.isNaN(age) || age < 0 || age > 110) return toast(t("reg.birthNeed"));
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
      birthDate: form.birth,
      rating: 0,
      reviews: 0,
      verified: true,
      superhost: false,
      events: 0,
      responseTime: { de: "1 Std.", en: "1h" },
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
      business: true,
      rulesAcceptedAt: new Date().toISOString(),
      ...(planner ? { kind: "planner", packages: defaultPackages() } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ARTISTS.push(prof as any);
    saveArtistProfile(prof);
    saveAccount({
      email: form.email,
      pw: form.pw,
      name: real,
      role: planner ? "planner" : "artist",
      providerId: id,
    });
    setSession({
      name: real,
      email: form.email,
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
                  <span className="act-card-rating">
                    <span className="star">★</span>
                    {num(sample.rating)}
                  </span>
                </div>
                <span className="join26-profile-meta">
                  {catLabel(sample.cat)} · {String(L(sample.loc))}
                </span>
                <div className="act-card-row">
                  <span className="act-card-price">
                    <b>{fmt(Math.round(sample.price * 1.2))}</b> <small>{C.per}</small>
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

      {/* Laufendes Band mit Acts, die schon dabei sind */}
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
                <b>{fmt(fee + svc)}</b>
                <span>{t("earn.note", { p: fmt(fee), f: fmt(svc) })}</span>
              </div>
              <div className="join26-calc-box you">
                <small>{t("earn.youGet")}</small>
                <b>{fmt(fee)}</b>
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
            </div>
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
            <div className="input-group">
              <label htmlFor="reg-email">{t("reg.email")}</label>
              <input
                id="reg-email"
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="maria@mail.com"
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
            <div className="input-group">
              <label htmlFor="reg-birth">{t("reg.birth")}</label>
              <input
                id="reg-birth"
                type="date"
                autoComplete="bday"
                max={new Date().toISOString().slice(0, 10)}
                value={form.birth}
                onChange={(e) => set("birth", e.target.value)}
              />
              <div className="join26-fieldnote">
                <Icon name="lock" /> {t("reg.birthNote")}
              </div>
            </div>
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
            <label className="reg-check">
              <input
                id="reg-business"
                type="checkbox"
                checked={business}
                onChange={(e) => setBusiness(e.target.checked)}
              />
              <span>{RG!.business}</span>
            </label>
            <label className="reg-check">
              <input
                id="reg-rules"
                type="checkbox"
                checked={rulesOk}
                onChange={(e) => setRulesOk(e.target.checked)}
              />
              <span>
                {RG!.rules}{" "}
                <Link
                  to="/rechtliches/$doc"
                  params={{ doc: "terms" }}
                  target="_blank"
                >
                  {RG!.rulesLink}
                </Link>
              </span>
            </label>
            <button className="home-btn primary wide" onClick={submit}>
              {planner ? t("reg.btnP") : t("reg.btn")}
              <Icon name="arrow" />
            </button>
            <div className="join26-terms">{t("reg.terms")}</div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
