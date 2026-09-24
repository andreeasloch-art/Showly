/* „Passt dazu“ – Zusatzangebote wie bei großen Online-Shops.
 *
 * Wer einen Künstler bucht, bekommt passende Deko und eine Torte angeboten,
 * wer Ballons kauft, das Helium dazu. Die Auswahl hängt am Anlass: Eine
 * Märchenfee spielt meist auf Kindergeburtstagen, eine Band auf Hochzeiten.
 * Torten von Anbietern aus derselben Stadt kommen zuerst. */
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ARTISTS, SHOP_ADDONS, SHOP_ITEMS, type Artist, type ShopItem } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { Icon, bgOf, shopBg } from "@/showly/ui";
import { RequestModal, useSweetsCopy } from "@/components/showly/Sweets";
import { SWEETS, bakerOf, estimate, sweetBg, type Baker, type Sweet, type SweetCat } from "@/showly/sweets";

type Occ = "kids" | "birthday" | "wedding" | "company";

const ARTIST_OCC: Record<string, Occ> = {
  fairy: "kids",
  clown: "kids",
  superhero: "kids",
  magician: "kids",
  pantomime: "kids",
  acrobat: "birthday",
  santa: "birthday",
  street: "birthday",
  mentalist: "company",
  hypnotist: "company",
  host: "company",
  photographer: "wedding",
  comedy: "company",
  dj: "company",
  eventplanner: "company",
  walkingact: "company",
  musician: "wedding",
  band: "wedding",
  dancer: "wedding",
  weddingplanner: "wedding",
};
const OCC_SWEETS: Record<Occ, SweetCat[]> = {
  kids: ["motif", "cupcakes", "birthday"],
  birthday: ["birthday", "cupcakes", "candybar"],
  wedding: ["wedding", "patisserie", "candybar"],
  company: ["candybar", "patisserie", "motif"],
};
const OCC_DECO: Record<Occ, number[]> = {
  kids: [30, 18, 19, 24, 34],
  birthday: [17, 16, 22, 26, 32],
  wedding: [31, 27, 20, 23, 28],
  company: [21, 22, 29, 25, 35],
};
const SWEET_OCC: Record<SweetCat, Occ> = {
  wedding: "wedding",
  birthday: "birthday",
  motif: "kids",
  cupcakes: "kids",
  candybar: "company",
  cakes: "birthday",
  patisserie: "wedding",
};
const OCC_ARTISTS: Record<Occ, string[]> = {
  kids: ["fairy", "magician", "clown", "superhero"],
  birthday: ["magician", "acrobat", "dj", "fairy"],
  wedding: ["band", "musician", "weddingplanner", "dancer"],
  company: ["dj", "mentalist", "comedy", "walkingact"],
};

const byIds = (ids: number[]) =>
  ids.map((id) => SHOP_ITEMS.find((i) => i.id === id)).filter((i): i is ShopItem => !!i);

function pickSweets(cats: SweetCat[], city: string, n: number, skipBaker?: number) {
  const c = city.toLowerCase();
  const pool = SWEETS.filter((s) => cats.includes(s.cat) && s.bakerId !== skipBaker);
  const score = (s: Sweet) =>
    (bakerOf(s.bakerId)?.city.toLowerCase() === c ? 0 : 10) + cats.indexOf(s.cat);
  const sorted = [...pool].sort((a, b) => score(a) - score(b));
  /* Erst je Kategorie eins, dann auffüllen */
  const out: Sweet[] = [];
  for (const cat of cats) {
    const hit = sorted.find((s) => s.cat === cat);
    if (hit) out.push(hit);
  }
  for (const s of sorted) if (!out.includes(s)) out.push(s);
  return out.slice(0, n);
}

export function suggestForArtist(a: Artist, city: string) {
  const occ = ARTIST_OCC[a.cat] ?? "birthday";
  return { occ, deco: byIds(OCC_DECO[occ]), sweets: pickSweets(OCC_SWEETS[occ], city, 4) };
}

