/* Location anbieten: Anbieter (gewerblich oder privat), Eckdaten,
 * Ausstattung, Hausregeln, Preise mit Paketen und Extras, Wochenplan.
 * Ohne Datenbank bleibt die Location in diesem Browser (Vorschau); mit
 * Datenbank wird sie als Anbieter (providers, kind = 'location') gespeichert
 * und ist nach der Freischaltung durch die Verwaltung sichtbar. */
import { seoHeadDe } from "@/showly/seo";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { PhotosPick } from "@/components/showly/ImagePick";
import { PrivacyAck, usePrivacyCopy } from "@/components/showly/PrivacyAck";
import { TaxAck, TaxNotice } from "@/components/showly/ProviderNotices";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";
import { AccountStep } from "@/components/showly/AccountStep";
import { label } from "@/components/showly/Venue";
import { AMENITIES, OCCASIONS, RULES, VENUE_GROUPS, VENUE_KINDS, cleanVenue, kindOf, type ExtraPer, type PriceMode } from "@/showly/locations";
import { createVenue } from "@/showly/venues";
import type { MediaRef } from "@/showly/media";
import { isBackendConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/locations/anbieten")({
  head: () =>
    seoHeadDe(
      "/locations/anbieten",
      "Location anbieten – Saal, Restaurant oder Freizeitpark vermieten | Showly",
      "Vermiete deine Event-Location über Showly: Kalender, Festpreise, Pakete für Kindergeburtstage und sichere Zahlung. Die ersten 3 Monate ohne Provision.",
    ),
  component: Offer,
});

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Pkg = { name: string; price: string; per: "person" | "event"; hours: string; minGuests: string; maxGuests: string; includes: string };
type Extra = { name: string; price: string; per: ExtraPer };
const emptyPkg = (): Pkg => ({ name: "", price: "", per: "person", hours: "3", minGuests: "8", maxGuests: "20", includes: "" });
const emptyExtra = (): Extra => ({ name: "", price: "", per: "event" });
const euro = (v: string) => Math.max(0, Math.round((Number(String(v).replace(",", ".")) || 0) * 100) / 100);
const int = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

