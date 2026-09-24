import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import type { Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { figName, figureList, figuresOf, realName } from "@/showly/figures";
import { MediaError, deleteMedia, preloadMedia, putMedia, type MediaRef } from "@/showly/media";
import { updateArtistProfile } from "@/showly/persist";
import { RADIUS_OPTIONS, radiusOf, travelOption } from "@/showly/travel";
import { ArtistCard } from "@/components/showly/ArtistCard";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";

/* Profil-Dashboard für Künstler.
 *
 * Alles am öffentlichen Profil lässt sich hier ändern: Bilder, Charaktere,
 * Texte, Stundengage und Kontaktdaten. Gesperrt sind nur der Name und das
 * Geburtsdatum. Beides stammt aus der Ausweisprüfung; ließe es sich frei
 * ändern, wäre das Siegel "verifiziert" wertlos. Die Sperre gilt doppelt:
 * die Felder sind hier nur lesbar, und persist.ts entfernt sie aus jeder
 * Änderung, bevor sie gespeichert wird.
 *
 * Rechts steht eine Vorschau der Karte, wie Kunden sie im Raster sehen. Sie
 * zeigt den Entwurf, noch bevor gespeichert ist. */

const MAX_PHOTOS = 8;

const COPY = {
  de: {
    h: "Profil bearbeiten",
    sub: "Das sehen Kunden auf deinem Profil und in der Suche. Änderungen gelten sofort nach dem Speichern.",
    lockedH: "Verifizierte Angaben",
    lockedP: "Aus deiner Ausweisprüfung. Diese Angaben kann nur der Showly-Support ändern.",
    realName: "Name laut Ausweis",
    birth: "Geburtsdatum",
    notYet: "Wird mit der Ausweisprüfung bestätigt",
    verified: "Ausweis geprüft",
    unverified: "Prüfung ausstehend",
    photosH: "Bilder",
    photosP: "Das erste Bild ist dein Titelbild. Bis zu 8 Bilder, am besten im Querformat.",
    upload: "Bilder hochladen",
    cover: "Titelbild",
    makeCover: "Als Titelbild",
    remove: "Entfernen",
    textsH: "Texte",
    stage: "Künstlername",
    desc: "Kurzbeschreibung",
    descHint: "Ein, zwei Sätze. Erscheint auf deiner Karte und oben im Profil.",
    exp: "Erfahrung",
    expPh: "z. B. 8 Jahre",
    langs: "Sprachen",
    langsPh: "Deutsch, Englisch",
    tags: "Anlässe",
    tagsPh: "Hochzeit, Firmenfeier, Kindergeburtstag",
    includes: "Das ist inklusive",
    includesPh: "Eine Leistung pro Zeile",
    specs: "Technik & Ausstattung",
    specsPh: "Eigene Musikanlage, Nebelmaschine",
    listHint: "Mehrere Einträge mit Komma trennen.",
    figsH: "Charaktere",
    figsP:
      "Die Figuren, die du spielst. Kunden wählen beim Buchen, wer kommen soll. Ein Bild je Charakter hilft bei der Wahl.",
    figAdd: "Charakter hinzufügen",
    figPh: "Name des Charakters",
    figImg: "Bild",
    figSuggest: "Vorschläge für deine Sparte",
    priceH: "Gage & Buchung",
    priceP: "Deine Gage gilt immer pro Stunde. Kunden wählen die Dauer beim Buchen.",
    hourly: "Stundengage (€ pro Stunde)",
    minHours: "Mindestdauer",
    hoursN: (n: number) => (n === 1 ? "1 Stunde" : `${n} Stunden`),
    preview: (p: string) => `Kunden sehen: ${p} pro Stunde inkl. Servicegebühr`,
    pkgNote: "Als Planer verkaufst du feste Pakete. Der Betrag hier ist dein Einstiegspreis.",
    contactH: "Kontakt & Einsatzgebiet",
    contactP:
      "Nicht öffentlich. Showly nutzt die Daten für Rückfragen, Kunden erhalten sie erst nach einer bestätigten Buchung.",
    loc: "Ort / Einsatzgebiet",
    radius: "Wie weit fährst du?",
    radiusHint: "Steht offen im Profil. Kunden sehen sofort, ob du zu ihnen kommst.",
    email: "E-Mail",
    phone: "Telefon",
    website: "Webseite",
    instagram: "Instagram",
    tiktok: "TikTok",
    save: "Änderungen speichern",
    saved: "Profil gespeichert",
    unsaved: "Ungespeicherte Änderungen",
    discard: "Verwerfen",
    view: "Profil ansehen",
    cardPreview: "So erscheint deine Karte",
    errName: "Bitte gib einen Künstlernamen an.",
    errPrice: "Die Stundengage muss zwischen 10 € und 2.000 € liegen.",
    errUrl: "Die Webseite muss mit https:// beginnen.",
    errMail: "Bitte prüfe die E-Mail-Adresse.",
    errType: "Nur Bilddateien sind möglich.",
    errStore: "Das Bild konnte nicht gespeichert werden. Ist der Speicher voll?",
    errMax: "Höchstens 8 Bilder.",
  },
  en: {
    h: "Edit profile",
    sub: "This is what clients see on your profile and in search. Changes apply as soon as you save.",
    lockedH: "Verified details",
    lockedP: "From your ID check. Only Showly support can change these.",
    realName: "Name on ID",
    birth: "Date of birth",
    notYet: "Confirmed with the ID check",
    verified: "ID verified",
    unverified: "Check pending",
    photosH: "Photos",
    photosP: "The first photo is your cover. Up to 8 photos, landscape works best.",
    upload: "Upload photos",
    cover: "Cover",
    makeCover: "Make cover",
    remove: "Remove",
    textsH: "Texts",
    stage: "Stage name",
    desc: "Short description",
    descHint: "One or two sentences. Shown on your card and at the top of your profile.",
    exp: "Experience",
    expPh: "e.g. 8 years",
    langs: "Languages",
    langsPh: "German, English",
    tags: "Occasions",
    tagsPh: "Wedding, corporate event, kids' party",
    includes: "What's included",
    includesPh: "One item per line",
    specs: "Equipment",
    specsPh: "Own sound system, fog machine",
    listHint: "Separate entries with commas.",
    figsH: "Characters",
    figsP:
      "The characters you perform. Clients choose who should come when booking. A photo per character helps.",
    figAdd: "Add character",
    figPh: "Character name",
    figImg: "Photo",
    figSuggest: "Suggestions for your category",
    priceH: "Fee & booking",
    priceP: "Your fee is always per hour. Clients choose the duration when booking.",
    hourly: "Hourly fee (€ per hour)",
    minHours: "Minimum duration",
    hoursN: (n: number) => (n === 1 ? "1 hour" : `${n} hours`),
    preview: (p: string) => `Clients see: ${p} per hour incl. service fee`,
    pkgNote: "As a planner you sell fixed packages. This amount is your starting price.",
    contactH: "Contact & area",
    contactP:
      "Not public. Showly uses these for questions; clients receive them only after a confirmed booking.",
    loc: "Location / area",
    radius: "How far do you travel?",
    radiusHint: "Shown on your profile so clients see right away whether you come to them.",
    email: "Email",
    phone: "Phone",
    website: "Website",
    instagram: "Instagram",
    tiktok: "TikTok",
    save: "Save changes",
    saved: "Profile saved",
    unsaved: "Unsaved changes",
    discard: "Discard",
    view: "View profile",
    cardPreview: "How your card appears",
    errName: "Please enter a stage name.",
    errPrice: "The hourly fee must be between €10 and €2,000.",
    errUrl: "The website must start with https://.",
    errMail: "Please check the email address.",
    errType: "Only image files are allowed.",
    errStore: "The photo could not be saved. Is the storage full?",
    errMax: "At most 8 photos.",
  },
  es: {
    h: "Editar perfil",
    sub: "Esto ven los clientes en tu perfil y en la búsqueda. Los cambios se aplican al guardar.",
    lockedH: "Datos verificados",
    lockedP: "De tu verificación de identidad. Solo el soporte de Showly puede cambiarlos.",
    realName: "Nombre según documento",
    birth: "Fecha de nacimiento",
    notYet: "Se confirma con la verificación",
    verified: "Identidad verificada",
    unverified: "Verificación pendiente",
    photosH: "Fotos",
    photosP: "La primera foto es la portada. Hasta 8 fotos, mejor en horizontal.",
    upload: "Subir fotos",
    cover: "Portada",
    makeCover: "Usar de portada",
    remove: "Quitar",
    textsH: "Textos",
    stage: "Nombre artístico",
    desc: "Descripción breve",
    descHint: "Una o dos frases. Aparece en tu tarjeta y arriba en tu perfil.",
    exp: "Experiencia",
    expPh: "p. ej. 8 años",
    langs: "Idiomas",
    langsPh: "Alemán, inglés",
    tags: "Ocasiones",
    tagsPh: "Boda, evento de empresa, cumpleaños infantil",
    includes: "Qué incluye",
    includesPh: "Un servicio por línea",
    specs: "Equipo técnico",
    specsPh: "Equipo de sonido propio, máquina de humo",
    listHint: "Separa las entradas con comas.",
    figsH: "Personajes",
    figsP:
      "Los personajes que interpretas. Los clientes eligen al reservar. Una foto por personaje ayuda.",
    figAdd: "Añadir personaje",
    figPh: "Nombre del personaje",
    figImg: "Foto",
    figSuggest: "Sugerencias para tu categoría",
    priceH: "Caché y reserva",
    priceP: "Tu caché es siempre por hora. Los clientes eligen la duración al reservar.",
    hourly: "Caché por hora (€ por hora)",
    minHours: "Duración mínima",
    hoursN: (n: number) => (n === 1 ? "1 hora" : `${n} horas`),
    preview: (p: string) => `Los clientes ven: ${p} por hora con tarifa de servicio`,
    pkgNote: "Como organizador vendes paquetes fijos. Este importe es tu precio de entrada.",
    contactH: "Contacto y zona",
    contactP:
      "No es público. Showly lo usa para consultas; los clientes lo reciben tras una reserva confirmada.",
    loc: "Lugar / zona",
    radius: "¿Hasta dónde viajas?",
    radiusHint: "Se muestra en tu perfil para que los clientes vean si vas a su zona.",
    email: "Correo",
    phone: "Teléfono",
    website: "Web",
    instagram: "Instagram",
    tiktok: "TikTok",
    save: "Guardar cambios",
    saved: "Perfil guardado",
    unsaved: "Cambios sin guardar",
    discard: "Descartar",
    view: "Ver perfil",
    cardPreview: "Así aparece tu tarjeta",
    errName: "Indica un nombre artístico.",
    errPrice: "El caché por hora debe estar entre 10 € y 2.000 €.",
    errUrl: "La web debe empezar por https://.",
    errMail: "Revisa el correo electrónico.",
    errType: "Solo se permiten imágenes.",
    errStore: "No se pudo guardar la foto. ¿Está lleno el almacenamiento?",
    errMax: "Como máximo 8 fotos.",
  },
} as const;
type Copy = (typeof COPY)[keyof typeof COPY];

type Contact = { email: string; phone: string; website: string; instagram: string; tiktok: string };

type Draft = {
  name: string;
  desc: string;
  exp: string;
  langs: string;
  tags: string;
  includes: string;
  specs: string;
  price: string;
  minHours: number;
  loc: string;
  radiusKm: number;
  photos: MediaRef[];
  figures: string[];
  figureImages: Record<string, MediaRef>;
  contact: Contact;
};

/* Mehrsprachige Werte ({ de, en, es }) als Text in der eingestellten Sprache */
function textOf(v: unknown, lang: string): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  const o = v as Record<string, unknown>;
  const pick = o[lang] ?? o["de"] ?? "";
  return Array.isArray(pick) ? pick.join(", ") : String(pick);
}
function listOf(v: unknown, lang: string): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  const o = v as Record<string, unknown>;
  const pick = o[lang] ?? o["de"];
  return Array.isArray(pick) ? pick.map(String) : [];
}
const splitComma = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
const splitLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