const cityOf = (a: Artist) => (typeof a.loc === "string" ? a.loc : a.loc.de);

export function suggestForBaker(b: Baker) {
  const occ = SWEET_OCC[b.specialties[0] ?? "birthday"];
  const artists = OCC_ARTISTS[occ]
    .map((c) => ARTISTS.find((a) => a.cat === c && cityOf(a) === b.city) ?? ARTISTS.find((a) => a.cat === c))
    .filter((a): a is Artist => !!a);
  return { occ, deco: byIds(OCC_DECO[occ]), artists };
}

/** Zubehör zu Artikeln, die schon im Warenkorb liegen */
export function addOnsForCart(ids: number[]) {
  const seen = new Set(ids);
  const out: ShopItem[] = [];
  for (const id of ids) {
    for (const x of SHOP_ADDONS[id] || []) {
      if (seen.has(x)) continue;
      seen.add(x);
      const it = SHOP_ITEMS.find((i) => i.id === x);
      if (it) out.push(it);
    }
  }
  return out;
}

const TEXT = {
  de: {
    bundleH: "Wird oft zusammen gebucht",
    bundleP: "Mach dein Event komplett: Deko und Torte gleich mit dazu.",
    thisArtist: "Dieser Act",
    perH: "/ Std.",
    estimate: "ca.",
    sum: "Gesamt für die Auswahl",
    take: (n: number) => (n === 1 ? "1 Extra übernehmen" : `${n} Extras übernehmen`),
    onlyArtist: "Nur den Act buchen",
    added: (n: number) => (n === 1 ? "1 Artikel liegt im Warenkorb." : `${n} Artikel liegen im Warenkorb.`),
    nowDate: "Jetzt noch Termin wählen.",
    shelfH: "Passt dazu",
    shelfP: "Deko und Süßes für genau diesen Anlass",
    deco: "Deko",
    cake: "Torte",
    act: "Künstler",
    add: "Dazu",
    inCart: "Im Warenkorb",
    ask: "Anfragen",
    view: "Ansehen",
    rent: "Miete",
    day: "/ Tag",
    cartH: "Passt dazu",
    cartCake: "Torte oder Candy Bar dazu?",
    cartCakeP: "Von Konditoreien und Privatbäckern",
    moreDeco: "Mehr Deko",
    moreSweets: "Alle Torten",
    bakerShelfH: "Dazu für dein Event",
    bakerShelfP: "Künstler und Deko, die zu dieser Feier passen",
  },
  en: {
    bundleH: "Frequently booked together",
    bundleP: "Complete your event: add decor and a cake right away.",
    thisArtist: "This act",
    perH: "/ hr",
    estimate: "approx.",
    sum: "Total for your selection",
    take: (n: number) => (n === 1 ? "Add 1 extra" : `Add ${n} extras`),
    onlyArtist: "Book the act only",
    added: (n: number) => (n === 1 ? "1 item is in your cart." : `${n} items are in your cart.`),
    nowDate: "Now pick a date.",
    shelfH: "Goes well with",
    shelfP: "Decor and sweets for exactly this occasion",
    deco: "Decor",
    cake: "Cake",
    act: "Artist",
    add: "Add",
    inCart: "In cart",
    ask: "Request",
    view: "View",
    rent: "Rent",
    day: "/ day",
    cartH: "Goes well with",
    cartCake: "Add a cake or candy bar?",
    cartCakeP: "From patisseries and home bakers",
    moreDeco: "More decor",
    moreSweets: "All cakes",
    bakerShelfH: "More for your event",
    bakerShelfP: "Artists and decor that suit this celebration",
  },
  es: {
    bundleH: "Se reservan juntos a menudo",
    bundleP: "Completa tu evento: añade decoración y tarta.",
    thisArtist: "Este artista",
    perH: "/ h",
    estimate: "aprox.",
    sum: "Total de tu selección",
    take: (n: number) => (n === 1 ? "Añadir 1 extra" : `Añadir ${n} extras`),
    onlyArtist: "Reservar solo el artista",
    added: (n: number) => (n === 1 ? "1 artículo en el carrito." : `${n} artículos en el carrito.`),
    nowDate: "Ahora elige la fecha.",
    shelfH: "Combina con",
    shelfP: "Decoración y dulces para esta ocasión",
    deco: "Decoración",
    cake: "Tarta",
    act: "Artista",
    add: "Añadir",
    inCart: "En el carrito",
    ask: "Solicitar",
    view: "Ver",
    rent: "Alquiler",
    day: "/ día",
    cartH: "Combina con",
    cartCake: "¿Añadir tarta o candy bar?",
    cartCakeP: "De pastelerías y particulares",
    moreDeco: "Más decoración",
    moreSweets: "Todas las tartas",
    bakerShelfH: "Más para tu evento",
    bakerShelfP: "Artistas y decoración para esta celebración",
  },
};
type T = (typeof TEXT)["de"];
function useT(): T {
  const { lang } = useShowly();
  return (TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de) as T;
}

