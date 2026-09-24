import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearSpotlight,
  citySlug,
  daysLeft,
  getSpotlightFor,
  listClickStats,
  listSpotlightsOf,
  subscribeSpotlights,
  type Spotlight,
} from "@/showly/spotlight";
import { useViewerCity } from "@/showly/useViewerCity";
import {
  allCities,
  customCities,
  hiddenCities,
  knownCountries,
  removeCity,
  restoreCity,
  saveCity,
  subscribeCities,
  type CityEntry,
} from "@/showly/cities";

import { seoHead } from "@/showly/seo";
import { useShowly } from "@/showly/store";
import { ARTISTS } from "@/showly/data";
import { Icon, SLOTS, todayISO } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { IncomingBookings } from "@/components/showly/IncomingBookings";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { IdentityCheck } from "@/components/showly/IdentityCheck";
import { updateArtistProfile, findAccount } from "@/showly/persist";
import stageImg from "@/assets/spotlight-stage.jpg";

export const Route = createFileRoute("/portal")({
  head: () => seoHead("/portal", "/portal"),
  component: Portal,
});

const COPY = {
  de: {
    h1: "Künstler-Portal",
    sub: "Deine Buchungen, dein Profil, deine freien Termine – alles an einem Ort.",
    tabB: "Buchungen",
    tabP: "Profil",
    tabA: "Verfügbarkeit",
    logout: "Abmelden",
    none: "Noch keine Buchungen.",
    edit: "Bearbeiten",
    cancel: "Absagen",
    save: "Speichern",
    close: "Schließen",
    date: "Datum",
    slot: "Uhrzeit",
    figure: "Figur",
    amount: "Preis (€)",
    status: "Status",
    saved: "Gespeichert ✓",
    cancelled: "Buchung abgesagt",
    confirmCancel: "Diese Buchung wirklich absagen?",
    name: "Künstlername",
    desc: "Beschreibung",
    price: "Stundengage (€ pro Stunde)",
    loc: "Ort",
    availH: "Termine sperren",
    availP: "Angeklickte Zeiten sind für Kunden nicht mehr buchbar.",
    guardH: "Nur für Künstler",
    guardP: "Melde dich als Künstler an oder registriere dich, um dein Portal zu sehen.",
    guardBtn: "Als Künstler starten",
    noSlot: "Nach Absprache",
    loginH: "Im Portal anmelden",
    loginP: "Melde dich mit deiner E-Mail und deinem Passwort an.",
    email: "E-Mail",
    pw: "Passwort",
    loginBtn: "Anmelden",
    badLogin: "E-Mail oder Passwort stimmt nicht.",
    noAcc: "Noch kein Konto?",
    acts: "Meine Acts",
    actsP: "Trage hier ein, als welche Figuren du auftrittst.",
    actAdd: "Act hinzufügen",
    actPh: "z. B. Zauberer Merlin",
    remove: "Entfernen",
    tabT: "Act-Verwaltung",
    topH: "Top Act der Woche",
    topP: "Wähle einen Act aus deiner Liste. Nach der Bezahlung von 99 € steht er 7 Tage lang als Top Act der Woche auf der Startseite.",
    topSet: "Top Act buchen · 99 €",
    topActive: "Ist Top Act",
    topClear: "Top Act entfernen",
    topDays: (n: number) => (n === 1 ? "noch 1 Tag online" : `noch ${n} Tage online`),
    topNone: "Trage zuerst im Profil deine Acts ein.",
    topDone: "Top Act der Woche gesetzt ✓",
    topCity: (c: string) => `Gilt nur für ${c} und Umgebung – jede Stadt hat ihren eigenen Top Act.`,
    rankH: "Live-Ranking deiner Acts",
    rankP: "Sortiert nach Buchungen – der Act mit den meisten Buchungen steht oben.",
    rankB: (n: number) => (n === 1 ? "1 Buchung" : `${n} Buchungen`),
    rankRev: "Umsatz",
    cityH: "Stadt & Umgebung",
    cityP: "Wähle die Stadt, für die dein Act oben stehen soll. Jede Stadt hat ihren eigenen Top Act.",
    cityPh: "Stadt eingeben",
    cityUse: "Standort verwenden",
    cityDenied: "Kein Standort freigegeben – bitte Stadt aus der Liste wählen.",
    mineH: "Deine Platzierungen",
    mineNone: "Noch keine Stadt gebucht.",
    clicks: (n: number) => (n === 1 ? "1 Klick" : `${n} Klicks`),
    clicksH: "Klicks pro Stadt",
    clicksP: "So oft wurde deine Top-Act-Kachel angeklickt.",
    setIn: (c: string) => `Top Act in ${c}`,
    tabC: "Städte",
    dbH: "Städte-Datenbank",
    dbP: "Lege eigene Städte an oder bearbeite sie – sie stehen sofort überall zur Auswahl.",
    dbName: "Stadt",
    dbCountry: "Land (z. B. de)",
    dbRegion: "Region / Umgebung",
    dbAdd: "Stadt speichern",
    dbOwn: "Eigene Städte",
    dbAll: "Alle Städte",
    dbNone: "Noch keine eigene Stadt angelegt.",
    dbHidden: "Ausgeblendet",
    dbRestore: "Wiederherstellen",
    dbSaved: "Stadt gespeichert ✓",
    dbUse: "Für Top Act nutzen",
  },

  en: {
    h1: "Artist portal",
    sub: "Your bookings, your profile, your open dates – all in one place.",
    tabB: "Bookings",
    tabP: "Profile",
    tabA: "Availability",
    logout: "Sign out",
    none: "No bookings yet.",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    date: "Date",
    slot: "Time",
    figure: "Character",
    amount: "Price (€)",
    status: "Status",
    saved: "Saved ✓",
    cancelled: "Booking cancelled",
    confirmCancel: "Really cancel this booking?",
    name: "Stage name",
    desc: "Description",
    price: "Hourly fee (€ per hour)",
    loc: "Location",
    availH: "Block dates",
    availP: "Times you select are no longer bookable for customers.",
    guardH: "Artists only",
    guardP: "Sign in as an artist or register to open your portal.",
    guardBtn: "Start as an artist",
    noSlot: "On request",
    loginH: "Sign in to the portal",
    loginP: "Sign in with your email and password.",
    email: "Email",
    pw: "Password",
    loginBtn: "Sign in",
    badLogin: "Email or password is incorrect.",
    noAcc: "No account yet?",
    acts: "My acts",
    actsP: "Add the characters you perform as.",
    actAdd: "Add act",
    actPh: "e.g. Merlin the magician",
    remove: "Remove",
    tabT: "Act manager",
    topH: "Top act of the week",
    topP: "Pick an act from your list. After paying €99 it appears as top act of the week on the homepage for 7 days.",
    topSet: "Book top act · €99",
    topActive: "Is top act",
    topClear: "Remove top act",
    topDays: (n: number) => (n === 1 ? "1 day left online" : `${n} days left online`),
    topNone: "Add your acts in the profile tab first.",
    topDone: "Top act of the week set ✓",
    topCity: (c: string) => `Applies to ${c} and nearby only – every city has its own top act.`,
    rankH: "Live ranking of your acts",
    rankP: "Sorted by bookings – the act with the most bookings comes first.",
    rankB: (n: number) => (n === 1 ? "1 booking" : `${n} bookings`),
    rankRev: "Revenue",
    cityH: "City & surroundings",
    cityP: "Choose the city where your act should be on top. Every city has its own top act.",
    cityPh: "Enter a city",
    cityUse: "Use my location",
    cityDenied: "No location access – pick your city from the list.",
    mineH: "Your placements",
    mineNone: "No city booked yet.",
    clicks: (n: number) => (n === 1 ? "1 click" : `${n} clicks`),
    clicksH: "Clicks per city",
    clicksP: "How often your top act card was clicked.",
    setIn: (c: string) => `Top act in ${c}`,
    tabC: "Cities",
    dbH: "City database",
    dbP: "Create or edit your own cities – they are instantly available everywhere.",
    dbName: "City",
    dbCountry: "Country (e.g. gb)",
    dbRegion: "Region / area",
    dbAdd: "Save city",
    dbOwn: "Your cities",
    dbAll: "All cities",
    dbNone: "No custom city yet.",
    dbHidden: "Hidden",
    dbRestore: "Restore",
    dbSaved: "City saved ✓",
    dbUse: "Use for top act",
  },

  es: {
    h1: "Portal de artistas",
    sub: "Tus reservas, tu perfil, tus fechas libres – todo en un lugar.",
    tabB: "Reservas",
    tabP: "Perfil",
    tabA: "Disponibilidad",
    logout: "Cerrar sesión",
    none: "Todavía no hay reservas.",
    edit: "Editar",
    cancel: "Cancelar",
    save: "Guardar",
    close: "Cerrar",
    date: "Fecha",
    slot: "Hora",
    figure: "Personaje",
    amount: "Precio (€)",
    status: "Estado",
    saved: "Guardado ✓",
    cancelled: "Reserva cancelada",
    confirmCancel: "¿Cancelar esta reserva?",
    name: "Nombre artístico",
    desc: "Descripción",
    price: "Caché por hora (€ por hora)",
    loc: "Lugar",
    availH: "Bloquear fechas",
    availP: "Las horas seleccionadas dejan de estar disponibles.",
    guardH: "Solo para artistas",
    guardP: "Inicia sesión como artista o regístrate para abrir tu portal.",
    guardBtn: "Empezar como artista",
    noSlot: "A convenir",
    loginH: "Entrar al portal",
    loginP: "Inicia sesión con tu correo y contraseña.",
    email: "Correo",
    pw: "Contraseña",
    loginBtn: "Entrar",
    badLogin: "Correo o contraseña incorrectos.",
    noAcc: "¿Aún no tienes cuenta?",
    acts: "Mis actuaciones",
    actsP: "Añade los personajes que interpretas.",
    actAdd: "Añadir",
    actPh: "p. ej. el mago Merlín",
    remove: "Quitar",
    tabT: "Gestión de actuaciones",
    topH: "Top act de la semana",
    topP: "Elige una actuación de tu lista. Tras pagar 99 € aparecerá 7 días como top act de la semana en la portada.",
    topSet: "Reservar top act · 99 €",
    topActive: "Es top act",
    topClear: "Quitar top act",
    topDays: (n: number) => (n === 1 ? "queda 1 día online" : `quedan ${n} días online`),
    topNone: "Añade primero tus actuaciones en el perfil.",
    topDone: "Top act de la semana fijado ✓",
    topCity: (c: string) => `Solo para ${c} y alrededores: cada ciudad tiene su top act.`,
    rankH: "Ranking en vivo de tus actuaciones",
    rankP: "Ordenado por reservas: la actuación con más reservas va primero.",
    rankB: (n: number) => (n === 1 ? "1 reserva" : `${n} reservas`),
    rankRev: "Ingresos",
    cityH: "Ciudad y alrededores",
    cityP: "Elige la ciudad donde tu actuación estará arriba. Cada ciudad tiene su top act.",
    cityPh: "Escribe una ciudad",
    cityUse: "Usar mi ubicación",
    cityDenied: "Sin acceso a la ubicación: elige tu ciudad de la lista.",
    mineH: "Tus colocaciones",
    mineNone: "Aún no has reservado ninguna ciudad.",
    clicks: (n: number) => (n === 1 ? "1 clic" : `${n} clics`),
    clicksH: "Clics por ciudad",
    clicksP: "Cuántas veces se ha pulsado tu tarjeta de top act.",
    setIn: (c: string) => `Top act en ${c}`,
    tabC: "Ciudades",
    dbH: "Base de datos de ciudades",
    dbP: "Crea o edita tus propias ciudades: estarán disponibles al instante.",
    dbName: "Ciudad",
    dbCountry: "País (p. ej. es)",
    dbRegion: "Región / alrededores",
    dbAdd: "Guardar ciudad",
    dbOwn: "Tus ciudades",
    dbAll: "Todas las ciudades",
    dbNone: "Aún no has creado ninguna ciudad.",
    dbHidden: "Ocultas",
    dbRestore: "Restaurar",
    dbSaved: "Ciudad guardada ✓",
    dbUse: "Usar para el top act",
  },

} as const;

function nextDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + i);
    out.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

function Portal() {
  const {
    lang,
    L,
    fmt,
    fmtDate,
    session,
    setSession,
    bookings,
    updateBooking,
    cancelBooking,
    bookedSlots,
    toggleBlock,
    toast,
  } = useShowly();
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [tab, setTab] = useState<"b" | "p" | "a" | "t" | "c">("b");
  const [cityDb, setCityDb] = useState<{ own: CityEntry[]; all: CityEntry[]; hidden: string[] }>({
    own: [],
    all: [],
    hidden: [],
  });
  const [cityForm, setCityForm] = useState({ id: "", name: "", country: "de", region: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [login, setLogin] = useState({ email: "", pw: "" });
  const [actInput, setActInput] = useState("");
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [mySpots, setMySpots] = useState<Spotlight[]>([]);
  const [stats, setStats] = useState<{ city: string; act: string; clicks: number }[]>([]);

  const pid = session?.providerId ?? -1;
  const isArtist = !!session && (session.role === "artist" || session.role === "planner");
  const profile = useMemo(() => ARTISTS.find((a: any) => a.id === pid), [pid]);

  const viewer = useViewerCity();
  const [targetCity, setTargetCity] = useState("");

  const profileCity = String((profile as any)?.loc ?? "");
  useEffect(() => {
    if (!targetCity) setTargetCity(profileCity || viewer.city || "");
  }, [profileCity, viewer.city, targetCity]);

  const refreshSpots = useCallback(() => {
    setSpot(getSpotlightFor(targetCity || profileCity));
    const own = listSpotlightsOf(session?.email ?? "", `/kuenstler/${pid}`);
    setMySpots(own);
    const keys = new Set(own.map((s) => citySlug(s.city)));
    setStats(listClickStats().filter((c) => keys.has(citySlug(c.city))));
  }, [targetCity, profileCity, session?.email, pid]);

  useEffect(() => {
    refreshSpots();
    return subscribeSpotlights(refreshSpots);
  }, [refreshSpots]);

  const refreshCities = useCallback(() => {
    setCityDb({ own: customCities(), all: allCities(), hidden: hiddenCities() });
  }, []);

  useEffect(() => {
    refreshCities();
    return subscribeCities(refreshCities);
  }, [refreshCities]);

  const mine = useMemo(
    () =>
      bookings
        .filter((b) => b.artistId === pid)
        .slice()
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [bookings, pid],
  );

  const [prof, setProf] = useState(() => ({
    name: (profile as any)?.name ?? "",
    desc: (profile as any)?.desc ?? "",
    price: String((profile as any)?.price ?? ""),
    loc: (profile as any)?.loc ?? "",
    figures: (((profile as any)?.figures ?? []) as string[]).slice(),
  }));

  // Live-Ranking: Acts nach Anzahl Buchungen (dann Umsatz, dann Name)
  const ranked = useMemo(() => {
    const stats = new Map<string, { count: number; revenue: number }>();
    for (const f of prof.figures) stats.set(f, { count: 0, revenue: 0 });
    for (const b of mine) {
      const key = (b.figure ?? "").trim();
      if (!key) continue;
      const hit = stats.get(key);
      if (hit) {
        hit.count += 1;
        hit.revenue += b.amount || 0;
      }
    }
    return prof.figures
      .map((f) => ({ act: f, ...(stats.get(f) ?? { count: 0, revenue: 0 }) }))
      .sort(
        (a, b) =>
          b.count - a.count || b.revenue - a.revenue || a.act.localeCompare(b.act),
      );
  }, [prof.figures, mine]);


  function doLogin() {
    const acc = findAccount(login.email, login.pw);
    if (!acc) return toast(T.badLogin);
    setSession({
      name: acc.name,
      email: acc.email,
      role: acc.role,
      ...(acc.providerId !== undefined ? { providerId: acc.providerId } : {}),
    });
    toast(T.loginBtn + " ✓");
  }

  if (!isArtist) {
    return (
      <div className="page active">
        <div className="portal-guard">
          <h1>{T.loginH}</h1>
          <p>{T.loginP}</p>
          <div className="portal-form" style={{ maxWidth: 380, margin: "0 auto", textAlign: "left" }}>
            <label>
              {T.email}
              <input
                type="email"
                autoComplete="email"
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
              />
            </label>
            <label>
              {T.pw}
              <input
                type="password"
                autoComplete="current-password"
                value={login.pw}
                onChange={(e) => setLogin({ ...login, pw: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
              />
            </label>
            <button className="btn-primary" onClick={doLogin}>
              {T.loginBtn}
            </button>
          </div>
          <p style={{ marginTop: 18 }}>
            {T.noAcc}{" "}
            <Link className="inline-link" to="/mitmachen">
              {T.guardBtn}
            </Link>
          </p>
        </div>
        <Footer />
      </div>
    );
  }


  function saveProfile() {
    const patch = {
      name: prof.name,
      desc: prof.desc,
      price: Number(prof.price) || (profile as any)?.price || 0,
      loc: prof.loc,
      figures: prof.figures,
    };
    updateArtistProfile(pid, patch);
    toast(T.saved);
  }

  /* Top Act der Woche gibt es nur gegen Bezahlung (99 € für 7 Tage).
     Früher schaltete dieser Knopf den Platz sofort frei, ohne Zahlung. Jetzt
     führt er zur Buchungsseite, mit Act, Sparte, Stadt und Profil schon
     ausgefüllt. Freigeschaltet wird erst, wenn die Zahlung beim
     Zahlungsanbieter bestätigt ist (checkout_.return.tsx). */
  function setTop(act: string) {
    const city = (targetCity || String(L(prof.loc) || "")).trim();
    if (!city) return toast(T.cityPh);
    navigate({
      to: "/top-act",
      search: {
        city,
        name: act,
        cat: String((profile as any)?.cat ?? ""),
        link: `/kuenstler/${pid}`,
      } as any,
    });
  }

  function logout() {
    setSession(null);
    navigate({ to: "/" });
  }

  return (
    <div className="page active">
      <section className="portal-head">
        <div>
          <h1>{T.h1}</h1>
          <p>{T.sub}</p>
        </div>
        <button className="action-btn" onClick={logout}>
          <Icon name="street" /> <span>{T.logout}</span>
        </button>
      </section>

      {/* Ausweispruefung: steht bewusst ganz oben, weil ohne Siegel
          deutlich weniger gebucht wird. */}
      <section className="portal-body">
        <IdentityCheck />
      </section>

      <div className="portal-tabs">
        {([
          ["b", T.tabB],
          ["t", T.tabT],
          ["c", T.tabC],
          ["p", T.tabP],
          ["a", T.tabA],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            className={"portal-tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "t" && (
        <div className="portal-body">
          <h2 className="portal-h2">{T.cityH}</h2>
          <p className="portal-empty">{T.cityP}</p>
          <div className="portal-city">
            {/* Vorher eine einfache Vorschlagsliste aus wenigen Städten.
                Jetzt dieselbe Ortssuche wie auf der Startseite. */}
            <CityAutocomplete
              value={targetCity}
              onChange={setTargetCity}
              placeholder={T.cityPh}
              showScopeToggle={false}
            />
            <datalist id="portal-city-list">
              {viewer.cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              className="action-btn"
              onClick={() =>
                viewer.askLocation().then((c) => {
                  if (c) setTargetCity(c);
                  else toast(T.cityDenied);
                })
              }
            >
              <Icon name="pin" /> <span>{T.cityUse}</span>
            </button>
          </div>
          {viewer.needsPick && <p className="portal-empty">{T.cityDenied}</p>}

          {mySpots.length > 0 && (
            <>
              <h2 className="portal-h2">{T.mineH}</h2>
              <div className="portal-acts">
                {mySpots.map((s) => (
                  <div className="portal-act" key={s.city + s.name}>
                    <div className="portal-act-info">
                      <strong>{T.setIn(s.city)}</strong>
                      <span>
                        {[
                          s.name,
                          T.topDays(daysLeft(s)),
                          T.clicks(
                            stats
                              .filter((c) => citySlug(c.city) === citySlug(s.city))
                              .reduce((n, c) => n + c.clicks, 0),
                          ),
                        ].join(" · ")}
                      </span>
                    </div>
                    <a className="inline-link" href={s.link || `/kuenstler/${pid}`}>
                      {T.topH}
                    </a>
                    <button
                      className="action-btn"
                      onClick={() => {
                        clearSpotlight(s.city);
                        refreshSpots();
                      }}
                    >
                      {T.topClear}
                    </button>
                  </div>
                ))}
              </div>
              <h2 className="portal-h2">{T.clicksH}</h2>
              <p className="portal-empty">{T.clicksP}</p>
              <div className="portal-acts">
                {stats.length === 0 && <p className="portal-empty">{T.mineNone}</p>}
                {stats.map((c) => (
                  <div className="portal-act" key={c.city + c.act}>
                    <div className="portal-act-info">
                      <strong>{c.city}</strong>
                      <span>{[c.act, T.clicks(c.clicks)].filter(Boolean).join(" · ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="portal-h2">{T.topH}</h2>
          {spot && (
            <div className="portal-top-card">
              <img src={spot.image || stageImg} alt={spot.name} width={480} height={270} />
              <div className="portal-top-body">
                <span className="portal-top-label">{T.topH}</span>
                <strong>{spot.name}</strong>
                <span>
                  {[spot.city, T.topDays(daysLeft(spot))].filter(Boolean).join(" · ")}
                </span>
                {spot.tagline && <p>{spot.tagline}</p>}
                {spot.link && (
                  <a className="inline-link" href={spot.link}>
                    {spot.link.startsWith("http") ? spot.link : T.topActive}
                  </a>
                )}
              </div>
            </div>
          )}
          <p className="portal-empty">{T.topP}</p>
          {targetCity && <p className="portal-empty">{T.topCity(targetCity)}</p>}

          {prof.figures.length === 0 && <p className="portal-empty">{T.topNone}</p>}
          {prof.figures.length > 0 && (
            <>
              <h2 className="portal-h2">{T.rankH}</h2>
              <p className="portal-empty">{T.rankP}</p>
            </>
          )}
          <div className="portal-acts">
            {ranked.map(({ act: f, count, revenue }, i) => {
              const active = !!spot && spot.name === f;
              return (
                <div key={f} className={"portal-act" + (active ? " active" : "")}>
                  <span className={"portal-rank r" + (i < 3 ? i + 1 : 0)}>#{i + 1}</span>
                  <div className="portal-act-info">
                    <strong>{f}</strong>
                    <span>
                      {[
                        T.rankB(count),
                        `${T.rankRev}: ${fmt(revenue)}`,
                        active
                          ? `${T.topActive} · ${spot!.city} · ${T.topDays(daysLeft(spot!))}`
                          : targetCity,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {active ? (
                    <button
                      className="action-btn"
                      onClick={() => {
                        clearSpotlight(spot?.city ?? "");
                        refreshSpots();
                      }}
                    >
                      {T.topClear}
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={() => setTop(f)}>
                      {T.topSet}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {tab === "c" && (
        <div className="portal-body">
          <h2 className="portal-h2">{T.dbH}</h2>
          <p className="portal-empty">{T.dbP}</p>
          <div className="portal-city">
            <input
              value={cityForm.name}
              placeholder={T.dbName}
              aria-label={T.dbName}
              onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
            />
            <input
              list="portal-country-list"
              value={cityForm.country}
              placeholder={T.dbCountry}
              aria-label={T.dbCountry}
              style={{ maxWidth: 140 }}
              onChange={(e) => setCityForm({ ...cityForm, country: e.target.value })}
            />
            <datalist id="portal-country-list">
              {knownCountries().map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              value={cityForm.region}
              placeholder={T.dbRegion}
              aria-label={T.dbRegion}
              onChange={(e) => setCityForm({ ...cityForm, region: e.target.value })}
            />
            <button
              className="btn-primary"
              onClick={() => {
                const saved = saveCity({
                  ...(cityForm.id ? { id: cityForm.id } : {}),
                  name: cityForm.name,
                  country: cityForm.country,
                  region: cityForm.region,
                });
                if (!saved) return toast(T.dbName);
                setCityForm({ id: "", name: "", country: cityForm.country, region: "" });
                refreshCities();
                toast(T.dbSaved);
              }}
            >
              {T.dbAdd}
            </button>
          </div>

          <h2 className="portal-h2">{T.dbOwn}</h2>
          <div className="portal-acts">
            {cityDb.own.length === 0 && <p className="portal-empty">{T.dbNone}</p>}
            {cityDb.own.map((c) => (
              <div className="portal-act" key={c.id}>
                <div className="portal-act-info">
                  <strong>{c.name}</strong>
                  <span>{[c.country.toUpperCase(), c.region].filter(Boolean).join(" · ")}</span>
                </div>
                <button
                  className="action-btn"
                  onClick={() => {
                    setTargetCity(c.name);
                    setTab("t");
                  }}
                >
                  {T.dbUse}
                </button>
                <button
                  className="action-btn"
                  onClick={() =>
                    setCityForm({
                      id: c.id,
                      name: c.name,
                      country: c.country,
                      region: c.region ?? "",
                    })
                  }
                >
                  {T.edit}
                </button>
                <button
                  className="action-btn danger"
                  onClick={() => {
                    removeCity(c.id);
                    refreshCities();
                  }}
                >
                  {T.remove}
                </button>
              </div>
            ))}
          </div>

          {cityDb.hidden.length > 0 && (
            <>
              <h2 className="portal-h2">{T.dbHidden}</h2>
              <div className="portal-slots">
                {cityDb.hidden.map((id) => (
                  <button
                    key={id}
                    className="portal-slot off"
                    onClick={() => {
                      restoreCity(id);
                      refreshCities();
                    }}
                  >
                    {id} · {T.dbRestore}
                  </button>
                ))}
              </div>
            </>
          )}

          <h2 className="portal-h2">
            {T.dbAll} ({cityDb.all.length})
          </h2>
          <div className="portal-slots">
            {cityDb.all.slice(0, 200).map((c) => (
              <button
                key={c.id}
                className="portal-slot"
                title={c.country.toUpperCase()}
                onClick={() => {
                  setTargetCity(c.name);
                  setTab("t");
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "b" && pid != null && (
        <div className="portal-body">
          <IncomingBookings artistId={pid} onEditProfile={() => setTab("p")} />
        </div>
      )}

      {tab === "p" && (
        <div className="portal-body portal-form">
          <label>
            {T.name}
            <input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} />
          </label>
          <label>
            {T.loc}
            <input value={prof.loc} onChange={(e) => setProf({ ...prof, loc: e.target.value })} />
          </label>
          <label>
            {T.price}
            <input
              type="number"
              value={prof.price}
              onChange={(e) => setProf({ ...prof, price: e.target.value })}
            />
          </label>
          <label>
            {T.desc}
            <textarea
              rows={5}
              value={prof.desc}
              onChange={(e) => setProf({ ...prof, desc: e.target.value })}
            />
          </label>
          <div>
            <h2 className="portal-h2">{T.acts}</h2>
            <p className="portal-empty">{T.actsP}</p>
            <div className="portal-slots" style={{ marginBottom: 12 }}>
              {prof.figures.map((f) => (
                <button
                  key={f}
                  className="portal-slot"
                  title={T.remove}
                  onClick={() => setProf({ ...prof, figures: prof.figures.filter((x) => x !== f) })}
                >
                  {f} ✕
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder={T.actPh}
                value={actInput}
                onChange={(e) => setActInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const v = actInput.trim();
                  if (!v || prof.figures.includes(v)) return;
                  setProf({ ...prof, figures: [...prof.figures, v] });
                  setActInput("");
                }}
              />
              <button
                className="action-btn"
                onClick={() => {
                  const v = actInput.trim();
                  if (!v || prof.figures.includes(v)) return;
                  setProf({ ...prof, figures: [...prof.figures, v] });
                  setActInput("");
                }}
              >
                {T.actAdd}
              </button>
            </div>
          </div>
          <button className="btn-primary" onClick={saveProfile}>
            {T.save}
          </button>
        </div>
      )}

      {tab === "a" && (
        <div className="portal-body">
          <h2 className="portal-h2">{T.availH}</h2>
          <p className="portal-empty">{T.availP}</p>
          <div className="portal-avail">
            {nextDays(14).map((iso) => {
              const blocked = bookedSlots(pid, iso);
              return (
                <div className="portal-day" key={iso}>
                  <div className="portal-day-h">
                    {fmtDate(iso)}
                    {iso === todayISO() ? " ·" : ""}
                  </div>
                  <div className="portal-slots">
                    {SLOTS.map((s) => (
                      <button
                        key={s}
                        className={"portal-slot" + (blocked.includes(s) ? " off" : "")}
                        onClick={() => toggleBlock(pid, iso, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
