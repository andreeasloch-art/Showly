/* Profil bearbeiten für Torten-Anbieter: Fotos, Texte, Liefergebiet,
   Kontakt und die eigenen Angebote. Aufbau wie der Profil-Editor der
   Künstler. Art des Anbieters (privat oder Konditorei), Bewertungen und
   Prüfsiegel ändert der Anbieter nicht selbst. */
import { useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, mediaBg } from "@/showly/ui";
import { deleteMedia, type MediaRef } from "@/showly/media";
import { ImagePick, useImageStore } from "@/components/showly/ImagePick";
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
} from "@/showly/sweets";

const MAX_PHOTOS = 8;

const TEXT = {
  de: {
    kindH: "Anbieterart",
    kindP: "Wurde bei der Anmeldung festgelegt. Für eine Änderung schreib uns.",
    photosH: "Fotos",
    photosP: "Das erste Foto ist dein Titelbild. Zeig deine schönsten Torten.",
    upload: "Fotos hochladen",
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
    photosH: "Photos",
    photosP: "The first photo is your cover. Show your best cakes.",
    upload: "Upload photos",
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
    photosH: "Fotos",
    photosP: "La primera foto es tu portada. Muestra tus mejores tartas.",
    upload: "Subir fotos",
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
  specialties: SweetCat[];
  diets: string;
  photos: MediaRef[];
  contact: { email: string; phone: string; website: string; instagram: string };
}

export function BakerEditor({ b, onSaved }: { b: Baker; onSaved: () => void }) {
  const { L, lang, toast } = useShowly();
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

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setContact = (k: keyof Draft["contact"], v: string) =>
    setDraft((d) => ({ ...d, contact: { ...d.contact, [k]: v } }));
  const int = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

  async function addPhotos(files: FileList | null) {
    const room = MAX_PHOTOS - draft.photos.length;
    if (!files?.length || room <= 0) return;
    setBusy(true);
    const refs = await store(files, room);
    setBusy(false);
    setDraft((d) => ({ ...d, photos: [...d.photos, ...refs] }));
  }

  function save() {
    if (!draft.name.trim()) return toast(X.needName);
    updateBaker(b.id, {
      name: draft.name.trim().slice(0, 80),
      tagline: draft.tagline.trim().slice(0, 120),
      about: draft.about.trim().slice(0, 1500),
      city: draft.city.trim().slice(0, 60),
      radiusKm: draft.radiusKm,
      leadDays: Math.max(1, draft.leadDays),
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
              <figure className={"pe-photo" + (i === 0 ? " cover" : "")} key={m.id}>
                <span className="pe-photo-img" style={mediaBg(m.id) ?? undefined} />
                {i === 0 && <span className="pe-photo-tag">{X.cover}</span>}
                <figcaption>
                  {i > 0 && (
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
                    onClick={() => set("photos", draft.photos.filter((_, k) => k !== i))}
                  >
                    <Icon name="trash" /> {X.remove}
                  </button>
                </figcaption>
              </figure>
            ))}
            {draft.photos.length < MAX_PHOTOS && (
              <button type="button" className="pe-photo-add" onClick={() => input.current?.click()} disabled={busy}>
                <Icon name="plus" />
                <span>{X.upload}</span>
                <small>
                  {draft.photos.length}/{MAX_PHOTOS}
                </small>
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

export interface OfferDraft {
  id?: number | undefined;
  name: string;
  desc: string;
  cat: SweetCat;
  price: string;
  unit: Unit;
  minQty: number;
  photo?: MediaRef | undefined;
  img?: number | undefined;
}

export const emptyOffer = (cat: SweetCat = "birthday"): OfferDraft => ({
  name: "",
  desc: "",
  cat,
  price: "",
  unit: "set",
  minQty: 1,
});

export function parsePrice(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 100000) : 0;
}

/** Felder eines Angebots, auch im Anmeldeformular genutzt */
export function OfferFields({ d, onChange }: { d: OfferDraft; onChange: (d: OfferDraft) => void }) {
  const { lang } = useShowly();
  const X = (TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de) as T;
  const up = <K extends keyof OfferDraft>(k: K, v: OfferDraft[K]) => onChange({ ...d, [k]: v });
  return (
    <>
      <div className="pe-field">
        <span className="pe-label">{X.photo}</span>
        <ImagePick value={d.photo} onChange={(m) => up("photo", m)} fallback={d.img ? { backgroundImage: `url('/sweets/${d.img}.svg')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
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
      </label>
    </>
  );
}

function OffersEditor({ b, X }: { b: Baker; X: T }) {
  const { L, toast } = useShowly();
  const [, bump] = useState(0);
  const [open, setOpen] = useState<OfferDraft | null>(null);
  const list = sweetsOf(b.id);

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
      img: s.img,
    });
  }

  function commit() {
    if (!open) return;
    const price = parsePrice(open.price);
    if (!open.name.trim() || !price) return toast(X.offerNeed);
    const prev = open.id ? list.find((s) => s.id === open.id) : undefined;
    if (prev?.photo && prev.photo.id !== open.photo?.id) void deleteMedia(prev.photo.id);
    saveSweet({
      id: open.id,
      bakerId: b.id,
      name: open.name.trim().slice(0, 100),
      desc: open.desc.trim().slice(0, 600),
      cat: open.cat,
      price,
      unit: open.unit,
      minQty: open.unit === "set" ? 1 : open.minQty,
      photo: open.photo,
      img: open.photo ? undefined : open.img,
    });
    toast(X.offerSaved);
    setOpen(null);
    bump((n) => n + 1);
  }

  function del(s: Sweet) {
    if (s.photo) void deleteMedia(s.photo.id);
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
