import { seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SHOP_ITEMS, SHOP_TABS, type ShopItem } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, Icon, shopBg } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { ShopSearch } from "@/components/showly/ShopSearch";
import { ImageWall } from "@/components/showly/ImageWall";
import { ImagePick } from "@/components/showly/ImagePick";
import { ShopAreas } from "@/components/showly/ShopAreas";
import { saveDecoItem } from "@/showly/sweets";
import type { MediaRef } from "@/showly/media";

type Area = "kostueme" | "deko";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { bereich?: Area } =>
    search["bereich"] === "deko" ? { bereich: "deko" } : {},
  head: () => seoHead("/shop", "/shop"),
  component: Shop,
});

/* Reiter im Deko-Bereich */
const DECO_TABS = [
  { id: "all", k: "shop.all" },
  { id: "balloons", k: "shop.balloons" },
  { id: "party", k: "shop.party" },
  { id: "light", k: "shop.light" },
  { id: "table", k: "shop.table" },
  { id: "wedding", k: "shop.wedding" },
];
const DECO_ICON: Record<string, string> = {
  all: "all",
  balloons: "party",
  party: "sparkle",
  light: "led",
  table: "gift",
  wedding: "heart",
};
const OCCASIONS = ["birthday", "company", "wedding", "kids"] as const;

/* Sinnbild je Reiter der Kategorieleiste */
const TAB_ICON: Record<string, string> = {
  all: "all",
  fairy: "fairy",
  season: "santa",
  show: "magician",
  hero: "superhero",
  music: "musician",
};