function initialDraft(a: Artist, lang: string): Draft {
  const c = (a["contact"] as Partial<Contact> | undefined) || {};
  return {
    name: textOf(a.name, lang),
    desc: textOf(a.desc, lang),
    exp: textOf(a.exp, lang),
    langs: listOf(a.langs, lang).join(", "),
    tags: listOf(a.tags, lang).join(", "),
    includes: listOf(a.includes, lang).join("\n"),
    specs: listOf(a["specs"], lang).join(", "),
    price: String(a.price ?? ""),
    minHours: Math.max(1, Number(a["minHours"]) || 1),
    loc: textOf(a.loc, lang),
    radiusKm: radiusOf(a),
    photos: ((a["photos"] as MediaRef[] | undefined) || []).slice(),
    figures: figuresOf(a).slice(),
    figureImages: { ...((a["figureImages"] as Record<string, MediaRef> | undefined) || {}) },
    contact: {
      email: c.email || "",
      phone: c.phone || "",
      website: c.website || "",
      instagram: c.instagram || "",
      tiktok: c.tiktok || "",
    },
  };
}

export function ProfileEditor({ artist: a }: { artist: Artist }) {
  const { lang, fmt, fmtDate, toast, catLabel } = useShowly();
  const C: Copy = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(a, lang));
  const [saved, setSaved] = useState<Draft>(draft);
  const [figInput, setFigInput] = useState("");
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const isPlanner = ((a as { packages?: unknown[] }).packages || []).length > 0;
  const real = realName(a);
  const birth = a["birthDate"] as string | undefined;
  const presets = figureList(a.cat).filter((f) => !draft.figures.includes(f.id));

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function setContact(k: keyof Contact, v: string) {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [k]: v } }));
  }

  /* Datei(en) in den Browser-Speicher legen und die Adresse sofort
     verfügbar machen, damit Vorschau und Karte das Bild gleich zeigen. */
  async function store(files: FileList | File[]): Promise<MediaRef[]> {
    const out: MediaRef[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        toast(C.errType);
        continue;
      }
      try {
        out.push(await putMedia(f));
      } catch (e) {
        toast(e instanceof MediaError && e.reason === "type" ? C.errType : C.errStore);
      }
    }
    await preloadMedia(out.map((m) => m.id));
    return out;
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - draft.photos.length;
    if (room <= 0) return toast(C.errMax);
    setBusy(true);
    const refs = await store(Array.from(files).slice(0, room));
    setBusy(false);
    if (files.length > room) toast(C.errMax);
    setDraft((d) => ({ ...d, photos: [...d.photos, ...refs] }));
  }

  function makeCover(i: number) {
    setDraft((d) => {
      const next = d.photos.slice();
      const [m] = next.splice(i, 1);
      return { ...d, photos: m ? [m, ...next] : next };
    });
  }
  function removePhoto(i: number) {
    setDraft((d) => ({ ...d, photos: d.photos.filter((_, k) => k !== i) }));
  }

  function addFigure(name: string) {
    const v = name.trim().slice(0, 40);
    if (!v || draft.figures.includes(v)) return;
    set("figures", [...draft.figures, v]);
    setFigInput("");
  }
  function removeFigure(v: string) {
    setDraft((d) => {
      const imgs = { ...d.figureImages };
      delete imgs[v];
      return { ...d, figures: d.figures.filter((x) => x !== v), figureImages: imgs };
    });
  }
  async function figureImage(v: string, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const [ref] = await store([files[0]!]);
    setBusy(false);
    if (ref) setDraft((d) => ({ ...d, figureImages: { ...d.figureImages, [v]: ref } }));
  }

  /* Der Entwurf als Profilfelder, für Vorschau und zum Speichern */
  const patch = useMemo(
    () => ({
      name: draft.name.trim(),
      desc: draft.desc.trim(),
      exp: draft.exp.trim(),
      langs: splitComma(draft.langs),
      tags: splitComma(draft.tags),
      includes: splitLines(draft.includes),
      specs: splitComma(draft.specs),
      price: Math.round(Number(draft.price) || 0),
      minHours: draft.minHours,
      loc: draft.loc.trim(),
      radiusKm: draft.radiusKm,
      photos: draft.photos,
      figures: draft.figures,
      figureImages: draft.figureImages,
      contact: {
        email: draft.contact.email.trim(),
        phone: draft.contact.phone.trim(),
        website: draft.contact.website.trim(),
        instagram: draft.contact.instagram.trim().replace(/^@/, ""),
        tiktok: draft.contact.tiktok.trim().replace(/^@/, ""),
      },
    }),
    [draft],
  );
  const preview = { ...a, ...patch } as Artist;

  function save() {
    if (!patch.name) return toast(C.errName);
    if (patch.price < 10 || patch.price > 2000) return toast(C.errPrice);
    if (patch.contact.website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(patch.contact.website))
      return toast(C.errUrl);
    if (patch.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.contact.email))
      return toast(C.errMail);

    /* Bilder, die beim Bearbeiten entfernt wurden, auch aus dem Speicher
       löschen, sonst füllt er sich mit Dateien, auf die nichts mehr zeigt. */
    const keep = new Set([
      ...patch.photos.map((m) => m.id),
      ...Object.values(patch.figureImages).map((m) => m.id),
    ]);
    const before = [
      ...((a["photos"] as MediaRef[] | undefined) || []),
      ...Object.values((a["figureImages"] as Record<string, MediaRef> | undefined) || {}),
    ];
    before.filter((m) => !keep.has(m.id)).forEach((m) => void deleteMedia(m.id));

    updateArtistProfile(a.id, patch);
    setSaved(draft);
    toast(C.saved);
  }

  return (
    <div className="pe">
      <div className="pe-main">
        {/* Gesperrt: aus der Ausweisprüfung */}
        <section className="pe-card pe-locked">
          <div className="pe-card-head">
            <span className="pe-ic lock">
              <Icon name="lock" />
            </span>
            <div>
              <h3>{C.lockedH}</h3>
              <p>{C.lockedP}</p>
            </div>
            <span className={"pe-badge" + (a.verified ? " ok" : "")}>
              <Icon name={a.verified ? "shield" : "clock"} />{" "}
              {a.verified ? C.verified : C.unverified}
            </span>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <span className="pe-label">{C.realName}</span>
              <div className="pe-readonly">
                <span>{real || "—"}</span>
                <Icon name="lock" />
              </div>
            </div>
            <div className="pe-field">
              <span className="pe-label">{C.birth}</span>
              <div className="pe-readonly">
                <span>{birth ? fmtDate(birth) : C.notYet}</span>
                <Icon name="lock" />
              </div>
            </div>
          </div>
        </section>

        {/* Bilder */}
        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="image" />
            </span>
            <div>
              <h3>{C.photosH}</h3>
              <p>{C.photosP}</p>
            </div>
          </div>
          <div className="pe-photos">
            {draft.photos.map((m, i) => (
              <figure className={"pe-photo" + (i === 0 ? " cover" : "")} key={m.id}>
                <span className="pe-photo-img" style={mediaBg(m.id) ?? undefined} />
                {i === 0 && <span className="pe-photo-tag">{C.cover}</span>}
                <figcaption>
                  {i > 0 && (
                    <button type="button" onClick={() => makeCover(i)}>
                      <Icon name="star" /> {C.makeCover}
                    </button>
                  )}
                  <button type="button" className="danger" onClick={() => removePhoto(i)}>
                    <Icon name="trash" /> {C.remove}
                  </button>
                </figcaption>
              </figure>
            ))}
            {draft.photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="pe-photo-add"
                onClick={() => photoInput.current?.click()}
                disabled={busy}
              >
                <Icon name="plus" />
                <span>{C.upload}</span>
                <small>
                  {draft.photos.length}/{MAX_PHOTOS}
                </small>
              </button>
            )}
            <input
              ref={photoInput}
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
        </section>

        {/* Charaktere */}
        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="mask" />
            </span>
            <div>
              <h3>{C.figsH}</h3>
              <p>{C.figsP}</p>
            </div>
          </div>
          {draft.figures.length > 0 && (
            <ul className="pe-figs">
              {draft.figures.map((v) => {
                const img = draft.figureImages[v];
                const style = img ? mediaBg(img.id) : null;
                return (
                  <li key={v} className="pe-fig">
                    <label
                      className={"pe-fig-img" + (style ? " set" : "")}
                      style={style ?? undefined}
                    >
                      {!style && <Icon name="camera" />}
                      <span className="sr-only">{C.figImg}</span>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          void figureImage(v, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <span className="pe-fig-name">
                      {figName(a.cat, v, lang as "de" | "en" | "es")}
                    </span>
                    <button
                      type="button"
                      className="pe-icon-btn"
                      onClick={() => removeFigure(v)}
                      aria-label={C.remove}
                    >
                      <Icon name="close" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="pe-add-row">
            <input
              value={figInput}
              maxLength={40}
              placeholder={C.figPh}
              aria-label={C.figPh}
              onChange={(e) => setFigInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFigure(figInput);
                }
              }}
            />
            <button type="button" className="pe-btn" onClick={() => addFigure(figInput)}>
              <Icon name="plus" /> {C.figAdd}
            </button>
          </div>
          {presets.length > 0 && (
            <div className="pe-suggest">
              <span>{C.figSuggest}</span>
              {presets.slice(0, 10).map((f) => (
                <button type="button" key={f.id} onClick={() => addFigure(f.id)}>
                  <Icon name="plus" /> {figName(a.cat, f.id, lang as "de" | "en" | "es")}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Texte */}
        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="comment" />
            </span>
            <div>
              <h3>{C.textsH}</h3>
            </div>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-name">
                {C.stage}
              </label>
              <input
                id="pe-name"
                maxLength={60}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-exp">
                {C.exp}
              </label>
              <input
                id="pe-exp"
                maxLength={30}
                placeholder={C.expPh}
                value={draft.exp}
                onChange={(e) => set("exp", e.target.value)}
              />
            </div>
          </div>
          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-desc">
              {C.desc}
            </label>
            <textarea
              id="pe-desc"
              rows={3}
              maxLength={400}
              value={draft.desc}
              onChange={(e) => set("desc", e.target.value)}
            />
            <span className="pe-hint">
              {C.descHint} <b>{draft.desc.length}/400</b>
            </span>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-tags">
                {C.tags}
              </label>
              <input
                id="pe-tags"
                placeholder={C.tagsPh}
                value={draft.tags}
                onChange={(e) => set("tags", e.target.value)}
              />
              <span className="pe-hint">{C.listHint}</span>
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-langs">
                {C.langs}
              </label>
              <input
                id="pe-langs"
                placeholder={C.langsPh}
                value={draft.langs}
                onChange={(e) => set("langs", e.target.value)}
              />
              <span className="pe-hint">{C.listHint}</span>
            </div>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-inc">
                {C.includes}
              </label>
              <textarea
                id="pe-inc"
                rows={4}
                placeholder={C.includesPh}
                value={draft.includes}
                onChange={(e) => set("includes", e.target.value)}
              />
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-specs">
                {C.specs}
              </label>
              <textarea
                id="pe-specs"
                rows={4}
                placeholder={C.specsPh}
                value={draft.specs}
                onChange={(e) => set("specs", e.target.value)}
              />
              <span className="pe-hint">{C.listHint}</span>
            </div>
          </div>
        </section>

        {/* Gage */}
        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="money" />
            </span>
            <div>
              <h3>{C.priceH}</h3>
              <p>{isPlanner ? C.pkgNote : C.priceP}</p>
            </div>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-price">
                {C.hourly}
              </label>
              <div className="pe-money">
                <input
                  id="pe-price"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={2000}
                  step={5}
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                />
                <span>€</span>
              </div>
            </div>
            {!isPlanner && (
              <div className="pe-field">
                <label className="pe-label" htmlFor="pe-min">
                  {C.minHours}
                </label>
                <select
                  id="pe-min"
                  value={draft.minHours}
                  onChange={(e) => set("minHours", Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {C.hoursN(n)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!isPlanner && patch.price > 0 && (
            <p className="pe-note">
              <Icon name="eye" /> {C.preview(fmt(Math.round(patch.price * 1.2)))}
            </p>
          )}
        </section>

        {/* Kontakt */}
        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="phone" />
            </span>
            <div>
              <h3>{C.contactH}</h3>
              <p>{C.contactP}</p>
            </div>
          </div>
          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-loc">
              {C.loc}
            </label>
            <CityAutocomplete
              id="pe-loc"
              value={draft.loc}
              onChange={(v) => set("loc", v)}
              showScopeToggle={false}
            />
          </div>
          <div className="pe-field">
            <label className="pe-label" htmlFor="pe-radius">
              {C.radius}
            </label>
            <select
              id="pe-radius"
              value={draft.radiusKm}
              onChange={(e) => set("radiusKm", Number(e.target.value))}
            >
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {travelOption(km, lang)}
                </option>
              ))}
            </select>
            <span className="pe-hint">{C.radiusHint}</span>
          </div>
          <div className="pe-grid2">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-mail">
                {C.email}
              </label>
              <input
                id="pe-mail"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={draft.contact.email}
                onChange={(e) => setContact("email", e.target.value)}
              />
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-phone">
                {C.phone}
              </label>
              <input
                id="pe-phone"
                type="tel"
                autoComplete="tel"
                maxLength={30}
                value={draft.contact.phone}
                onChange={(e) => setContact("phone", e.target.value)}
              />
            </div>
          </div>
          <div className="pe-grid3">
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-web">
                {C.website}
              </label>
              <input
                id="pe-web"
                type="url"
                placeholder="https://"
                maxLength={200}
                value={draft.contact.website}
                onChange={(e) => setContact("website", e.target.value)}
              />
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-ig">
                {C.instagram}
              </label>
              <div className="pe-prefix">
                <span>@</span>
                <input
                  id="pe-ig"
                  maxLength={30}
                  value={draft.contact.instagram}
                  onChange={(e) => setContact("instagram", e.target.value)}
                />
              </div>
            </div>
            <div className="pe-field">
              <label className="pe-label" htmlFor="pe-tt">
                {C.tiktok}
              </label>
              <div className="pe-prefix">
                <span>@</span>
                <input
                  id="pe-tt"
                  maxLength={30}
                  value={draft.contact.tiktok}
                  onChange={(e) => setContact("tiktok", e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="pe-side">
        <div className="pe-side-card">
          <span className="pe-label">{C.cardPreview}</span>
          <div className="pe-preview">
            <ArtistCard a={preview} />
          </div>
          <p className="pe-side-cat">{catLabel(a.cat)}</p>
          <button
            type="button"
            className="home-btn primary wide"
            onClick={save}
            disabled={!dirty || busy}
          >
            <Icon name="check" /> {C.save}
          </button>
          <button
            type="button"
            className="home-btn soft wide"
            onClick={() => navigate({ to: "/kuenstler/$id", params: { id: String(a.id) } })}
          >
            {C.view} <Icon name="arrow" />
          </button>
        </div>
      </aside>

      {/* Leiste unten, sobald etwas geändert wurde */}
      <div className={"pe-savebar" + (dirty ? " on" : "")} role="status" aria-live="polite">
        <span>
          <i /> {C.unsaved}
        </span>
        <div>
          <button type="button" className="home-btn soft" onClick={() => setDraft(saved)}>
            {C.discard}
          </button>
          <button type="button" className="home-btn primary" onClick={save} disabled={busy}>
            {C.save}
          </button>
        </div>
      </div>
    </div>
  );
}