function Offer() {
  const { toast, session } = useShowly();
  const okText = useContactCheck();
  const P = usePrivacyCopy();
  const navigate = useNavigate();

  const [business, setBusiness] = useState(true);
  const [kind, setKind] = useState("saal");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [occasions, setOccasions] = useState<string[]>(["geburtstag"]);
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [seated, setSeated] = useState("40");
  const [standing, setStanding] = useState("60");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("1");
  const [indoor, setIndoor] = useState(true);
  const [outdoor, setOutdoor] = useState(false);
  const [amen, setAmen] = useState<string[]>(["stuehle", "tische", "wc"]);
  const [rules, setRules] = useState<Record<string, boolean>>({});
  const [musicUntil, setMusicUntil] = useState("");
  const [minAge, setMinAge] = useState("");
  const [notes, setNotes] = useState("");
  const [minSpend, setMinSpend] = useState("");

  const [mode, setMode] = useState<PriceMode>("hour");
  const [price, setPrice] = useState("");
  const [priceFull, setPriceFull] = useState("");
  const [minHours, setMinHours] = useState("3");
  const [minGuests, setMinGuests] = useState("10");
  const [weekend, setWeekend] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);

  const [week, setWeek] = useState(DAYS.map((_, i) => ({ on: i !== 0, from: "10:00", to: "22:00" })));
  const [fixed, setFixed] = useState("");
  const [parallel, setParallel] = useState("1");
  const [buffer, setBuffer] = useState("60");
  const [lead, setLead] = useState("3");
  const [maxMonths, setMaxMonths] = useState("12");
  const [instant, setInstant] = useState(true);
  const [tier, setTier] = useState<"flexibel" | "moderat" | "streng">("moderat");

  const [terms, setTerms] = useState(false);
  const [rightOk, setRightOk] = useState(false);
  const [taxOk, setTaxOk] = useState(false);
  const [privOk, setPrivOk] = useState(false);
  const [acct, setAcct] = useState(false);
  const [busy, setBusy] = useState(false);

  const group = kindOf(kind).group;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function raw(): Record<string, unknown> {
    return {
      kind,
      business,
      name,
      city,
      district,
      address,
      tagline,
      about,
      occasions,
      seated: int(seated, 2000),
      standing: int(standing, 2000),
      areaM2: int(area, 100000),
      rooms: Math.max(1, int(rooms, 50)),
      indoor,
      outdoor,
      amenities: amen,
      rules,
      ...(musicUntil ? { musicUntil } : {}),
      ...(int(minAge, 99) ? { minAge: int(minAge, 99) } : {}),
      notes,
      ...(euro(minSpend) ? { minSpend: euro(minSpend) } : {}),
      mode,
      price: euro(price),
      ...(mode === "flat" && euro(priceFull) ? { priceFull: euro(priceFull) } : {}),
      minHours: Math.max(1, int(minHours, 16)),
      minGuests: Math.max(1, int(minGuests, 2000)),
      surcharges: int(weekend, 100) ? { weekend: int(weekend, 100), seasons: [] } : null,
      deposit: euro(deposit),
      packages: pkgs.map((p, i) => ({
        id: `p${i + 1}`,
        name: p.name,
        price: euro(p.price),
        per: p.per,
        hours: int(p.hours, 16),
        minGuests: int(p.minGuests, 2000),
        maxGuests: int(p.maxGuests, 2000),
        includes: p.includes.split("\n").map((x) => x.trim()).filter(Boolean),
      })),
      extras: extras.map((x, i) => ({ id: `x${i + 1}`, name: x.name, price: euro(x.price), per: x.per })),
      week: week.map((d) => (d.on ? { from: d.from, to: d.to } : null)),
      slots: fixed.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)).map((s) => s.padStart(5, "0")),
      parallel: Math.max(1, int(parallel, 50)),
      bufferMin: int(buffer, 600),
      leadDays: int(lead, 365),
      maxMonths: Math.max(1, int(maxMonths, 24)),
      instant,
      cancelTier: tier,
      photos,
      hue: Math.floor(Math.random() * 360),
      taxAckAt: new Date().toISOString(),
    };
  }

  function check(): string | null {
    if (!name.trim() || !city.trim()) return "Bitte Name und Stadt angeben.";
    if (!address.trim()) return "Bitte die Adresse angeben (Kunden sehen sie erst nach der Buchung).";
    if (!occasions.length) return "Bitte mindestens einen Anlass wählen.";
    const v = cleanVenue(raw(), 0);
    if (!v.packages.length && !(v.price > 0)) return "Bitte einen Preis oder mindestens ein Paket angeben.";
    if (!v.week.some(Boolean)) return "Bitte mindestens einen Tag mit Öffnungszeiten angeben.";
    if (!(v.seated || v.standing || v.packages.length)) return "Bitte angeben, wie viele Gäste Platz haben.";
    if (!terms || !rightOk || !taxOk) return "Bitte die Bedingungen, das Vermietrecht und den Steuerhinweis bestätigen.";
    if (!privOk) return P.need;
    return null;
  }

  async function saveCloud() {
    setBusy(true);
    const { saveProvider } = await import("@/utils/provider.functions");
    const r = await saveProvider({ data: { kind: "location", data: raw() } }).catch(() => ({ error: "Speichern hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return toast(r.error);
    toast("Location angelegt. Wir prüfen sie und schalten sie meist innerhalb von 2 Werktagen frei.");
    navigate({ to: "/dashboard" });
  }

  function submit() {
    const err = check();
    if (err) return toast(err);
    if (!okText(name, tagline, about, notes, ...pkgs.map((p) => p.name + " " + p.includes), ...extras.map((x) => x.name))) return;
    if (isBackendConfigured()) {
      if (!session?.backend) return setAcct(true);
      void saveCloud();
      return;
    }
    const v = createVenue(raw());
    toast("Deine Location ist angelegt (Vorschau, nur in diesem Browser).");
    navigate({ to: "/locations/$id", params: { id: String(v.id) } });
  }

  return (
    <div className="page active ui26 bk-page onboard26 vn-offer">
      <div className="bk-wrap narrow">
        <div className="bk-crumbs">
          <Link to="/locations">
            <Icon name="arrow" /> Locations
          </Link>
        </div>
        <header className="ob-head">
          <span className="home-eyebrow">Location anbieten</span>
          <h1>Deine Location auf Showly</h1>
          <p>
            Saal, Restaurant, Indoor-Spielplatz, Wasserpark, Garten oder Hütte: Kunden sehen freie Termine, der Preis wird sofort
            berechnet, bezahlt wird sicher über Showly. Die ersten 3 Monate zahlst du keine Provision, danach 20 %.
          </p>
        </header>

        <div className="pe-main">
          <section className="pe-card">
            <h3 className="ob-step">
              <span>1</span> Wer vermietet?
            </h3>
            <div className="ob-kinds" role="radiogroup">
              {(
                [
                  [true, "crown", "Gewerblich", "Restaurant, Eventlocation, Freizeitpark, Verein mit Gewerbe."],
                  [false, "heart", "Privat", "Gartenhaus, Hütte oder Raum, den du privat vermietest."],
                ] as const
              ).map(([b, ic, h, p]) => (
                <button key={String(b)} type="button" role="radio" aria-checked={business === b} className={"ob-kind" + (business === b ? " on" : "")} onClick={() => setBusiness(b)}>
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
              <span>2</span> Art der Location
            </h3>
            {VENUE_GROUPS.map((g) => (
              <div key={g.id} className="vn-kind-group">
                <span className="pe-label">
                  <Icon name={g.icon} /> {label(g, "de")}
                </span>
                <div className="vn-chips">
                  {VENUE_KINDS.filter((k) => k.group === g.id).map((k) => (
                    <button key={k.id} type="button" className={"occ-chip" + (kind === k.id ? " on" : "")} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                      {label(k, "de")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>3</span> Profil
            </h3>
            <label className="pe-field">
              <span className="pe-label">Name der Location</span>
              <input value={name} maxLength={80} placeholder="z. B. Festsaal am Park" onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">Stadt</span>
                <input value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Stadtteil / Umgebung (öffentlich)</span>
                <input value={district} maxLength={60} placeholder="z. B. Altstadt" onChange={(e) => setDistrict(e.target.value)} />
              </label>
            </div>
            <label className="pe-field">
              <span className="pe-label">Genaue Adresse</span>
              <input value={address} maxLength={200} autoComplete="street-address" onChange={(e) => setAddress(e.target.value)} />
              <span className="pe-hint">
                <Icon name="lock" /> Kunden sehen die Adresse erst nach der Bezahlung.
              </span>
            </label>
            <label className="pe-field">
              <span className="pe-label">Kurzbeschreibung</span>
              <input value={tagline} maxLength={120} placeholder="z. B. Heller Saal mit Garten für bis zu 120 Gäste" onChange={(e) => setTagline(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">Beschreibung</span>
              <textarea rows={5} value={about} maxLength={2000} placeholder="Was macht deine Location besonders? Was können Gäste dort erleben?" onChange={(e) => setAbout(e.target.value)} />
              <ContactHint text={name + "\n" + tagline + "\n" + about} />
            </label>
            <div className="pe-field">
              <span className="pe-label">Passende Anlässe</span>
              <div className="vn-chips">
                {OCCASIONS.map((o) => (
                  <button key={o.id} type="button" className={"occ-chip" + (occasions.includes(o.id) ? " on" : "")} aria-pressed={occasions.includes(o.id)} onClick={() => setOccasions((l) => toggle(l, o.id))}>
                    {label(o, "de")}
                  </button>
                ))}
              </div>
            </div>
            <div className="pe-field">
              <span className="pe-label">Fotos (bis zu 12, das erste ist das Titelbild)</span>
              <PhotosPick value={photos} onChange={setPhotos} max={12} />
            </div>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>4</span> Größe und Ausstattung
            </h3>
            <div className="pe-grid2 vn-grid4">
              <label className="pe-field">
                <span className="pe-label">Sitzplätze</span>
                <input type="number" min={0} value={seated} onChange={(e) => setSeated(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Stehplätze</span>
                <input type="number" min={0} value={standing} onChange={(e) => setStanding(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Fläche (m²)</span>
                <input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Räume</span>
                <input type="number" min={1} value={rooms} onChange={(e) => setRooms(e.target.value)} />
              </label>
            </div>
            <div className="vn-chips">
              <button type="button" className={"occ-chip" + (indoor ? " on" : "")} aria-pressed={indoor} onClick={() => setIndoor(!indoor)}>
                Drinnen
              </button>
              <button type="button" className={"occ-chip" + (outdoor ? " on" : "")} aria-pressed={outdoor} onClick={() => setOutdoor(!outdoor)}>
                Draußen
              </button>
            </div>
            <div className="pe-field">
              <span className="pe-label">Inklusive (antippen, was im Preis enthalten ist)</span>
              <div className="vn-amen-pick">
                {AMENITIES.map((a) => (
                  <button key={a.id} type="button" className={"vn-amen-btn" + (amen.includes(a.id) ? " on" : "")} aria-pressed={amen.includes(a.id)} onClick={() => setAmen((l) => toggle(l, a.id))}>
                    <Icon name={amen.includes(a.id) ? "check" : a.icon} /> {label(a, "de")}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>5</span> Hausregeln
            </h3>
            <div className="vn-rule-pick">
              {RULES.map((r) => (
                <div key={r.id} className="vn-rule-row">
                  <span>{label(r, "de")}</span>
                  <div className="vn-seg">
                    {(
                      [
                        [true, "Erlaubt"],
                        [false, "Nein"],
                        [undefined, "–"],
                      ] as const
                    ).map(([val, txt]) => (
                      <button
                        key={txt}
                        type="button"
                        className={rules[r.id] === val ? "on" : ""}
                        onClick={() =>
                          setRules((x) => {
                            const n = { ...x };
                            if (val === undefined) delete n[r.id];
                            else n[r.id] = val;
                            return n;
                          })
                        }
                      >
                        {txt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">Musik bis (Uhrzeit)</span>
                <input type="time" value={musicUntil} onChange={(e) => setMusicUntil(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Mindestalter (Freizeit)</span>
                <input type="number" min={0} max={99} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
              </label>
            </div>
            {group === "gastro" && (
              <label className="pe-field">
                <span className="pe-label">Mindestumsatz vor Ort in € (optional)</span>
                <input inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
                <span className="pe-hint">Wird nicht online bezahlt, sondern vor Ort mit Essen und Getränken erreicht.</span>
              </label>
            )}
            <label className="pe-field">
              <span className="pe-label">Hinweise für Gäste</span>
              <input value={notes} maxLength={400} placeholder="z. B. Rutschsocken Pflicht, Badekleidung mitbringen" onChange={(e) => setNotes(e.target.value)} />
            </label>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>6</span> Preise
            </h3>
            <div className="vn-chips">
              {(
                [
                  ["hour", "Pro Stunde"],
                  ["flat", "Halbtag / Ganztag"],
                  ["person", "Pro Gast"],
                ] as const
              ).map(([m, t]) => (
                <button key={m} type="button" className={"occ-chip" + (mode === m ? " on" : "")} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">{mode === "hour" ? "Preis je Stunde (€)" : mode === "flat" ? "Halbtag bis 5 Std. (€)" : "Preis je Gast (€)"}</span>
                <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              {mode === "flat" && (
                <label className="pe-field">
                  <span className="pe-label">Ganztag (€)</span>
                  <input inputMode="decimal" value={priceFull} onChange={(e) => setPriceFull(e.target.value)} />
                </label>
              )}
              {mode !== "person" && (
                <label className="pe-field">
                  <span className="pe-label">Mindestdauer (Std.)</span>
                  <input type="number" min={1} max={16} value={minHours} onChange={(e) => setMinHours(e.target.value)} />
                </label>
              )}
              {mode === "person" && (
                <label className="pe-field">
                  <span className="pe-label">Mindestzahl Gäste</span>
                  <input type="number" min={1} value={minGuests} onChange={(e) => setMinGuests(e.target.value)} />
                </label>
              )}
              <label className="pe-field">
                <span className="pe-label">Wochenendzuschlag (%)</span>
                <input type="number" min={0} max={100} value={weekend} onChange={(e) => setWeekend(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Kaution (€)</span>
                <input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                <span className="pe-hint">Showly hält sie und zahlt sie nach dem Event zurück, wenn kein Schaden gemeldet wird.</span>
              </label>
            </div>

            <div className="pe-field">
              <span className="pe-label">Pakete (z. B. Kindergeburtstag Basic, Premium)</span>
              <span className="pe-hint">Ideal für Indoor-Spielplätze, Wasserparks und Erlebnisanbieter: fester Ablauf, Preis je Kind.</span>
              {pkgs.map((p, i) => (
                <div key={i} className="vn-edit-box">
                  <div className="pe-grid2">
                    <label className="pe-field">
                      <span className="pe-label">Name</span>
                      <input value={p.name} maxLength={60} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">Preis (€)</span>
                      <input inputMode="decimal" value={p.price} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">Preis gilt</span>
                      <select value={p.per} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, per: e.target.value as Pkg["per"] } : x)))}>
                        <option value="person">je Gast / Kind</option>
                        <option value="event">pauschal für die Feier</option>
                      </select>
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">Dauer (Std.)</span>
                      <input type="number" min={1} max={16} value={p.hours} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, hours: e.target.value } : x)))} />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">Gäste min.</span>
                      <input type="number" min={1} value={p.minGuests} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, minGuests: e.target.value } : x)))} />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">Gäste max.</span>
                      <input type="number" min={1} value={p.maxGuests} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, maxGuests: e.target.value } : x)))} />
                    </label>
                  </div>
                  <label className="pe-field">
                    <span className="pe-label">Was ist drin? (eine Zeile je Punkt)</span>
                    <textarea rows={4} value={p.includes} placeholder={"Eintritt\nPartytisch 2 Std.\nPommes & Getränke\nGeschenk fürs Geburtstagskind"} onChange={(e) => setPkgs((l) => l.map((x, k) => (k === i ? { ...x, includes: e.target.value } : x)))} />
                  </label>
                  <button type="button" className="action-btn" onClick={() => setPkgs((l) => l.filter((_, k) => k !== i))}>
                    <Icon name="trash" /> Paket entfernen
                  </button>
                </div>
              ))}
              {pkgs.length < 6 && (
                <button type="button" className="btn-secondary vn-add-row" onClick={() => setPkgs((l) => [...l, emptyPkg()])}>
                  <Icon name="plus" /> Paket hinzufügen
                </button>
              )}
            </div>

            <div className="pe-field">
              <span className="pe-label">Extras gegen Aufpreis</span>
              <span className="pe-hint">z. B. Endreinigung, Servicekraft, Getränkepauschale, Beamer, Verlängerung</span>
              {extras.map((x, i) => (
                <div key={i} className="vn-extra-row">
                  <input placeholder="Name" value={x.name} maxLength={60} onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} />
                  <input placeholder="€" inputMode="decimal" value={x.price} onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, price: e.target.value } : y)))} />
                  <select value={x.per} onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, per: e.target.value as ExtraPer } : y)))}>
                    <option value="event">pauschal</option>
                    <option value="person">je Gast</option>
                    <option value="hour">je Stunde</option>
                  </select>
                  <button type="button" className="action-btn" aria-label="Entfernen" onClick={() => setExtras((l) => l.filter((_, k) => k !== i))}>
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
              {extras.length < 20 && (
                <button type="button" className="btn-secondary vn-add-row" onClick={() => setExtras((l) => [...l, emptyExtra()])}>
                  <Icon name="plus" /> Extra hinzufügen
                </button>
              )}
            </div>
          </section>

          <section className="pe-card">
            <h3 className="ob-step">
              <span>7</span> Kalender: wann buchbar?
            </h3>
            <div className="vn-week">
              {week.map((d, i) => (
                <div key={DAYS[i]} className={"vn-week-row" + (d.on ? "" : " off")}>
                  <label className="vn-week-day">
                    <input type="checkbox" checked={d.on} onChange={(e) => setWeek((w) => w.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
                    {DAYS[i]}
                  </label>
                  {d.on ? (
                    <>
                      <input type="time" value={d.from} onChange={(e) => setWeek((w) => w.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)))} />
                      <span>bis</span>
                      <input type="time" value={d.to} onChange={(e) => setWeek((w) => w.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)))} />
                    </>
                  ) : (
                    <span className="vn-muted">geschlossen</span>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="inline-link" onClick={() => setWeek((w) => w.map((x) => ({ ...x, from: w[5]!.from, to: w[5]!.to })))}>
              Zeiten von Samstag für alle Tage übernehmen
            </button>
            <div className="pe-grid2">
              <label className="pe-field">
                <span className="pe-label">Feste Startzeiten (optional)</span>
                <input value={fixed} placeholder="z. B. 10:00, 13:00, 15:30" onChange={(e) => setFixed(e.target.value)} />
                <span className="pe-hint">Leer lassen = Kunden wählen die Startzeit frei innerhalb der Öffnungszeiten.</span>
              </label>
              <label className="pe-field">
                <span className="pe-label">Feiern gleichzeitig</span>
                <input type="number" min={1} max={50} value={parallel} onChange={(e) => setParallel(e.target.value)} />
                <span className="pe-hint">z. B. 4 Partytische = 4 Geburtstage zur selben Zeit.</span>
              </label>
              <label className="pe-field">
                <span className="pe-label">Puffer zwischen Buchungen (Min.)</span>
                <input type="number" min={0} max={600} step={15} value={buffer} onChange={(e) => setBuffer(e.target.value)} />
                <span className="pe-hint">Für Aufbau, Abbau und Reinigung.</span>
              </label>
              <label className="pe-field">
                <span className="pe-label">Vorlauf (Tage)</span>
                <input type="number" min={0} max={365} value={lead} onChange={(e) => setLead(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Buchbar bis zu (Monate im Voraus)</span>
                <input type="number" min={1} max={24} value={maxMonths} onChange={(e) => setMaxMonths(e.target.value)} />
              </label>
              <label className="pe-field">
                <span className="pe-label">Stornobedingungen</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
                  <option value="flexibel">Flexibel (kostenlos bis 7 Tage vorher)</option>
                  <option value="moderat">Moderat (kostenlos bis 14 Tage vorher)</option>
                  <option value="streng">Streng (kostenlos bis 30 Tage vorher)</option>
                </select>
              </label>
            </div>
            <div className="ob-kinds" role="radiogroup">
              {(
                [
                  [true, "check", "Sofort buchbar", "Freie Termine sind direkt verbindlich gebucht."],
                  [false, "clock", "Erst anfragen", "Du bestätigst jede Buchung innerhalb von 48 Stunden."],
                ] as const
              ).map(([b, ic, h, p]) => (
                <button key={String(b)} type="button" role="radio" aria-checked={instant === b} className={"ob-kind" + (instant === b ? " on" : "")} onClick={() => setInstant(b)}>
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
              <span>8</span> Rechtliches
            </h3>
            <label className="ob-check">
              <input type="checkbox" checked={rightOk} onChange={(e) => setRightOk(e.target.checked)} />
              <span>
                Ich darf die Räume bzw. das Gelände vermieten (Eigentum, Pacht oder Erlaubnis), halte Brandschutz, Lärmschutz und
                Jugendschutz ein und habe eine passende Haftpflichtversicherung.
              </span>
            </label>
            <label className="ob-check">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                Ich akzeptiere die{" "}
                <Link to="/rechtliches/$doc" params={{ doc: "terms" }} target="_blank">
                  Nutzungsbedingungen
                </Link>
                .
              </span>
            </label>
            <TaxNotice compact />
            <TaxAck checked={taxOk} onChange={setTaxOk} />
            <PrivacyAck checked={privOk} onChange={setPrivOk} id="venue-privacy" />
            {acct && (
              <AccountStep
                next="/locations/anbieten"
                onClose={() => setAcct(false)}
                onDone={() => {
                  setAcct(false);
                  void saveCloud();
                }}
              />
            )}
            <button className="home-btn primary ob-submit" onClick={submit} disabled={busy}>
              Location anlegen
              <Icon name="arrow" />
            </button>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