const COPY = {
  de: {
    fromRent: (p: string) => `Mieten ab ${p} am Tag`,
    buyToo: "Auch zum Kaufen",
    perk: "15 % Rabatt für Künstler",
    count: (n: number) => (n === 1 ? "1 Kostüm" : `${n} Kostüme`),
    perDay: "/ Tag",
    buy: "Kauf",
    added: "Im Warenkorb",
    reset: "Filter zurücksetzen",
    emptyH: "Kein Kostüm gefunden",
    emptyP: "Versuch einen anderen Begriff oder wähle eine andere Kategorie.",
    areaCostumes: "Kostüme",
    areaDeco: "Deko",
    decoEyebrow: "Deko für jeden Anlass",
    decoH1: "Deko, die die Party macht",
    decoSub: "Ballons, Girlanden, Lichterketten und Tischdeko von Anbietern aus deiner Nähe. Kaufen oder für den Tag mieten.",
    decoPh: "Deko suchen …",
    decoItems: "Deko",
    decoCount: (n: number) => (n === 1 ? "1 Artikel" : `${n} Artikel`),
    decoEmptyH: "Keine Deko gefunden",
    by: "von",
    decoTrust1: "Viele Artikel auch zum Mieten",
    decoTrust2: "Direkt vom Anbieter",
    decoTrust3: "Für Geburtstag, Firma und Hochzeit",
    occ: { all: "Alle Anlässe", birthday: "Geburtstag", company: "Firmenfeier", wedding: "Hochzeit", kids: "Kindergeburtstag" },
    offerEyebrow: "Für Deko-Anbieter",
    offerH2: "Du verleihst oder verkaufst Deko?",
    offerP: "Stell deine Ballons, Lichter und Tischdeko ein, ob als Laden, Verleih oder privat. Kunden finden dich direkt hier im Shop.",
    offerBtn: "Deko anbieten",
    sweetsBtn: "Torten & Süßes ansehen",
    newTag: "Neu",
    form: {
      h: "Deko anbieten",
      save: "Einstellen",
      vendor: "Dein Name oder Firmenname",
      name: "Was bietest du an?",
      namePh: "z. B. Ballonbogen Pastell, 4 Meter",
      cat: "Kategorie",
      occ: "Passt zu",
      desc: "Beschreibung",
      descPh: "Größe, Farben, was dabei ist, Abholung oder Lieferung …",
      buy: "Kaufpreis",
      rent: "Mietpreis pro Tag",
      rentHint: "Leer lassen, wenn du nur verkaufst.",
      photo: "Foto",
      need: "Bitte Name, Artikel und einen Preis angeben.",
      done: "Dein Artikel steht jetzt im Deko-Shop.",
      note: "Dein Artikel wird vorerst nur in diesem Browser gespeichert.",
    },
  },
  en: {
    fromRent: (p: string) => `Rent from ${p} a day`,
    buyToo: "Also for sale",
    perk: "15% off for artists",
    count: (n: number) => (n === 1 ? "1 costume" : `${n} costumes`),
    perDay: "/ day",
    buy: "Buy",
    added: "In your cart",
    reset: "Reset filters",
    emptyH: "No costume found",
    emptyP: "Try another term or pick a different category.",
    areaCostumes: "Costumes",
    areaDeco: "Decor",
    decoEyebrow: "Decor for every occasion",
    decoH1: "Decor that makes the party",
    decoSub: "Balloons, garlands, fairy lights and table decor from local providers. Buy or rent for the day.",
    decoPh: "Search decor …",
    decoItems: "Decor",
    decoCount: (n: number) => (n === 1 ? "1 item" : `${n} items`),
    decoEmptyH: "No decor found",
    by: "by",
    decoTrust1: "Many items also for rent",
    decoTrust2: "Straight from the provider",
    decoTrust3: "For birthdays, companies and weddings",
    occ: { all: "All occasions", birthday: "Birthday", company: "Company party", wedding: "Wedding", kids: "Kids' party" },
    offerEyebrow: "For decor providers",
    offerH2: "You rent or sell decor?",
    offerP: "List your balloons, lights and table decor, as a shop, rental or private person. Customers find you right here.",
    offerBtn: "Offer decor",
    sweetsBtn: "See cakes & sweets",
    newTag: "New",
    form: {
      h: "Offer decor",
      save: "Publish",
      vendor: "Your name or company",
      name: "What do you offer?",
      namePh: "e.g. pastel balloon arch, 4 metres",
      cat: "Category",
      occ: "Suits",
      desc: "Description",
      descPh: "Size, colours, what's included, pickup or delivery …",
      buy: "Sale price",
      rent: "Rental price per day",
      rentHint: "Leave empty if you only sell.",
      photo: "Photo",
      need: "Please add a name, the item and a price.",
      done: "Your item is now in the decor shop.",
      note: "For now your item is only saved in this browser.",
    },
  },
  es: {
    fromRent: (p: string) => `Alquiler desde ${p} al día`,
    buyToo: "También a la venta",
    perk: "15 % de descuento para artistas",
    count: (n: number) => (n === 1 ? "1 disfraz" : `${n} disfraces`),
    perDay: "/ día",
    buy: "Compra",
    added: "En el carrito",
    reset: "Quitar filtros",
    emptyH: "No hay disfraces",
    emptyP: "Prueba otro término o elige otra categoría.",
    areaCostumes: "Disfraces",
    areaDeco: "Decoración",
    decoEyebrow: "Decoración para cada ocasión",
    decoH1: "Decoración que hace la fiesta",
    decoSub: "Globos, guirnaldas, luces y decoración de mesa de proveedores cercanos. Compra o alquila por un día.",
    decoPh: "Buscar decoración …",
    decoItems: "Decoración",
    decoCount: (n: number) => (n === 1 ? "1 artículo" : `${n} artículos`),
    decoEmptyH: "No hay decoración",
    by: "de",
    decoTrust1: "Muchos artículos también en alquiler",
    decoTrust2: "Directo del proveedor",
    decoTrust3: "Para cumpleaños, empresas y bodas",
    occ: { all: "Todas las ocasiones", birthday: "Cumpleaños", company: "Fiesta de empresa", wedding: "Boda", kids: "Fiesta infantil" },
    offerEyebrow: "Para proveedores de decoración",
    offerH2: "¿Alquilas o vendes decoración?",
    offerP: "Publica tus globos, luces y decoración de mesa, como tienda, alquiler o particular. Los clientes te encuentran aquí.",
    offerBtn: "Ofrecer decoración",
    sweetsBtn: "Ver tartas y dulces",
    newTag: "Nuevo",
    form: {
      h: "Ofrecer decoración",
      save: "Publicar",
      vendor: "Tu nombre o empresa",
      name: "¿Qué ofreces?",
      namePh: "p. ej. arco de globos pastel, 4 metros",
      cat: "Categoría",
      occ: "Ideal para",
      desc: "Descripción",
      descPh: "Tamaño, colores, qué incluye, recogida o entrega …",
      buy: "Precio de venta",
      rent: "Alquiler por día",
      rentHint: "Déjalo vacío si solo vendes.",
      photo: "Foto",
      need: "Indica nombre, artículo y un precio.",
      done: "Tu artículo ya está en la tienda de decoración.",
      note: "Por ahora tu artículo solo se guarda en este navegador.",
    },
  },
} as const;
type Copy = (typeof COPY)[keyof typeof COPY];

