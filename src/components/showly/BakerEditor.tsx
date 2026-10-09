/* Profil bearbeiten für Torten-Anbieter: Fotos, Texte, Liefergebiet,
   Kontakt und die eigenen Angebote. Aufbau wie der Profil-Editor der
   Künstler. Art des Anbieters (privat oder Konditorei), Bewertungen und
   Prüfsiegel ändert der Anbieter nicht selbst. */
import { TaxNotice } from "@/components/showly/ProviderNotices";
import { useEffect, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { deleteMedia, isCloudMedia, refreshMediaStatus, type MediaRef } from "@/showly/media";
import { PhotosPick, useImageStore } from "@/components/showly/ImagePick";
import { MediaStatusBadge, MediaThumb } from "@/components/showly/MediaView";
import { KindBadge, SweetCard, catName } from "@/components/showly/Sweets";
import {
  SWEET_CATS,
  removeSweet,
  saveSweet,
  sweetsOf,
  updateBaker,
  type Baker,
  type Sweet,
  type SweetCat,
  type Unit,
  isDirectSweet,
} from "@/showly/sweets";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";
import { FoodFields, emptyFood, useFoodCopy } from "@/components/showly/FoodInfo";
import { cleanFoodInfo, foodInfoComplete, type FoodInfo } from "@/showly/cakeRules";
import { BankForm, ConnectBox } from "@/components/showly/PayoutPanel";

const noop = () => undefined;
import { isCloudId, removeSweetCloud, saveBakerCloud, saveSweetCloud } from "@/showly/cloudProviders";

const MAX_PHOTOS = 8;

const TEXT = {
  de: {
    kindH: "Anbieterart",
    kindP: "Wurde bei der Anmeldung festgelegt. Für eine Änderung schreib uns.",
    photosH: "Fotos & Videos",
    photosP: "Das erste Foto ist dein Titelbild. Zeig deine schönsten Torten, gern auch im Video (bis 60 Sekunden, läuft ohne Ton). Jede Datei wird vor dem Speichern automatisch geprüft: Telefonnummern, E-Mail-Adressen, Webseiten, Social-Media-Namen und QR-Codes sind nicht erlaubt.",
    upload: "Fotos oder Videos hochladen",
    cover: "Titelbild",
    makeCover: "Als Titelbild",
    remove: "Entfernen",
    textH: "Texte",
    name: "Name im Profil",
    tagline: "Kurzbeschreibung",
    about: "Über dich",
    areaH: "Ort & Lieferung",
    city: "Stadt",
    radius: "Lieferung bis (km)",
    radiusHint: "0 = nur Abholung",
    lead: "Vorlauf (Tage)",
    specH: "Spezialitäten",
    diets: "Ernährung (mit Komma getrennt)",
    dietsPh: "vegan, glutenfrei …",
    contactH: "Kontakt",
    contactP: "Wird Kunden erst nach deiner Zusage angezeigt.",
    email: "E-Mail",
    phone: "Telefon",
    website: "Webseite",
    instagram: "Instagram",
    offersH: "Deine Angebote",
    offersP: "Preis pro Person, pro Stück oder als Paket.",
    add: "Angebot hinzufügen",
    edit: "Bearbeiten",
    del: "Löschen",
    save: "Speichern",
    cancel: "Abbrechen",
    unsaved: "Ungespeicherte Änderungen",
    saved: "Profil gespeichert.",
    offerSaved: "Angebot gespeichert.",
    offerNeed: "Bitte Name und Preis angeben.",
    offerName: "Name des Angebots",
    offerDesc: "Beschreibung",
    cat: "Kategorie",
    price: "Preis",
    unit: "Einheit",
    units: { person: "pro Person", piece: "pro Stück", set: "Paketpreis" } as Record<Unit, string>,
    minQty: "Mindestmenge",
    photo: "Foto",
    needName: "Bitte einen Namen angeben.",
  },
  en: {
    kindH: "Provider type",
    kindP: "Set at sign-up. Contact us to change it.",
    photosH: "Photos & videos",
    photosP: "The first photo is your cover. Show your best cakes, videos welcome too (up to 60 seconds, played without sound). Every file is checked automatically before it is saved: phone numbers, email addresses, websites, social media handles and QR codes are not allowed.",
    upload: "Upload photos or videos",
    cover: "Cover",
    makeCover: "Make cover",
    remove: "Remove",
    textH: "Texts",
    name: "Profile name",
    tagline: "Short description",
    about: "About you",
    areaH: "Location & delivery",
    city: "City",
    radius: "Delivery up to (km)",
    radiusHint: "0 = pickup only",
    lead: "Notice (days)",
    specH: "Specialities",
    diets: "Diets (comma separated)",
    dietsPh: "vegan, gluten-free …",
    contactH: "Contact",
    contactP: "Shown to customers only after you confirm.",
    email: "Email",
    phone: "Phone",
    website: "Website",
    instagram: "Instagram",
    offersH: "Your offers",
    offersP: "Price per person, per piece or as a package.",
    add: "Add offer",
    edit: "Edit",
    del: "Delete",
    save: "Save",
    cancel: "Cancel",
    unsaved: "Unsaved changes",
    saved: "Profile saved.",
    offerSaved: "Offer saved.",
    offerNeed: "Please add a name and price.",
    offerName: "Offer name",
    offerDesc: "Description",
    cat: "Category",
    price: "Price",
    unit: "Unit",
    units: { person: "per person", piece: "per piece", set: "package price" } as Record<Unit, string>,
    minQty: "Minimum quantity",
    photo: "Photo",
    needName: "Please add a name.",
  },
  es: {
    kindH: "Tipo de proveedor",
    kindP: "Se fijó al registrarte. Escríbenos para cambiarlo.",
    photosH: "Fotos y vídeos",
    photosP: "La primera foto es tu portada. Muestra tus mejores tartas, también en vídeo (hasta 60 segundos, sin sonido). Cada archivo se comprueba automáticamente antes de guardarlo: no se permiten teléfonos, correos, webs, perfiles de redes sociales ni códigos QR.",
    upload: "Subir fotos o vídeos",
    cover: "Portada",
    makeCover: "Usar de portada",
    remove: "Quitar",
    textH: "Textos",
    name: "Nombre del perfil",
    tagline: "Descripción corta",
    about: "Sobre ti",
    areaH: "Lugar y entrega",
    city: "Ciudad",
    radius: "Entrega hasta (km)",
    radiusHint: "0 = solo recogida",
    lead: "Antelación (días)",
    specH: "Especialidades",
    diets: "Dietas (separadas por comas)",
    dietsPh: "vegano, sin gluten …",
    contactH: "Contacto",
    contactP: "Se muestra al cliente solo tras tu confirmación.",
    email: "Correo",
    phone: "Teléfono",
    website: "Web",
    instagram: "Instagram",
    offersH: "Tus ofertas",
    offersP: "Precio por persona, por unidad o por paquete.",
    add: "Añadir oferta",
    edit: "Editar",
    del: "Eliminar",
    save: "Guardar",
    cancel: "Cancelar",
    unsaved: "Cambios sin guardar",
    saved: "Perfil guardado.",
    offerSaved: "Oferta guardada.",
    offerNeed: "Indica nombre y precio.",
    offerName: "Nombre de la oferta",
    offerDesc: "Descripción",
    cat: "Categoría",
    price: "Precio",
    unit: "Unidad",
    units: { person: "por persona", piece: "por unidad", set: "precio por paquete" } as Record<Unit, string>,
    minQty: "Cantidad mínima",
    photo: "Foto",
    needName: "Indica un nombre.",
  },
};
type T = (typeof TEXT)["de"];

interface Draft {
  name: string;
  tagline: string;
  about: string;
  city: string;
  radiusKm: number;
  leadDays: number;
  maxPerDay: number;
  specialties: SweetCat[];
  diets: string;
  photos: MediaRef[];
  contact: { email: string; phone: string; website: string; instagram: string };
}

export function BakerEditor({ b, onSaved }: { b: Baker; onSaved: () => void }) {
  /* Profil aus der Datenbank: Änderungen gehen an den Server */
  const cloud = isCloudId(b.id);
  const okText = useContactCheck();
  const { L, lang, toast, refreshCloud } = useShowly();
  const X = (TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de) as T;
  const store = useImageStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const init = (): Draft => ({
    name: String(L(b.name)),
    tagline: String(L(b.tagline)),
    about: String(L(b.about)),
    city: b.city,
    radiusKm: b.radiusKm,
    leadDays: b.leadDays,
    maxPerDay: b.maxPerDay ?? 0,
    specialties: [...b.specialties],
    diets: (b.diets || []).join(", "),
    photos: [...(b.photos || [])],
    contact: {
      email: b.contact?.email || "",
      phone: b.contact?.phone || "",
      website: b.contact?.website || "",
      instagram: b.contact?.instagram || "",
    },
  });
  const [saved, setSaved] = useState<Draft>(init);
  const [draft, setDraft] = useState<Draft>(init);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  /* Prüfstatus der Server-Dateien beim Öffnen aktuell holen */
  useEffect(() => {
    void refreshMediaStatus(draft.photos.map((m) => m.id).filter(isCloudMedia));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setContact = (k: keyof Draft["contact"], v: string) =>
    setDraft((d) => ({ ...d, contact: { ...d.contact, [k]: v } }));
  const int = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

  /* Das Titelbild muss ein Foto sein: steht ein Video vorn, rückt das erste Foto nach vorn */
  function coverFirst(list: MediaRef[]): MediaRef[] {
    if (!list.length || list[0]!.kind !== "video") return list;
    const k = list.findIndex((m) => m.kind !== "video");
    if (k < 0) return list;
    const next = list.slice();
    const [m] = next.splice(k, 1);
    return [m!, ...next];
  }

  async function addPhotos(files: FileList | null) {
    const room = MAX_PHOTOS - draft.photos.length;
    if (!files?.length || room <= 0) return;
    setBusy(true);
    const refs = await store(files, room, true);
    setBusy(false);
    setDraft((d) => ({ ...d, photos: coverFirst([...d.photos, ...refs]) }));
  }

  function save() {
    if (!draft.name.trim()) return toast(X.needName);
    if (!okText(draft.name, draft.tagline, draft.about)) return;
    if (cloud) {
      void saveBakerCloud({
        ...b,
        name: draft.name.trim().slice(0, 80),
        tagline: draft.tagline.trim().slice(0, 120),
        about: draft.about.trim().slice(0, 1500),
        city: draft.city.trim().slice(0, 60),
        radiusKm: draft.radiusKm,
        leadDays: Math.max(1, draft.leadDays),
        maxPerDay: draft.maxPerDay,
        specialties: draft.specialties.length ? draft.specialties : b.specialties,
        photos: draft.photos,
        diets: draft.diets
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 8),
      }).then(async (r) => {
        if ("error" in r) return toast(r.error);
        await refreshCloud();
        setSaved(draft);
        toast(X.saved);
        onSaved();
      });
      return;
    }
    updateBaker(b.id, {
      name: draft.name.trim().slice(0, 80),
      tagline: draft.tagline.trim().slice(0, 120),
      about: draft.about.trim().slice(0, 1500),
      city: draft.city.trim().slice(0, 60),
      radiusKm: draft.radiusKm,
      leadDays: Math.max(1, draft.leadDays),
      maxPerDay: draft.maxPerDay,
      specialties: draft.specialties.length ? draft.specialties : b.specialties,
      diets: draft.diets
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
      photos: draft.photos,
      contact: draft.contact,
    });
    /* Entfernte Fotos auch aus dem Speicher nehmen */
    const keep = new Set(draft.photos.map((m) => m.id));
    for (const m of saved.photos) if (!keep.has(m.id)) void deleteMedia(m.id);
    setSaved(draft);
    toast(X.saved);
    onSaved();
  }

  return (
    <div className="pe bk-editor">
      <div className="pe-main">
        <section className="pe-card pe-locked">
          <div className="pe-card-head">
            <span className="pe-ic lock">
              <Icon name="lock" />
            </span>
            <div>
              <h3>{X.kindH}</h3>
              <p>{X.kindP}</p>
            </div>
            <KindBadge b={b} />
          </div>
        </section>

        {cloud ? <ConnectBox onState={noop} /> : <BankForm ownerKey={`baker:${b.id}`} />}
        <TaxNotice />

        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="image" />
            </span>
            <div>
              <h3>{X.photosH}</h3>
              <p>{X.photosP}</p>
            </div>
          </div>
          <div className="pe-photos">
            {draft.photos.map((m, i) => (
              <figure className={"pe-photo" + (i === 0 && m.kind !== "video" ? " cover" : "")} key={m.id}>
                {m.kind === "video" ? (
                  <span className="pe-photo-img pe-photo-video">
                    <MediaThumb item={m} />
                  </span>
                ) : (
                  <span className="pe-photo-img" style={mediaBg(m.id) ?? undefined} />
                )}
                {i === 0 && m.kind !== "video" && <span className="pe-photo-tag">{X.cover}</span>}
                <MediaStatusBadge id={m.id} lang={lang} />
                <figcaption>
                  {i > 0 && m.kind !== "video" && (
                    <button
                      type="button"
                      onClick={() =>
                        set("photos", [m, ...draft.photos.filter((_, k) => k !== i)])
                      }
                    >
                      <Icon name="star" /> {X.makeCover}
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => set("photos", coverFirst(draft.photos.filter((_, k) => k !== i)))}
                  >
                    <Icon name="trash" /> {X.remove}
                  </button>
                </figcaption>
              </figure>
            ))}
            {draft.photos.length < MAX_PHOTOS && (
              <button type="button" className="pe-photo-add" onClick={() => input.current?.click()} disabled={busy}>
                <Icon name={store.label ? "shield" : "plus"} />
                <span>{store.label ?? X.upload}</span>
                <small>
                  {draft.photos.length}/{MAX_PHOTOS}
                </small>
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="clipboard" />
            </span>
            <div>
              <h3>{X.textH}</h3>
            </div>
          </div>
          <label className="pe-field">
            <span className="pe-label">{X.name}</span>
            <input value={draft.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="pe-field">
            <span className="pe-label">{X.tagline}</span>
            <input value={draft.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} />
          </label>
          <label className="pe-field">
            <span className="pe-label">{X.about}</span>
            <textarea rows={6} value={draft.about} maxLength={1500} onChange={(e) => set("about", e.target.value)} />
            <ContactHint text={draft.about + "\n" + draft.tagline} />
            <span className="pe-hint">
              <b>{draft.about.length}/1500</b>
            </span>
          </label>
        </section>

        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="pin" />
            </span>
            <div>
              <h3>{X.areaH}</h3>
            </div>
          </div>
          <div className="pe-grid3">
            <label className="pe-field">
              <span className="pe-label">{X.city}</span>
              <input value={draft.city} maxLength={60} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{X.radius}</span>
              <input type="number" min={0} max={300} value={draft.radiusKm} onChange={(e) => set("radiusKm", int(e.target.value, 300))} />
              <span className="pe-hint">{X.radiusHint}</span>
            </label>
            <label className="pe-field">
              <span className="pe-label">{X.lead}</span>
              <input type="number" min={1} max={120} value={draft.leadDays} onChange={(e) => set("leadDays", int(e.target.value, 120))} />
            </label>
          </div>
          <label className="pe-field">
            <span className="pe-label">{CAP[(lang as "de" | "en" | "es") ?? "de"]?.h ?? CAP.de.h}</span>
            <input type="number" min={0} max={500} value={draft.maxPerDay} onChange={(e) => set("maxPerDay", int(e.target.value, 500))} />
            <span className="pe-hint">{CAP[(lang as "de" | "en" | "es") ?? "de"]?.p ?? CAP.de.p}</span>
          </label>
        </section>

        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="star" />
            </span>
            <div>
              <h3>{X.specH}</h3>
            </div>
          </div>
          <SpecPicker value={draft.specialties} onChange={(v) => set("specialties", v)} />
          <label className="pe-field">
            <span className="pe-label">{X.diets}</span>
            <input value={draft.diets} placeholder={X.dietsPh} maxLength={200} onChange={(e) => set("diets", e.target.value)} />
          </label>
        </section>

        <section className="pe-card">
          <div className="pe-card-head">
            <span className="pe-ic">
              <Icon name="mail" />
            </span>
            <div>
              <h3>{X.contactH}</h3>
              <p>{X.contactP}</p>
            </div>
          </div>
          <div className="pe-grid2">
            {(["email", "phone", "website", "instagram"] as const).map((k) => (
              <label className="pe-field" key={k}>
                <span className="pe-label">{X[k]}</span>
                <input
                  type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                  value={draft.contact[k]}
                  maxLength={120}
                  onChange={(e) => setContact(k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <OffersEditor b={b} X={X} />
      </div>

      <div className={"pe-savebar" + (dirty ? " on" : "")} aria-hidden={!dirty}>
        <span>
          <i /> {X.unsaved}
        </span>
        <div>
          <button className="home-btn soft" onClick={() => setDraft(saved)} tabIndex={dirty ? 0 : -1}>
            {X.cancel}
          </button>
          <button className="home-btn primary" onClick={save} tabIndex={dirty ? 0 : -1}>
            {X.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SpecPicker({ value, onChange }: { value: SweetCat[]; onChange: (v: SweetCat[]) => void }) {
  const { lang } = useShowly();
  return (
    <div className="occ-row in-form">
      {SWEET_CATS.map((c) => {
        const on = value.includes(c);
        return (
          <button
            type="button"
            key={c}
            className={"occ-chip" + (on ? " on" : "")}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
          >
            {catName(c, lang)}
          </button>
        );
      })}
    </div>
  );
}

/* Tageskapazität der Backstube */
const CAP = {
  de: { h: "Höchstens Aufträge pro Tag", p: "0 = ohne Grenze. Ist ein Tag voll, können Kunden ihn nicht mehr wählen." },
  en: { h: "Max. orders per day", p: "0 = no limit. Once a day is full, customers can't pick it anymore." },
  es: { h: "Máx. pedidos por día", p: "0 = sin límite. Cuando un día está completo, los clientes ya no pueden elegirlo." },
} as const;

export interface OfferDraft {
  id?: number | undefined;
  name: string;
  desc: string;
  cat: SweetCat;
  price: string;
  unit: Unit;
  minQty: number;
  photo?: MediaRef | undefined;
  /** alle Fotos des Angebots, das erste ist das Titelbild */
  photos?: MediaRef[] | undefined;
  /** Geschmacksrichtungen, durch Komma getrennt */
  flavors?: string | undefined;
  img?: number | undefined;
  /** direkt buchbar zum Festpreis; ohne Angabe gilt die Regel je Kategorie */
  direct?: boolean | undefined;
  /** Allergene, Zutaten, Haltbarkeit (Pflicht) */
  food: FoodInfo;
  leadDays?: number | undefined;
}

/* Geschmacksrichtungen eines Angebots */
const FLAVOR = {
  de: { l: "Geschmacksrichtungen (mit Komma getrennt)", ph: "z. B. Vanille, Schokolade, Himbeere" },
  en: { l: "Flavours (separated by commas)", ph: "e.g. vanilla, chocolate, raspberry" },
  es: { l: "Sabores (separados por comas)", ph: "p. ej. vainilla, chocolate, frambuesa" },
} as const;
export const flavorList = (v: string | undefined) =>
  String(v || "")
    .split(/[,;\n]/)
    .map((x) => x.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);

export const emptyOffer = (cat: SweetCat = "birthday"): OfferDraft => ({
  name: "",
  desc: "",
  cat,
  price: "",
  unit: "set",
  minQty: 1,
  food: emptyFood(),
});

export function parsePrice(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 100000) : 0;
}

/** Felder eines Angebots, auch im Anmeldeformular genutzt */
/* Direkt buchbar oder nur auf Anfrage, je Angebot */
const DIRECT = {
  de: {
    h: "Wie wird dieses Angebot gebucht?",
    yes: "Direkt buchbar zum Festpreis",
    yesP: "Für feste Pakete, z. B. 20 Macarons oder 12 Cupcakes. Kunden buchen und bezahlen sofort.",
    no: "Nur auf Anfrage",
    noP: "Für individuelle Torten mit Motiv, Etagen oder Text. Du bestätigst Termin und Endpreis.",
  },
  en: {
    h: "How is this offer booked?",
    yes: "Instant booking at a fixed price",
    yesP: "For fixed packages, e.g. 20 macarons or 12 cupcakes. Customers book and pay right away.",
    no: "Request only",
    noP: "For custom cakes with a theme, tiers or text. You confirm date and final price.",
  },
  es: {
    h: "¿Cómo se reserva esta oferta?",
    yes: "Reserva inmediata a precio fijo",
    yesP: "Para paquetes fijos, p. ej. 20 macarons o 12 cupcakes. El cliente reserva y paga al momento.",
    no: "Solo por solicitud",
    noP: "Para tartas personalizadas con motivo, pisos o texto. Tú confirmas fecha y precio final.",
  },
} as const;

export function OfferFields({
  d,
  onChange,
}: {
  d: OfferDraft;
  onChange: (d: OfferDraft) => void;
}) {
  const { lang } = useShowly();
  const X = (TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de) as T;
  const up = <K extends keyof OfferDraft>(k: K, v: OfferDraft[K]) => onChange({ ...d, [k]: v });
  return (
    <>
      <div className="pe-field">
        <span className="pe-label">{X.photo}</span>
        <PhotosPick
          value={d.photos ?? (d.photo ? [d.photo] : [])}
          onChange={(list) => onChange({ ...d, photos: list, photo: list[0] })}
          fallback={d.img ? { backgroundImage: `url('/sweets/${d.img}.webp')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
      </div>
      <label className="pe-field">
        <span className="pe-label">{X.offerName}</span>
        <input value={d.name} maxLength={100} onChange={(e) => up("name", e.target.value)} />
      </label>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">{X.cat}</span>
          <select value={d.cat} onChange={(e) => up("cat", e.target.value as SweetCat)}>
            {SWEET_CATS.map((c) => (
              <option key={c} value={c}>
                {catName(c, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="pe-field">
          <span className="pe-label">{X.unit}</span>
          <select
            value={d.unit}
            onChange={(e) => {
              const u = e.target.value as Unit;
              onChange({ ...d, unit: u, minQty: u === "set" ? 1 : Math.max(d.minQty, u === "person" ? 10 : 12) });
            }}
          >
            {(["set", "person", "piece"] as Unit[]).map((u) => (
              <option key={u} value={u}>
                {X.units[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">{X.price}</span>
          <span className="pe-money">
            <input inputMode="decimal" value={d.price} onChange={(e) => up("price", e.target.value)} />
            <span>€</span>
          </span>
        </label>
        {d.unit !== "set" && (
          <label className="pe-field">
            <span className="pe-label">{X.minQty}</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={d.minQty}
              onChange={(e) => up("minQty", Math.min(2000, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
            />
          </label>
        )}
      </div>
      <label className="pe-field">
        <span className="pe-label">{X.offerDesc}</span>
        <textarea value={d.desc} maxLength={600} onChange={(e) => up("desc", e.target.value)} />
        <ContactHint text={d.name + "\n" + d.desc} />
      </label>
      <label className="pe-field">
        <span className="pe-label">{FLAVOR[lang as "de" | "en" | "es"]?.l ?? FLAVOR.de.l}</span>
        <input
          value={d.flavors ?? ""}
          maxLength={300}
          placeholder={FLAVOR[lang as "de" | "en" | "es"]?.ph ?? FLAVOR.de.ph}
          onChange={(e) => up("flavors", e.target.value)}
        />
        <ContactHint text={d.flavors ?? ""} />
      </label>
      <FoodFields f={d.food} onChange={(f) => up("food", f)} leadDays={d.leadDays} onLead={(n) => up("leadDays", n)} />
      <fieldset className="pe-mode">
        <legend className="pe-label">
          {DIRECT[lang as "de" | "en" | "es"]?.h ?? DIRECT.de.h}
        </legend>
        {([true, false] as const).map((v) => {
          const D = DIRECT[lang as "de" | "en" | "es"] ?? DIRECT.de;
          const on = (d.direct ?? isDirectSweet({ cat: d.cat })) === v;
          return (
            <label
              className={"pe-mode-opt" + (on ? " on" : "")}
              key={String(v)}
            >
              <input
                type="radio"
                name={"offer-direct-" + (d.id ?? "new")}
                checked={on}
                onChange={() => up("direct", v)}
              />
              <span className="pe-mode-ic">
                <Icon name={v ? "cart" : "mail"} />
              </span>
              <span className="pe-mode-text">
                <b>{v ? D.yes : D.no}</b>
                <small>{v ? D.yesP : D.noP}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
    </>
  );
}

function OffersEditor({ b, X }: { b: Baker; X: T }) {
  const okText = useContactCheck();
  const { L, toast, refreshCloud } = useShowly();
  const cloud = isCloudId(b.id);
  const [, bump] = useState(0);
  const [open, setOpen] = useState<OfferDraft | null>(null);
  const list = sweetsOf(b.id);
  const foodNeed = useFoodCopy().need;

  function edit(s: Sweet) {
    setOpen({
      id: s.id,
      name: String(L(s.name)),
      desc: String(L(s.desc)),
      cat: s.cat,
      price: String(s.price),
      unit: s.unit,
      minQty: s.minQty,
      photo: s.photo,
      photos: s.photos ?? (s.photo ? [s.photo] : []),
      flavors: (s.flavors ?? []).join(", "),
      img: s.img,
      direct: isDirectSweet(s),
      food: s.food ?? emptyFood(),
      leadDays: s.leadDays,
    });
  }

  function commit() {
    if (!open) return;
    const price = parsePrice(open.price);
    if (!open.name.trim() || !price) return toast(X.offerNeed);
    if (!foodInfoComplete(cleanFoodInfo(open.food))) return toast(foodNeed);
    if (!okText(open.name, open.desc, open.flavors ?? "")) return;
    const photos = open.photos ?? (open.photo ? [open.photo] : []);
    const flavors = flavorList(open.flavors);
    const food = cleanFoodInfo(open.food)!;
    const prev = open.id ? list.find((s) => s.id === open.id) : undefined;
    /* entfernte Fotos löschen */
    {
      const keep = new Set(photos.map((m) => m.id));
      for (const m of prev?.photos ?? (prev?.photo ? [prev.photo] : [])) if (!keep.has(m.id)) void deleteMedia(m.id);
    }
    if (cloud) {
      void saveSweetCloud({
        id: open.id,
        name: open.name.trim().slice(0, 100),
        desc: open.desc.trim().slice(0, 600),
        cat: open.cat,
        price,
        unit: open.unit,
        minQty: open.unit === "set" ? 1 : open.minQty,
        img: open.img,
        photos,
        flavors,
        direct: open.direct ?? isDirectSweet({ cat: open.cat }),
        food,
        leadDays: open.leadDays,
      }).then(async (r) => {
        if ("error" in r) return toast(r.error);
        await refreshCloud();
        toast(X.offerSaved);
        setOpen(null);
        bump((n) => n + 1);
      });
      return;
    }
    saveSweet({
      id: open.id,
      bakerId: b.id,
      name: open.name.trim().slice(0, 100),
      desc: open.desc.trim().slice(0, 600),
      cat: open.cat,
      price,
      unit: open.unit,
      minQty: open.unit === "set" ? 1 : open.minQty,
      photo: photos[0],
      photos,
      flavors,
      img: photos.length ? undefined : open.img,
      direct: open.direct ?? isDirectSweet({ cat: open.cat }),
      food,
      leadDays: open.leadDays,
    });
    toast(X.offerSaved);
    setOpen(null);
    bump((n) => n + 1);
  }

  function del(s: Sweet) {
    for (const m of s.photos ?? (s.photo ? [s.photo] : [])) void deleteMedia(m.id);
    if (cloud) {
      void removeSweetCloud(s.id).then(() => bump((n) => n + 1));
      return;
    }
    removeSweet(s.id);
    bump((n) => n + 1);
  }

  return (
    <section className="pe-card">
      <div className="pe-card-head">
        <span className="pe-ic">
          <Icon name="gift" />
        </span>
        <div>
          <h3>{X.offersH}</h3>
          <p>{X.offersP}</p>
        </div>
      </div>
      {list.length > 0 && (
        <div className="act-grid prod-grid bk-offers">
          {list.map((s) => (
            <SweetCard
              key={s.id}
              s={s}
              showBaker={false}
              actions={
                <div className="prod-btns">
                  <button className="prod-btn ghost" onClick={() => edit(s)}>
                    {X.edit}
                  </button>
                  <button className="prod-btn ghost danger" onClick={() => del(s)}>
                    <Icon name="trash" /> {X.del}
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
      {open ? (
        <div className="bk-offer-form">
          <OfferFields d={open} onChange={setOpen} />
          <div className="bk-offer-btns">
            <button className="home-btn soft" onClick={() => setOpen(null)}>
              {X.cancel}
            </button>
            <button className="home-btn primary" onClick={commit}>
              {X.save}
            </button>
          </div>
        </div>
      ) : (
        <button className="pe-btn bk-add" onClick={() => setOpen(emptyOffer(b.specialties[0]))}>
          <Icon name="plus" /> {X.add}
        </button>
      )}
    </section>
  );
}