/* ------------------------------------------------------------------ */
/* Bündel im Künstlerprofil                                            */
/* ------------------------------------------------------------------ */
export function EventBundle({
  a,
  artistTotal,
  hours,
  onBook,
}: {
  a: Artist;
  artistTotal: number;
  hours: number;
  onBook: () => void;
}) {
  const { L, fmt, toast, addToCart } = useShowly();
  const X = useT();
  const city = String(L(a.loc));
  const { deco, sweets } = suggestForArtist(a, city);
  const d1 = deco[0];
  const d2 = deco[1];
  const s1 = sweets[0];
  const [on, setOn] = useState<Record<string, boolean>>({ a: true, d1: true, d2: true, s1: true });
  const [asking, setAsking] = useState<Sweet | null>(null);

  const sweetEst = s1 ? estimate(s1, s1.unit === "set" ? 1 : s1.minQty) : 0;
  /* Große Stücke wie ein Blumenbogen werden meist gemietet */
  const modeOf = (d: ShopItem) => (d.rent > 0 ? "rent" : "buy") as "rent" | "buy";
  const decoRow = (key: string, d: ShopItem): Row => ({
    key,
    img: shopBg(d),
    name: String(L(d.name)),
    sub: [d.vendor, modeOf(d) === "rent" ? `${X.rent} ${X.day}` : ""].filter(Boolean).join(" · "),
    price: modeOf(d) === "rent" ? d.rent : d.buy,
    tag: X.deco,
  });
  type Row = { key: string; img: React.CSSProperties; name: string; sub: string; price: number; tag: string };
  const rows: Row[] = [
    { key: "a", img: bgOf(a), name: String(L(a.name)), sub: `${X.thisArtist} · ${hours} ${X.perH.replace("/ ", "")}`, price: artistTotal, tag: X.act },
    ...(d1 ? [decoRow("d1", d1)] : []),
    ...(d2 ? [decoRow("d2", d2)] : []),
    ...(s1
      ? [{ key: "s1", img: sweetBg(s1), name: String(L(s1.name)), sub: String(L(bakerOf(s1.bakerId)?.name ?? "")), price: sweetEst, tag: X.cake }]
      : []),
  ];
  const sum = rows.reduce((t, r) => t + (on[r.key] ? r.price : 0), 0);
  const extras = rows.filter((r) => r.key !== "a" && on[r.key]).length;

  function take() {
    let n = 0;
    if (on["d1"] && d1) {
      addToCart(d1.id, modeOf(d1), { quiet: true });
      n++;
    }
    if (on["d2"] && d2) {
      addToCart(d2.id, modeOf(d2), { quiet: true });
      n++;
    }
    const msg = n ? X.added(n) : "";
    if (on["s1"] && s1) {
      if (msg) toast(msg);
      setAsking(s1);
      return;
    }
    toast([msg, on["a"] ? X.nowDate : ""].filter(Boolean).join(" "));
    if (on["a"]) onBook();
  }

  if (rows.length < 2) return null;

  return (
    <section className="bundle" data-reveal>
      <div className="bundle-head">
        <h2>{X.bundleH}</h2>
        <p>{X.bundleP}</p>
      </div>
      <div className="bundle-body">
        <div className="bundle-pics" aria-hidden="true">
          {rows.map((r, i) => (
            <span className="bundle-pic-wrap" key={r.key}>
              {i > 0 && <span className="bundle-plus">+</span>}
              <span className={"bundle-pic" + (on[r.key] ? "" : " off")} style={r.img} />
            </span>
          ))}
        </div>
        <ul className="bundle-list">
          {rows.map((r) => (
            <li key={r.key}>
              <label className={on[r.key] ? "" : "off"}>
                <input
                  type="checkbox"
                  checked={!!on[r.key]}
                  onChange={(e) => setOn((o) => ({ ...o, [r.key]: e.target.checked }))}
                />
                <span className="bundle-tag">{r.tag}</span>
                <span className="bundle-name">
                  <b>{r.name}</b>
                  {r.sub && <small>{r.sub}</small>}
                </span>
                <span className="bundle-price">
                  {r.key === "s1" && <small>{X.estimate} </small>}
                  {fmt(r.price)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="bundle-foot">
          <div className="bundle-sum">
            <span>{X.sum}</span>
            <strong>{fmt(sum)}</strong>
          </div>
          <button className="home-btn primary" onClick={take} disabled={!extras && !on["a"]}>
            <Icon name="cart" />
            {extras ? X.take(extras) : X.onlyArtist}
          </button>
        </div>
      </div>
      {asking && (
        <RequestModal
          s={asking}
          onClose={() => {
            setAsking(null);
            if (on["a"]) {
              toast(X.nowDate);
              onBook();
            }
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Regal mit Vorschlägen                                              */
/* ------------------------------------------------------------------ */
export function AddOnShelf({
  deco = [],
  sweets = [],
  artists = [],
  title,
  sub,
  sweetsAsLink = false,
  onLeave,
}: {
  deco?: ShopItem[];
  sweets?: Sweet[];
  artists?: Artist[];
  title?: string;
  sub?: string;
  /** Torten nicht im Fenster anfragen, sondern zum Profil springen */
  sweetsAsLink?: boolean;
  onLeave?: () => void;
}) {
  const { L, fmt, addToCart, cart } = useShowly();
  const X = useT();
  const navigate = useNavigate();
  const [asking, setAsking] = useState<Sweet | null>(null);
  if (!deco.length && !sweets.length && !artists.length) return null;
  const inCart = (id: number) => cart.some((c) => c.shopId === id);

  return (
    <section className="shelf">
      <div className="shelf-head">
        <div>
          <h2>{title ?? X.shelfH}</h2>
          <p>{sub ?? X.shelfP}</p>
        </div>
      </div>
      <div className="shelf-row">
        {artists.map((a) => (
          <article className="shelf-card" key={"a" + a.id}>
            <span className="shelf-img" style={bgOf(a)}>
              <span className="shelf-tag">{X.act}</span>
            </span>
            <b className="shelf-name">{L(a.name)}</b>
            <span className="shelf-price">
              {fmt(Math.round(a.price * 1.2))} <small>{X.perH}</small>
            </span>
            <Link className="shelf-btn" to="/kuenstler/$id" params={{ id: String(a.id) }} onClick={onLeave}>
              {X.view}
            </Link>
          </article>
        ))}
        {deco.map((d) => {
          const has = inCart(d.id);
          return (
            <article className="shelf-card" key={"d" + d.id}>
              <span className="shelf-img" style={shopBg(d)}>
                <span className="shelf-tag">{X.deco}</span>
              </span>
              <b className="shelf-name">{L(d.name)}</b>
              <span className="shelf-price">
                {fmt(d.buy)}
                {d.rent > 0 && (
                  <small>
                    {" "}
                    · {X.rent} {fmt(d.rent)} {X.day}
                  </small>
                )}
              </span>
              <button
                className={"shelf-btn solid" + (has ? " done" : "")}
                onClick={() => addToCart(d.id, "buy", { quiet: true })}
              >
                <Icon name={has ? "check" : "plus"} />
                {has ? X.inCart : X.add}
              </button>
            </article>
          );
        })}
        {sweets.map((s) => {
          const b = bakerOf(s.bakerId);
          return (
            <article className="shelf-card" key={"s" + s.id}>
              <span className="shelf-img" style={sweetBg(s)}>
                <span className="shelf-tag cake">{X.cake}</span>
              </span>
              <b className="shelf-name">{L(s.name)}</b>
              <span className="shelf-price">
                <SweetPrice s={s} />
                {b && <small> · {b.city}</small>}
              </span>
              <button
                className="shelf-btn"
                onClick={() => {
                  if (sweetsAsLink) {
                    onLeave?.();
                    navigate({ to: "/torten/$id", params: { id: String(s.bakerId) } });
                  } else setAsking(s);
                }}
              >
                <Icon name="mail" />
                {X.ask}
              </button>
            </article>
          );
        })}
      </div>
      {asking && <RequestModal s={asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

function SweetPrice({ s }: { s: Sweet }) {
  const { fmt } = useShowly();
  const C = useSweetsCopy();
  return (
    <>
      {fmt(s.price)} {C.unit[s.unit] && <small>{C.unit[s.unit]}</small>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Im Warenkorb                                                        */
/* ------------------------------------------------------------------ */
export function CartAddOns({ onLeave }: { onLeave: () => void }) {
  const { L, fmt, cart, addToCart, cartBookings, cartRequests } = useShowly();
  const X = useT();
  const navigate = useNavigate();
  const ids = cart.map((c) => c.shopId);
  let list = addOnsForCart(ids);
  /* Nur ein Künstler im Warenkorb: passende Deko zu seinem Anlass */
  const firstAct = cartBookings[0] ? ARTISTS.find((a) => a.id === cartBookings[0]!.artistId) : undefined;
  if (firstAct) {
    const more = suggestForArtist(firstAct, "").deco.filter((d) => !ids.includes(d.id) && !list.includes(d));
    list = [...list, ...more];
  }
  list = list.slice(0, 3);
  const hasDeco = cart.some((c) => SHOP_ITEMS.find((i) => i.id === c.shopId)?.section === "deko");
  const showCake = (hasDeco || cartBookings.length > 0) && cartRequests.length === 0;
  if (!list.length && !showCake) return null;
  return (
    <div className="cart-addons">
      {list.length > 0 && (
        <>
          <div className="cart-addons-h">{X.cartH}</div>
          {list.map((d) => (
            <div className="cart-addon" key={d.id}>
              <span className="cart-addon-img" style={shopBg(d)} />
              <span className="cart-addon-text">
                <b>{L(d.name)}</b>
                <small>{fmt(d.buy)}</small>
              </span>
              <button className="cart-addon-add" onClick={() => addToCart(d.id, "buy", { quiet: true })} aria-label={X.add}>
                <Icon name="plus" />
              </button>
            </div>
          ))}
        </>
      )}
      {showCake && (
        <button
          className="cart-addon cake"
          onClick={() => {
            onLeave();
            navigate({ to: "/torten" });
          }}
        >
          <span className="cart-addon-img" style={{ backgroundImage: "url('/sweets/3.svg')" }} />
          <span className="cart-addon-text">
            <b>{X.cartCake}</b>
            <small>{X.cartCakeP}</small>
          </span>
          <span className="cart-addon-add ghost">
            <Icon name="arrow" />
          </span>
        </button>
      )}
    </div>
  );
}