function Shop() {
  const { t, L, fmt, lang } = useShowly();
  const C: Copy = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const { bereich } = Route.useSearch();
  const area: Area = bereich === "deko" ? "deko" : "kostueme";
  const deko = area === "deko";
  const [shopCat, setShopCat] = useState("all");
  const [occ, setOcc] = useState("all");
  const [query, setQuery] = useState("");
  const [offering, setOffering] = useState(false);

  /* Beim Wechsel des Bereichs die Filter lösen */
  useEffect(() => {
    setShopCat("all");
    setOcc("all");
    setQuery("");
  }, [area]);

  const pool = SHOP_ITEMS.filter((i) => (deko ? i.section === "deko" : i.section !== "deko"));
  const tabs = deko ? DECO_TABS : SHOP_TABS;

  /* Erst nach Kategorie und Anlass, dann nach dem Suchbegriff filtern. */
  const q = query.trim().toLowerCase();
  const items = pool.filter((i) => {
    if (shopCat !== "all" && i.cat !== shopCat) return false;
    if (deko && occ !== "all" && !(i.occ || []).includes(occ)) return false;
    if (!q) return true;
    return [L(i.name), L(i["desc"]), i.cat, i.vendor || ""].join(" ").toLowerCase().includes(q);
  });
  const filtered = shopCat !== "all" || occ !== "all" || !!q;
  let minRent = 0;
  for (const i of pool) if (i.rent > 0 && (!minRent || i.rent < minRent)) minRent = i.rent;

  function scrollToGrid() {
    document
      .querySelector(".shop26 .home-grid-head")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickCat(id: string) {
    setShopCat(id);
    setTimeout(scrollToGrid, 60);
  }

  function reset() {
    setShopCat("all");
    setOcc("all");
    setQuery("");
  }

  /* Klick auf ein Bild im Kopfbereich: zur Karte springen und sie kurz
     aufleuchten lassen. Vorher Filter lösen, sonst stünde sie nicht da. */
  function jumpTo(id: number) {
    reset();
    setTimeout(() => {
      const el = document.getElementById("costume-" + id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }, 60);
  }

  function go(a: Area) {
    navigate({ to: "/shop", search: a === "deko" ? { bereich: "deko" } : {}, resetScroll: false });
  }

  return (
    <div className={"page active ui26 shop26" + (deko ? " deko" : "")}>
      <section className="shop26-hero">
        <div className="shop26-hero-card">
          <div className="shop26-hero-inner">
            <div className="shop26-copy">
              <ShopAreas active={area} />
              <div className="home-pill on-color rise" style={{ ["--d" as string]: "40ms" }}>
                <Icon name={deko ? "party" : "bag"} /> {deko ? C.decoEyebrow : t("shop.eyebrow")}
              </div>
              <h1 className="rise" style={{ ["--d" as string]: "70ms" }}>
                {deko ? C.decoH1 : t("shop.h1")}
              </h1>
              <p className="rise" style={{ ["--d" as string]: "140ms" }}>
                {deko ? C.decoSub : t("shop.sub")}
              </p>
              <div className="shop26-search rise" style={{ ["--d" as string]: "210ms" }}>
                <ShopSearch
                  key={area}
                  value={query}
                  onChange={setQuery}
                  onPickCat={pickCat}
                  items={pool}
                  tabs={tabs}
                  placeholder={deko ? C.decoPh : undefined}
                  itemsLabel={deko ? C.decoItems : undefined}
                />
              </div>
              <ul className="shop26-trust rise" style={{ ["--d" as string]: "280ms" }}>
                {deko ? (
                  <>
                    <li>
                      <Icon name="calendar" /> {C.decoTrust1}
                    </li>
                    <li>
                      <Icon name="user" /> {C.decoTrust2}
                    </li>
                    <li>
                      <Icon name="gift" /> {C.decoTrust3}
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Icon name="calendar" /> {C.fromRent(fmt(minRent))}
                    </li>
                    <li>
                      <Icon name="bag" /> {C.buyToo}
                    </li>
                    <li>
                      <Icon name="gift" /> {C.perk}
                    </li>
                  </>
                )}
              </ul>
            </div>
            <ImageWall
              key={area}
              light
              tiles={pool.map((i) => ({
                key: String(i.id),
                style: shopBg(i),
                title: String(L(i.name)),
                sub: t("shop." + i.cat),
                onClick: () => jumpTo(i.id),
              }))}
            />
          </div>
        </div>
      </section>

      <div className="home-browse">
        <nav className="cat-bar" aria-label={deko ? C.decoH1 : t("shop.h1")}>
          <div className="cat-bar-inner">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                className={"cat-chip" + (tb.id === shopCat ? " on" : "")}
                aria-pressed={tb.id === shopCat}
                onClick={() => pickCat(tb.id)}
              >
                <Icon name={(deko ? DECO_ICON : TAB_ICON)[tb.id] ?? "mask"} />
                <span>{t(tb.k)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="home-grid-head" data-reveal>
          <div>
            <h2>
              {shopCat === "all" ? (deko ? C.areaDeco : t("shop.h1")) : t("shop." + shopCat)}
            </h2>
            <p>{deko ? C.decoCount(items.length) : C.count(items.length)}</p>
          </div>
          {filtered && (
            <button className="home-reset" onClick={reset}>
              <Icon name="close" />
              <span>{C.reset}</span>
            </button>
          )}
        </div>

        {deko && (
          <div className="occ-row" role="group" aria-label={C.form.occ}>
            {(["all", ...OCCASIONS] as const).map((o) => (
              <button
                key={o}
                className={"occ-chip" + (occ === o ? " on" : "")}
                aria-pressed={occ === o}
                onClick={() => setOcc(o)}
              >
                {C.occ[o]}
              </button>
            ))}
          </div>
        )}

        <div className="act-grid prod-grid reveal-stagger">
          {items.length ? (
            items.map((i) => (
              <ProductCard
                key={i.id}
                item={i}
                C={C}
                onArtists={
                  i.artistCat ? () => void navigate({ to: "/", hash: i.artistCat! }) : undefined
                }
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="ic">
                <Icon name="search" />
              </div>
              <h3>{deko ? C.decoEmptyH : C.emptyH}</h3>
              <p>{C.emptyP}</p>
            </div>
          )}
        </div>
      </div>

      <section className="home-join" data-reveal>
        <div className="home-join-card">
          {deko ? (
            <div className="home-join-text">
              <span className="home-eyebrow on-dark">{C.offerEyebrow}</span>
              <h2>{C.offerH2}</h2>
              <p>{C.offerP}</p>
              <div className="home-join-btns">
                <button className="home-btn light" onClick={() => setOffering(true)}>
                  {C.offerBtn}
                  <Icon name="arrow" />
                </button>
                <button className="home-btn ghost" onClick={() => navigate({ to: "/torten" })}>
                  {C.sweetsBtn}
                </button>
              </div>
            </div>
          ) : (
            <div className="home-join-text">
              <span className="home-eyebrow on-dark">{t("shop.discountEyebrow")}</span>
              <h2>{t("shop.discountH2")}</h2>
              <p>{t("shop.discountP")}</p>
              <div className="home-join-btns">
                <button className="home-btn light" onClick={() => navigate({ to: "/mitmachen" })}>
                  {t("shop.discountBtn")}
                  <Icon name="arrow" />
                </button>
                <button className="home-btn ghost" onClick={() => go("deko")}>
                  {C.areaDeco}
                </button>
              </div>
            </div>
          )}
          <div className="home-join-art" aria-hidden="true">
            {pool.slice(0, 6).map((i, k) => (
              <span className={"home-join-tile t" + k} key={i.id} style={shopBg(i)} />
            ))}
          </div>
        </div>
      </section>
      <Footer />
      {offering && (
        <DecoOffer
          C={C}
          onClose={() => setOffering(false)}
          onDone={(id) => {
            setOffering(false);
            setTimeout(() => jumpTo(id), 80);
          }}
        />
      )}
    </div>
  );
}

/* Formular für Deko-Anbieter */
function DecoOffer({
  C,
  onClose,
  onDone,
}: {
  C: Copy;
  onClose: () => void;
  onDone: (id: number) => void;
}) {
  const { t, toast } = useShowly();
  const F = C.form;
  const [vendor, setVendor] = useState("");
  const [name, setName] = useState("");
  const [cat, setCat] = useState("balloons");
  const [occ, setOcc] = useState<string[]>(["birthday"]);
  const [desc, setDesc] = useState("");
  const [buy, setBuy] = useState("");
  const [rent, setRent] = useState("");
  const [photo, setPhoto] = useState<MediaRef | undefined>();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const price = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 100000) : 0;
  };

  function publish() {
    const b = price(buy);
    const r = price(rent);
    if (!vendor.trim() || !name.trim() || (!b && !r)) return toast(F.need);
    const item = saveDecoItem({
      vendor: vendor.trim().slice(0, 80),
      name: name.trim().slice(0, 100),
      desc: desc.trim().slice(0, 600),
      cat,
      occ,
      buy: b || r * 5,
      rent: r,
      photo,
    });
    toast(F.done);
    onDone(item.id);
  }

  return (
    <div className="feed26-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="feed26-sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="deco-h">
        <header className="feed26-sheet-head">
          <button className="feed26-x" onClick={onClose} aria-label="✕">
            <Icon name="close" />
          </button>
          <h2 id="deco-h">{F.h}</h2>
          <button className="feed26-share-btn" onClick={publish}>
            {F.save}
          </button>
        </header>
        <div className="feed26-sheet-body">
          <div className="pe-field">
            <span className="pe-label">{F.photo}</span>
            <ImagePick value={photo} onChange={setPhoto} />
          </div>
          <label className="pe-field">
            <span className="pe-label">{F.vendor}</span>
            <input value={vendor} maxLength={80} onChange={(e) => setVendor(e.target.value)} />
          </label>
          <label className="pe-field">
            <span className="pe-label">{F.name}</span>
            <input value={name} maxLength={100} placeholder={F.namePh} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="pe-field">
            <span className="pe-label">{F.cat}</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {DECO_TABS.filter((d) => d.id !== "all").map((d) => (
                <option key={d.id} value={d.id}>
                  {t(d.k)}
                </option>
              ))}
            </select>
          </label>
          <div className="pe-field">
            <span className="pe-label">{F.occ}</span>
            <div className="occ-row in-form">
              {OCCASIONS.map((o) => {
                const on = occ.includes(o);
                return (
                  <button
                    type="button"
                    key={o}
                    className={"occ-chip" + (on ? " on" : "")}
                    aria-pressed={on}
                    onClick={() => setOcc((l) => (on ? l.filter((x) => x !== o) : [...l, o]))}
                  >
                    {C.occ[o]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pe-grid2">
            <label className="pe-field">
              <span className="pe-label">{F.buy}</span>
              <span className="pe-money">
                <input inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} />
                <span>€</span>
              </span>
            </label>
            <label className="pe-field">
              <span className="pe-label">{F.rent}</span>
              <span className="pe-money">
                <input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} />
                <span>€</span>
              </span>
              <span className="pe-hint">{F.rentHint}</span>
            </label>
          </div>
          <label className="pe-field">
            <span className="pe-label">{F.desc}</span>
            <textarea value={desc} maxLength={600} placeholder={F.descPh} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <p className="pe-note">
            <Icon name="lock" /> {F.note}
          </p>
        </div>
      </div>
    </div>
  );
}

/* Produktkarte, im selben Schnitt wie die Künstlerkarte der Startseite:
   Bild, Name mit Bewertung, eine Zeile Preis, zwei Knöpfe. Nach dem Klick
   auf Mieten oder Kaufen bestätigt der Knopf selbst kurz, dass das Kostüm
   im Warenkorb liegt, zusätzlich zur Meldung unten. So sieht man die
   Rückmeldung genau dort, wo man hingeschaut hat. */
function ProductCard({
  item: i,
  C,
  onArtists,
}: {
  item: ShopItem;
  C: Copy;
  onArtists?: (() => void) | undefined;
}) {
  const { t, L, fmt, num, addToCart, catLabel } = useShowly();
  const both = i.rent > 0;
  const [done, setDone] = useState<"" | "rent" | "buy">("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function add(mode: "rent" | "buy") {
    addToCart(i.id, mode);
    setDone(mode);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(""), 1600);
  }

  return (
    <article className="act-card prod-card" id={"costume-" + i.id}>
      <div className="act-card-media prod-media">
        <div className="act-card-img" style={shopBg(i)} />
        {i.own && <span className="prod-new">{C.newTag}</span>}
        <span className={"act-card-badge prod-badge" + (both ? " both" : "")}>
          {t(both ? "shop.rentBuy" : "shop.buyOnly")}
        </span>
      </div>

      <div className="act-card-body">
        <div className="act-card-row">
          <h3 className="act-card-name prod-name">{L(i.name)}</h3>
          {i.reviews > 0 && (
            <span className="act-card-rating">
              <span className="star" aria-hidden="true">
                ★
              </span>
              {num(i.rating, 1)}
              <span className="act-card-count">({i.reviews})</span>
            </span>
          )}
        </div>

        {onArtists && i.artistCat ? (
          <button className="prod-for" onClick={onArtists}>
            <CatIcon id={i.artistCat} />
            <span>{catLabel(i.artistCat)}</span>
            <Icon name="arrow" />
          </button>
        ) : i.vendor ? (
          <span className="prod-vendor">
            <Icon name="user" />
            <span>
              {C.by} {i.vendor}
            </span>
          </span>
        ) : null}

        <div className="prod-price">
          {both && (
            <span>
              <b>{fmt(i.rent)}</b> {C.perDay}
            </span>
          )}
          <span>
            {both ? C.buy + " " : ""}
            <b>{fmt(i.buy)}</b>
          </span>
        </div>

        <div className={"prod-btns" + (both ? "" : " one")}>
          {both && (
            <button
              className={"prod-btn ghost" + (done === "rent" ? " done" : "")}
              onClick={() => add("rent")}
            >
              {done === "rent" ? <Icon name="check" /> : null}
              {done === "rent" ? C.added : t("shop.addRent")}
            </button>
          )}
          <button
            className={"prod-btn solid" + (done === "buy" ? " done" : "")}
            onClick={() => add("buy")}
          >
            {done === "buy" ? <Icon name="check" /> : null}
            {done === "buy" ? C.added : t("shop.addBuy")}
          </button>
        </div>
      </div>
    </article>
  );
}
