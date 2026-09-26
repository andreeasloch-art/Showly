/* Globaler Zustand der Showly-App: Sprache, Favoriten, Warenkorb,
   Buchungen, Bestellungen, Session, Verfügbarkeiten und Toasts. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { I18N, ARTISTS, SHOP_ITEMS, type Artist, type Lang } from "./data";
import { ES } from "./i18n.es";
import { detectCountry, langForCountry } from "./country";
import { deleteLocalAccount, hydrateArtists, loadJSON, saveJSON } from "./persist";
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { deleteMyAccount } from "@/utils/account.functions";
import { addRequest, dropLocalRequests, hydrateSweets, setCloudRequests } from "./sweets";
import { bookingAction, loadMine, recordCart, registerArtist, type ArtistSignup } from "@/utils/cloud.functions";
import type { CloudAction } from "./cloudRules";
import {
  bookingFromRow,
  dbIdOf,
  isDbId,
  mergeById,
  orderFromRow,
  payoutFromRow,
  penaltyFromRow,
  sweetFromRow,
  voucherFromRow,
} from "./cloudMap";
import { hydrateDbArtists } from "./cloudArtists";
import { getStripeEnvironment } from "@/lib/stripe";
import { bookingPrice, minHoursOf, cartTotals, findArtist, shopUnit, findItem, type CartBookingLine, type CartRequestLine } from "./pricing";
import {
  HEARING_DAYS,
  PENALTY_RATE,
  RESERVE_DAYS,
  RESERVE_FIRST_BOOKINGS,
  RESERVE_RATE,
  VOUCHER_EUR,
  checkinCodeOf,
  isInstant,
  isLateCancel,
  newCheckinCode,
  payoutDate,
  requestExpired,
  standingOf,
  voucherCode,
  voucherValidUntil,
  type Standing,
} from "./booking";
import { mediaVersion, preloadMedia, subscribeMedia } from "./media";


const DICT: Record<string, Record<string, string>> = {
  de: I18N["de"]!,
  en: I18N["en"]!,
  es: { ...I18N["en"]!, ...ES },
};
const LOCALE: Record<string, string> = { de: "de-DE", en: "en-GB", es: "es-ES" };

/* Automatische Spracherkennung: Browser-Sprachen zuerst, danach Zeitzone/Standort */
const TZ_LANG: Record<string, Lang> = {
  "Europe/Berlin": "de",
  "Europe/Vienna": "de",
  "Europe/Zurich": "de",
  "Europe/Busingen": "de",
  "Europe/Madrid": "es",
  "Atlantic/Canary": "es",
  "Europe/Andorra": "es",
  "America/Mexico_City": "es",
  "America/Bogota": "es",
  "America/Lima": "es",
  "America/Santiago": "es",
  "America/Argentina/Buenos_Aires": "es",
  "America/Montevideo": "es",
  "America/Caracas": "es",
  "America/Guatemala": "es",
  "America/Havana": "es",
  "America/Santo_Domingo": "es",
  "America/Panama": "es",
  "America/Costa_Rica": "es",
  "America/La_Paz": "es",
  "America/Asuncion": "es",
  "America/Guayaquil": "es",
  "America/Managua": "es",
  "America/Tegucigalpa": "es",
  "America/El_Salvador": "es",
  "America/Puerto_Rico": "es",
};

/* ?lang=DE|EN|ES aus der URL lesen */
export function langFromUrl(search?: string): Lang | null {
  try {
    const q = new URLSearchParams(
      search ?? (typeof window !== "undefined" ? window.location.search : ""),
    )
      .get("lang");
    const c = String(q || "").toLowerCase();
    return c === "de" || c === "en" || c === "es" ? (c as Lang) : null;
  } catch {
    return null;
  }
}

function detectLang(): Lang {
  if (typeof window === "undefined") return "de";
  // Standort (Zeitzone/Land) hat Vorrang, danach die Browsersprache.
  const byCountry = langForCountry(detectCountry());
  if (byCountry) return byCountry;
  const langs: string[] = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language || "",
  ];
  for (const raw of langs) {
    const code = String(raw).toLowerCase().slice(0, 2);
    if (code === "de" || code === "es" || code === "en") return code;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_LANG[tz]) return TZ_LANG[tz]!;
    if (tz && tz.startsWith("America/")) return "en";
  } catch {
    /* Zeitzone nicht verfügbar */
  }
  return "de";
}


export type Mode = "rent" | "buy";
export interface CartSnapshot {
  shop: CartLine[];
  bookings: CartBookingLine[];
  requests: CartRequestLine[];
  contact: { name: string; email: string; phone?: string; address?: string };
}
export interface CartLine {
  shopId: number;
  mode: Mode;
  qty: number;
}
export interface Booking {
  id: number;
  artistId: number;
  dateISO: string;
  slot?: string;
  amount: number;
  /* requested: wartet auf Zusage des Künstlers · declined: abgelehnt oder
     verfallen, Termin wieder frei, Zahlung wird nicht abgebucht */
  status: "confirmed" | "pending" | "completed" | "requested" | "declined" | "cancelled" | "noshow";
  /** Wer abgesagt hat, für die Anzeige beim Kunden */
  cancelledBy?: "customer" | "artist";
  /** Code, den der Künstler vor Ort eingibt (Nachweis, dass er da war) */
  checkinCode?: string;
  checkedInAt?: string;
  checkedInBy?: "artist" | "customer";
  /** Zeitpunkt der Anfrage, für die Antwortfrist */
  requestedAt?: string;
  /** Zahlung bereits autorisiert (online), wird bei Zusage abgebucht */
  paid?: boolean;
  /** Name des Kunden, für die Anzeige beim Künstler */
  customer?: string;
  occasion?: string;
  guests?: string;
  figure?: string;
  pkg?: string;
  hours?: number;
  address?: string;
}
export interface Order {
  id: number;
  dateISO: string;
  items: { shopId: number; mode: Mode; qty: number; price: number }[];
  total: number;
  status: string;
}
export interface Payout {
  id: number;
  artistId: number;
  artistName: string;
  dateISO: string;
  gross: number;
  fee: number;
  net: number;
  status: "pending" | "paid";
  /** Sicherheitseinbehalt der ersten Buchungen, wird später ausgezahlt */
  reserve?: number;
  reserveUntil?: string;
  /** Auszahlung 5 Werktage nach dem Termin */
  payoutOn?: string;
}
/** Auszahlungskonto eines Anbieters. Im Echtbetrieb erfasst Stripe Connect
 *  diese Daten, Showly speichert dann keine IBAN selbst. */
export interface BankAccount {
  holder: string;
  iban: string;
  bic?: string;
  savedAt: string;
}
/** Vertragsstrafe eines Künstlers (AGB § 9): späte Absage oder nicht erschienen */
export interface Penalty {
  id: number;
  bookingId: number;
  artistId: number;
  /** Höhe: 50 % der Gage bei später Absage, 100 % bei Nichterscheinen */
  amount: number;
  reason: "late" | "noshow";
  /** hearing: Künstler kann sich 7 Tage äußern · due: wird in Rechnung
      gestellt · proof: Notfall-Nachweis wird geprüft · waived: keine Strafe */
  status: "hearing" | "due" | "proof" | "waived";
  dateISO: string;
  /** Ende der Anhörungsfrist */
  hearingUntil?: string;
  /** Zeitpunkt, ab dem die Strafe fällig ist (zählt fürs Stufenmodell) */
  dueAt?: string;
}
/** Gutschein für Kunden nach später Absage oder Nichterscheinen */
export interface Voucher {
  code: string;
  amount: number;
  bookingId: number;
  dateISO: string;
  validUntil: string;
}
export interface Session {
  name: string;
  email: string;
  role: "customer" | "artist" | "planner";
  providerId?: number;
  /** Angemeldet über die Datenbank (Supabase) statt nur im Browser */
  backend?: boolean;
}
export type DeleteOutcome = "ok" | "open" | "failed";
/* providerId -> { 'YYYY-MM-DD': slots } */
export type Avail = Record<number, Record<string, string[]>>;

interface Ctx {
  /** Zählt hoch, sobald hochgeladene Bilder geladen sind; erzwingt Neuzeichnen */
  mediaVersion: number;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  L: <T,>(v: T) => any;
  fmt: (n: number) => string;
  fmtDate: (iso?: string) => string;
  num: (n: number, digits?: number) => string;
  catLabel: (id: string) => string;

  favorites: number[];
  toggleFav: (id: number) => void;

  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (shopId: number, mode: Mode, opts?: { quiet?: boolean }) => void;
  changeQty: (idx: number, d: number) => void;
  removeFromCart: (idx: number) => void;
  cartPrice: (c: CartLine) => number;
  cartTotal: number;
  cartCount: number;
  checkout: () => void;
  /** Künstlerbuchungen, die noch im Warenkorb liegen */
  cartBookings: CartBookingLine[];
  addCartBooking: (b: Omit<CartBookingLine, "key">, opts?: { quiet?: boolean }) => void;
  updateCartBooking: (key: string, patch: Partial<Omit<CartBookingLine, "key">>) => void;
  removeCartBooking: (key: string) => void;
  /** Torten-Anfragen im Warenkorb, werden beim Abschluss verschickt */
  cartRequests: CartRequestLine[];
  addCartRequest: (r: Omit<CartRequestLine, "key">) => void;
  removeCartRequest: (key: string) => void;
  /** Warenkorb abschließen: Buchungen, Bestellung und Anfragen anlegen */
  completeCart: (snap: CartSnapshot, paid: boolean, sessionId?: string) => void;

  bookings: Booking[];
  addBooking: (b: Omit<Booking, "id">) => void;
  updateBooking: (id: number, patch: Partial<Omit<Booking, "id" | "artistId">>) => void;
  cancelBooking: (id: number) => void;
  /** Künstler nimmt eine Anfrage an (true) oder lehnt sie ab (false) */
  respondBooking: (id: number, accept: boolean) => void;
  /** Künstler sagt eine bestätigte Buchung ab: Termin frei, Kunde bekommt alles zurück */
  cancelByArtist: (id: number, emergency?: boolean) => "free" | "penalty" | "proof";
  /** Kunde meldet: Künstler ist nicht erschienen */
  reportNoShow: (id: number) => void;
  /** Künstler reicht einen Notfall-Nachweis zu einer Vertragsstrafe ein */
  claimEmergency: (penaltyId: number) => void;
  /** Künstler checkt mit dem Code des Kunden ein. false: Code falsch */
  checkIn: (bookingId: number, code: string) => Promise<boolean>;
  /** Kunde bestätigt: Der Künstler ist da */
  confirmPresence: (bookingId: number) => void;
  /** Stufenmodell: Einschränkungen eines Künstlers */
  standing: (artistId: number) => Standing;
  /** Darf dieser Künstler gerade sofort gebucht werden? */
  instantFor: (a: Artist | null | undefined) => boolean;
  penalties: Penalty[];
  vouchers: Voucher[];
  /** Kontodaten je Anbieter, Schlüssel "artist:3" oder "baker:5" */
  bankAccounts: Record<string, BankAccount>;
  saveBank: (key: string, acc: BankAccount | null) => void;
  /** Kunde storniert. true, wenn es weniger als 24 Stunden vor Beginn war */
  cancelByCustomer: (id: number) => boolean;
  orders: Order[];

  session: Session | null;
  setSession: (s: Session | null) => void;
  /** Abmelden, auch bei der Datenbank */
  signOut: () => Promise<void>;
  /** Eigenes Konto löschen. "open": es gibt noch offene Buchungen */
  deleteAccount: () => Promise<DeleteOutcome>;

  payouts: Payout[];
  addPayout: (p: Omit<Payout, "id" | "status">) => void;

  avail: Avail;
  bookedSlots: (providerId: number, iso: string) => string[];
  toggleBlock: (providerId: number, iso: string, slot: string) => void;

  toast: (msg: string) => void;
  toastMsg: string | null;
  /** Gespeicherter Zustand ist geladen (nur im Browser) */
  hydrated: boolean;
  /** Daten aus der Datenbank neu laden (bei Anmeldung über Supabase) */
  refreshCloud: () => Promise<void>;
  /** Künstler-Registrierung, die nach der Anmeldung an den Server geht */
  queueArtistSignup: (s: ArtistSignup) => void;
}

const ShowlyCtx = createContext<Ctx | null>(null);

function seedAvail(): Avail {
  const a: Avail = {};
  const d = new Date();
  ARTISTS.forEach((art) => {
    a[art.id] = {};
    for (let k = 2; k < 22; k += 5) {
      const x = new Date(d.getTime());
      x.setDate(x.getDate() + k + (art.id % 3));
      const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      a[art.id]![iso] = ["10:00", "12:00"];
    }
  });
  return a;
}

export function ShowlyProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  const [favorites, setFavorites] = useState<number[]>([1, 6]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartBookings, setCartBookings] = useState<CartBookingLine[]>([]);
  const [cartRequests, setCartRequests] = useState<CartRequestLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([
    { id: 101, artistId: 1, dateISO: "2026-03-22", amount: 180, status: "confirmed" },
    { id: 102, artistId: 3, dateISO: "2026-04-15", amount: 480, status: "pending" },
    { id: 103, artistId: 2, dateISO: "2026-02-12", amount: 360, status: "completed" },
    { id: 104, artistId: 4, dateISO: "2025-12-24", amount: 216, status: "completed" },
  ]);
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 9001,
      dateISO: "2026-02-02",
      items: [{ shopId: 3, mode: "rent", qty: 1, price: 45 }],
      total: 45,
      status: "completed",
    },
  ]);
  const [session, setSession] = useState<Session | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, BankAccount>>(
    {},
  );
  const [avail, setAvail] = useState<Avail>(() => seedAvail());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const counters = useRef({ booking: 105, order: 9002, payout: 5001 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Gespeicherten Zustand nach dem Mounten laden (SSR-sicher). */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hydrateArtists();
    hydrateSweets();
    /* Eigene Fotos und Figurenbilder der Künstler vorab laden, damit sie
       überall sofort als Hintergrund gesetzt werden können. */
    void preloadMedia(
      ARTISTS.flatMap((a) => [
        ...((a["photos"] as { id: string }[] | undefined) || []).map((m) => m.id),
        ...Object.values((a["figureImages"] as Record<string, { id: string }> | undefined) || {}).map(
          (m) => m.id,
        ),
      ]),
    );
    const saved = loadJSON<{
      bookings?: Booking[];
      orders?: Order[];
      payouts?: Payout[];
      cart?: CartLine[];
      cartBookings?: CartBookingLine[];
      cartRequests?: CartRequestLine[];
      favorites?: number[];
      session?: Session | null;
      avail?: Avail;
      penalties?: Penalty[];
      vouchers?: Voucher[];
      bankAccounts?: Record<string, BankAccount>;
      counters?: { booking: number; order: number; payout: number };
    } | null>("state", null);
    if (saved) {
      if (saved.bookings) setBookings(saved.bookings);
      if (saved.orders) setOrders(saved.orders);
      if (saved.payouts) setPayouts(saved.payouts);
      if (saved.cart) setCart(saved.cart);
      if (Array.isArray(saved.cartBookings)) setCartBookings(saved.cartBookings);
      if (Array.isArray(saved.cartRequests)) setCartRequests(saved.cartRequests);
      if (saved.favorites) setFavorites(saved.favorites);
      if (saved.session !== undefined) setSession(saved.session);
      if (saved.avail) setAvail(saved.avail);
      if (Array.isArray(saved.penalties)) setPenalties(saved.penalties);
      if (Array.isArray(saved.vouchers)) setVouchers(saved.vouchers);
      if (saved.bankAccounts) setBankAccounts(saved.bankAccounts);
      if (saved.counters) counters.current = saved.counters;
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON("state", {
      bookings,
      orders,
      payouts,
      cart,
      cartBookings,
      cartRequests,
      favorites,
      session,
      avail,
      penalties,
      vouchers,
      bankAccounts,
      counters: counters.current,
    });
  }, [
    hydrated,
    bookings,
    orders,
    payouts,
    cart,
    cartBookings,
    cartRequests,
    favorites,
    session,
    avail,
    penalties,
    vouchers,
    bankAccounts,
  ]);

  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => {
      let s = (DICT[lang] && DICT[lang]![k]) || DICT["de"]![k] || k;
      if (vars) for (const v in vars) s = s.replaceAll("{" + v + "}", String(vars[v]));
      return s;
    },
    [lang],
  );

  const L = useCallback(
    (v: any) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? (v[lang] !== undefined ? v[lang] : lang === "es" && v.en !== undefined ? v.en : v.de)
        : v,
    [lang],
  );

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(LOCALE[lang], {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n),
    [lang],
  );

  const num = useCallback(
    (n: number, digits = 2) => n.toFixed(digits).replace(".", lang === "en" ? "." : ","),
    [lang],
  );

  const fmtDate = useCallback(
    (iso?: string) => {
      if (!iso) return "–";
      return new Date(iso).toLocaleDateString(LOCALE[lang], {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
    [lang],
  );

  const catLabel = useCallback((id: string) => t("cat." + id), [t]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const setLang = useCallback(
    (l: Lang) => {
      const apply = () => {
        setLangState(l);
        const s = DICT[l];
        const key = l === "de" ? "toast.langDE" : l === "en" ? "toast.langEN" : "toast.langES";
        toast(s ? s[key] || "" : "");
        if (typeof document !== "undefined") {
          document.documentElement.lang = l;
          try {
            window.localStorage.setItem("showly.lang", l);
          } catch {
            /* Speicher nicht verfügbar */
          }
        }
      };

      if (typeof document === "undefined") {
        apply();
        return;
      }
      const root = document.documentElement;
      if (root.lang === l) return;
      /* kurz ausblenden, Texte tauschen, wieder einblenden */
      root.setAttribute("data-lang-switching", "1");
      window.setTimeout(() => {
        apply();
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => root.removeAttribute("data-lang-switching")),
        );
      }, 170);
    },
    [toast],
  );

  /* Sprach-Priorität:
     1. ?lang=de|en|es in der URL (gilt für alle Routen und Deep-Links)
     2. manuell gewählte, gespeicherte Sprache (localStorage)
     3. automatische Erkennung (Browser-Sprachen, danach Zeitzone/Standort)
     Ungültige ?lang-Werte werden ignoriert und fallen auf 2. bzw. 3. zurück. */
  const searchStr = useRouterState({ select: (st) => st.location.searchStr });

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("showly.lang");
    } catch {
      /* Speicher nicht verfügbar */
    }
    const fromUrl = langFromUrl();
    const next =
      fromUrl ??
      (saved === "de" || saved === "en" || saved === "es" ? (saved as Lang) : detectLang());
    setLangState(next);
    document.documentElement.lang = next;
    if (fromUrl) {
      try {
        window.localStorage.setItem("showly.lang", fromUrl);
      } catch {
        /* Speicher nicht verfügbar */
      }
    }
    /* Boot-Blende erst entfernen, wenn die erkannte Sprache gerendert ist */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.removeAttribute("data-lang-boot")),
    );
  }, []);

  /* ?lang bei interner Navigation / Deep-Links dauerhaft übernehmen */
  useEffect(() => {
    const fromUrl = langFromUrl(searchStr);
    if (!fromUrl) return; /* ungültig oder nicht gesetzt -> bestehende Sprache behalten */
    setLangState((cur) => {
      if (cur !== fromUrl) {
        document.documentElement.lang = fromUrl;
        try {
          window.localStorage.setItem("showly.lang", fromUrl);
        } catch {
          /* Speicher nicht verfügbar */
        }
      }
      return fromUrl;
    });
  }, [searchStr]);

  const toggleFav = useCallback(
    (id: number) => {
      setFavorites((f) => {
        const has = f.includes(id);
        toast(t(has ? "toast.favRemove" : "toast.favAdd"));
        return has ? f.filter((x) => x !== id) : [...f, id];
      });
    },
    [t, toast],
  );

  const cartPrice = useCallback((c: CartLine) => {
    const i = SHOP_ITEMS.find((s) => s.id === c.shopId);
    if (!i) return 0;
    return shopUnit(i, c.mode) * c.qty;
  }, []);

  const addToCart = useCallback(
    (shopId: number, mode: Mode, opts?: { quiet?: boolean }) => {
      setCart((c) => {
        const idx = c.findIndex((x) => x.shopId === shopId && x.mode === mode);
        if (idx >= 0)
          return c.map((x, k) => (k === idx ? { ...x, qty: x.qty + 1 } : x));
        return [...c, { shopId, mode, qty: 1 }];
      });
      if (opts?.quiet) return;
      const item = SHOP_ITEMS.find((s) => s.id === shopId);
      toast(t("toast.cartAdd", { name: item ? L(item.name) : "" }));
      setCartOpen(true);
    },
    [L, t, toast],
  );

  const changeQty = useCallback((idx: number, d: number) => {
    setCart((c) =>
      c
        .map((x, k) => (k === idx ? { ...x, qty: Math.max(0, x.qty + d) } : x))
        .filter((x) => x.qty > 0),
    );
  }, []);

  const removeFromCart = useCallback(
    (idx: number) => {
      setCart((c) => c.filter((_, k) => k !== idx));
      toast(t("toast.cartRemove"));
    },
    [t, toast],
  );

  const cartTotal = useMemo(() => cartTotals(cart, cartBookings).total, [cart, cartBookings]);
  const cartCount = useMemo(
    () => cart.reduce((s, c) => s + c.qty, 0) + cartBookings.length + cartRequests.length,
    [cart, cartBookings, cartRequests],
  );

  const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const addCartBooking = useCallback(
    (b: Omit<CartBookingLine, "key">, opts?: { quiet?: boolean }) => {
      setCartBookings((list) => [
        /* Derselbe Act zur selben Zeit ersetzt den alten Eintrag */
        ...list.filter((x) => !(x.artistId === b.artistId && x.dateISO === b.dateISO && x.slot === b.slot)),
        { ...b, key: newKey() },
      ]);
      if (opts?.quiet) return;
      const a = findArtist(b.artistId);
      toast(t("toast.cartAdd", { name: a ? String(L(a.name)) : "" }));
      setCartOpen(true);
    },
    [L, t, toast],
  );
  const updateCartBooking = useCallback((key: string, patch: Partial<Omit<CartBookingLine, "key">>) => {
    setCartBookings((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);
  const removeCartBooking = useCallback(
    (key: string) => {
      setCartBookings((list) => list.filter((x) => x.key !== key));
      toast(t("toast.cartRemove"));
    },
    [t, toast],
  );
  const addCartRequest = useCallback(
    (r: Omit<CartRequestLine, "key">) => {
      setCartRequests((list) => [...list, { ...r, key: newKey() }]);
    },
    [],
  );
  const removeCartRequest = useCallback(
    (key: string) => {
      setCartRequests((list) => list.filter((x) => x.key !== key));
      toast(t("toast.cartRemove"));
    },
    [t, toast],
  );

  const checkout = useCallback(() => {
    if (!cart.length) return;
    const id = counters.current.order++;
    setOrders((o) => [
      {
        id,
        dateISO: new Date().toISOString().slice(0, 10),
        items: cart.map((c) => ({ ...c, price: cartPrice(c) })),
        total: cart.reduce((s, c) => s + cartPrice(c), 0),
        status: "confirmed",
      },
      ...o,
    ]);
    setCart([]);
    setCartOpen(false);
    toast(t("toast.ordered"));
  }, [cart, cartPrice, t, toast]);

  /* ------------------------------------------------------------------
   * Datenbank (bei Anmeldung über Supabase)
   *
   * Die App zeigt jede Aktion sofort an. Danach geht sie an den Server, der
   * nach den AGB-Regeln entscheidet und in die Datenbank schreibt; beim
   * nächsten Laden gilt dessen Stand. Ohne Anmeldung über die Datenbank
   * bleibt alles wie bisher im Browser.
   * ------------------------------------------------------------------ */
  const cloudOn = !!session?.backend && isBackendConfigured();
  const refreshing = useRef(false);

  const refreshCloud = useCallback(async () => {
    if (!isBackendConfigured() || refreshing.current) return;
    refreshing.current = true;
    try {
      const r = await loadMine();
      if (r.skipped) return;
      await hydrateDbArtists(r.uid).catch(() => 0);
      const codes = new Map(r.codes.map((c) => [c.booking_id, c.code]));
      const artistOf = new Map(r.bookings.map((b) => [b.id, b.artist_id ?? b.catalog_artist ?? 0]));
      const dayOf = new Map(r.bookings.map((b) => [b.id, b.day]));
      const nameOf = new Map(r.artists.map((a) => [a.id, String((a.name as { de?: string })?.de ?? "")]));
      setBookings((l) => mergeById(l, r.bookings.map((b) => bookingFromRow(b, codes.get(b.id)))));
      setPenalties((l) => mergeById(l, r.penalties.map((p) => penaltyFromRow(p, (id) => artistOf.get(id) ?? 0))));
      setVouchers((l) => [
        ...r.vouchers.map(voucherFromRow),
        ...l.filter((v) => !isDbId(v.bookingId) && !r.vouchers.some((x) => x.code === v.code)),
      ]);
      setPayouts((l) =>
        mergeById(
          l,
          r.payouts.map((p) =>
            payoutFromRow(p, (id) => dayOf.get(id) ?? "", nameOf.get(p.artist_id ?? 0) ?? ""),
          ),
        ),
      );
      setOrders((l) => mergeById(l, r.orders.map(orderFromRow)));
      setCloudRequests(r.sweets.map((x) => sweetFromRow(x)));
    } catch {
      /* Server nicht erreichbar: lokaler Stand bleibt stehen */
    } finally {
      refreshing.current = false;
    }
  }, []);

  /** Aktion an einer Buchung aus der Datenbank an den Server schicken */
  const cloudAct = useCallback(
    async (localId: number, action: CloudAction): Promise<{ ok: boolean; result?: string }> => {
      const dbId = dbIdOf(localId);
      if (!cloudOn || dbId === null) return { ok: true };
      try {
        const r = await bookingAction({ data: { bookingId: dbId, action } });
        if ("error" in r) {
          toast(r.error);
          return { ok: false };
        }
        return { ok: true, ...("result" in r ? { result: r.result } : {}) };
      } catch {
        return { ok: false };
      } finally {
        void refreshCloud();
      }
    },
    [cloudOn, refreshCloud, toast],
  );

  const addBooking = useCallback(
    (b: Omit<Booking, "id">) => {
      const id = counters.current.booking++;
      setBookings((x) => [{ ...b, id }, ...x]);
      if (b.slot) {
        setAvail((a) => {
          const forArtist = { ...(a[b.artistId] || {}) };
          forArtist[b.dateISO] = [...(forArtist[b.dateISO] || []), b.slot!];
          return { ...a, [b.artistId]: forArtist };
        });
      }
      toast(t("toast.booked"));
    },
    [t, toast],
  );

  const addPayout = useCallback((p: Omit<Payout, "id" | "status">) => {
    setPayouts((x) => [{ ...p, id: counters.current.payout++, status: "pending" }, ...x]);
  }, []);

  const completeCart = useCallback(
    (snap: CartSnapshot, paid: boolean, sessionId?: string) => {
      /* Was hier im Browser angelegt wird, ersetzt nach dem Speichern der
         Stand aus der Datenbank */
      const madeBookings = new Set<number>();
      const madeOrders = new Set<number>();
      const madeRequests: string[] = [];
      for (const b of snap.bookings) {
        const a = findArtist(b.artistId);
        if (!a) continue;
        const p = bookingPrice(a, b.hours, b.pkg);
        const id = counters.current.booking++;
        madeBookings.add(id);
        /* Künstler mit Anfrage-Modus (oder nach einem Verstoß eingeschränkt):
           erst nach Zusage verbindlich */
        const instant = isInstant(a) && standingOf(a.id, penalties).instantAllowed;
        setBookings((x) => [
          {
            id,
            artistId: b.artistId,
            dateISO: b.dateISO,
            slot: b.slot,
            amount: p.total,
            status: !instant ? "requested" : paid ? "confirmed" : "pending",
            checkinCode: newCheckinCode(),
            ...(!instant ? { requestedAt: new Date().toISOString(), paid } : {}),
            ...(snap.contact.name ? { customer: snap.contact.name } : {}),
            ...(b.occasion ? { occasion: b.occasion } : {}),
            ...(b.guests ? { guests: b.guests } : {}),
            hours: p.hours,
            ...(b.figure ? { figure: b.figure } : {}),
            ...(b.pkg ? { pkg: b.pkg } : {}),
            ...(b.address ? { address: b.address } : {}),
          },
          ...x,
        ]);
        setAvail((av) => {
          const forArtist = { ...(av[b.artistId] || {}) };
          forArtist[b.dateISO] = [...(forArtist[b.dateISO] || []), b.slot];
          return { ...av, [b.artistId]: forArtist };
        });
        /* Mit Datenbank plant der Server die Auszahlung */
        if (paid && instant && !cloudOn) {
          setPayouts((x) => [makePayout(x, a, b.dateISO, p.total, p.payout), ...x]);
        }
      }
      if (snap.shop.length) {
        const items = snap.shop.map((c) => {
          const i = findItem(c.shopId);
          return { ...c, price: i ? shopUnit(i, c.mode) * c.qty : 0 };
        });
        const orderId = counters.current.order++;
        madeOrders.add(orderId);
        setOrders((o) => [
          {
            id: orderId,
            dateISO: new Date().toISOString().slice(0, 10),
            items,
            total: items.reduce((s, x) => s + x.price, 0),
            status: paid ? "confirmed" : "pending",
          },
          ...o,
        ]);
      }
      for (const r of snap.requests) {
        const made = addRequest({
          sweetId: r.sweetId,
          bakerId: r.bakerId,
          dateISO: r.dateISO,
          qty: r.qty,
          city: r.city,
          wishes: r.wishes,
          name: snap.contact.name,
          email: snap.contact.email,
          estimate: r.estimate,
          ...(r.direct ? { direct: true } : {}),
        });
        madeRequests.push(made.id);
      }
      const bk = new Set(snap.bookings.map((b) => b.key));
      const rk = new Set(snap.requests.map((r) => r.key));
      const sk = new Set(snap.shop.map((c) => c.shopId + ":" + c.mode));
      setCartBookings((l) => l.filter((x) => !bk.has(x.key)));
      setCartRequests((l) => l.filter((x) => !rk.has(x.key)));
      setCart((l) => l.filter((x) => !sk.has(x.shopId + ":" + x.mode)));
      setCartOpen(false);

      /* Angemeldet über die Datenbank: dort speichern. Der Server rechnet
         Preise und Status selbst und prüft die Zahlung bei Stripe. */
      if (cloudOn) {
        void recordCart({
          data: {
            snapshot: {
              bookings: snap.bookings,
              requests: snap.requests,
              shop: snap.shop,
              contact: { name: snap.contact.name, address: snap.contact.address },
            },
            ...(sessionId ? { sessionId, environment: getStripeEnvironment() } : {}),
          },
        })
          .then((r) => {
            if ("error" in r) return toast(r.error);
            if ("skipped" in r) return;
            setBookings((l) => l.filter((x) => !madeBookings.has(x.id)));
            setOrders((l) => l.filter((x) => !madeOrders.has(x.id)));
            dropLocalRequests(madeRequests);
            return refreshCloud();
          })
          .catch(() => undefined);
      }
    },
    // makePayout steht weiter unten und hängt selbst nur von L ab
    [L, penalties, cloudOn, refreshCloud, toast],
  );

  /* Slot bei einer Buchung freigeben bzw. belegen */
  const shiftSlot = useCallback(
    (artistId: number, iso: string, slot: string | undefined, add: boolean) => {
      if (!slot) return;
      setAvail((a) => {
        const forArtist = { ...(a[artistId] || {}) };
        const cur = forArtist[iso] || [];
        forArtist[iso] = add
          ? cur.includes(slot)
            ? cur
            : [...cur, slot]
          : cur.filter((s) => s !== slot);
        return { ...a, [artistId]: forArtist };
      });
    },
    [],
  );

  const updateBooking = useCallback(
    (id: number, patch: Partial<Omit<Booking, "id" | "artistId">>) => {
      setBookings((list) =>
        list.map((b) => {
          if (b.id !== id) return b;
          const next = { ...b, ...patch };
          if (next.dateISO !== b.dateISO || next.slot !== b.slot) {
            shiftSlot(b.artistId, b.dateISO, b.slot, false);
            shiftSlot(b.artistId, next.dateISO, next.slot, true);
          }
          return next;
        }),
      );
    },
    [shiftSlot],
  );

  const cancelBooking = useCallback(
    (id: number) => {
      setBookings((list) => {
        const b = list.find((x) => x.id === id);
        if (b) shiftSlot(b.artistId, b.dateISO, b.slot, false);
        return list.filter((x) => x.id !== id);
      });
    },
    [shiftSlot],
  );

  /* Anfrage beantworten. Bei Zusage wird die reservierte Zahlung abgebucht
     und die Gage zur Auszahlung vorgemerkt; bei Absage wird der Termin
     wieder frei und nichts abgebucht. */
  const respondBooking = useCallback(
    (id: number, accept: boolean) => {
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status !== "requested") return;
      if (accept) {
        setBookings((list) =>
          list.map((x) => (x.id === id ? { ...x, status: b.paid ? "confirmed" : "pending" } : x)),
        );
        const a = findArtist(b.artistId);
        /* Bei Buchungen aus der Datenbank plant der Server die Auszahlung */
        if (b.paid && a && !(cloudOn && isDbId(id))) {
          const p = bookingPrice(a, b.hours || minHoursOf(a), b.pkg);
          setPayouts((x) => [makePayout(x, a, b.dateISO, b.amount, p.payout), ...x]);
        }
      } else {
        setBookings((list) => list.map((x) => (x.id === id ? { ...x, status: "declined" } : x)));
        shiftSlot(b.artistId, b.dateISO, b.slot, false);
      }
      void cloudAct(id, { kind: "respond", accept });
    },
    [bookings, shiftSlot, L, cloudOn, cloudAct],
  );

  /* Auszahlung vormerken; bei den ersten Buchungen eines Künstlers mit
     Sicherheitseinbehalt (AGB § 21 Abs. 4) */
  const makePayout = useCallback(
    (list: Payout[], a: Artist, dateISO: string, gross: number, net: number): Payout => {
      const earlier = list.filter((p) => p.artistId === a.id).length;
      const reserve = earlier < RESERVE_FIRST_BOOKINGS ? Math.round(net * RESERVE_RATE) : 0;
      const until = new Date(new Date(dateISO + "T12:00:00").getTime() + RESERVE_DAYS * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        id: counters.current.payout++,
        artistId: a.id,
        artistName: String(L(a.name)),
        dateISO,
        gross,
        fee: gross - net,
        net,
        status: "pending",
        payoutOn: payoutDate(dateISO),
        ...(reserve ? { reserve, reserveUntil: until } : {}),
      };
    },
    [L],
  );

  const issueVoucher = useCallback((bookingId: number) => {
    /* Gutscheine zu Buchungen aus der Datenbank stellt der Server aus */
    if (cloudOn && isDbId(bookingId)) return;
    setVouchers((x) =>
      x.some((v) => v.bookingId === bookingId)
        ? x
        : [
            {
              code: voucherCode(),
              amount: VOUCHER_EUR,
              bookingId,
              dateISO: new Date().toISOString(),
              validUntil: voucherValidUntil(),
            },
            ...x,
          ],
    );
  }, [cloudOn]);

  /* Vertragsstrafe anlegen. Gutschein für den Kunden, sobald sie fällig ist */
  const penalize = useCallback((b: Booking, reason: Penalty["reason"], status: Penalty["status"]) => {
    /* Strafen zu Buchungen aus der Datenbank legt der Server an */
    if (cloudOn && isDbId(b.id)) return;
    const a = findArtist(b.artistId);
    const net = a ? bookingPrice(a, b.hours || minHoursOf(a), b.pkg).payout : Math.round(b.amount / 1.2);
    const amount = Math.round(net * PENALTY_RATE[reason]);
    setPenalties((x) => [
      {
        id: Date.now(),
        bookingId: b.id,
        artistId: b.artistId,
        amount,
        reason,
        status,
        dateISO: new Date().toISOString(),
        ...(status === "due" ? { dueAt: new Date().toISOString() } : {}),
        ...(status === "hearing"
          ? { hearingUntil: new Date(Date.now() + HEARING_DAYS * 86400000).toISOString() }
          : {}),
      },
      ...x,
    ]);
    if (status === "due") issueVoucher(b.id);
  }, [issueVoucher, cloudOn]);

  /* Künstler sagt ab (AGB § 9). Bis 24 Stunden vorher ohne Grund und ohne
     Folgen. Danach Vertragsstrafe, außer bei einem belegten Notfall; dann
     wird der Nachweis geprüft. Der Kunde bekommt in jedem Fall alles zurück. */
  const cancelByArtist = useCallback(
    (id: number, emergency = false): "free" | "penalty" | "proof" => {
      const b = bookings.find((x) => x.id === id);
      if (!b) return "free";
      const late = (b.status === "confirmed" || b.status === "pending") && isLateCancel(b);
      setBookings((list) =>
        list.map((x) => (x.id === id ? { ...x, status: "declined", cancelledBy: "artist" } : x)),
      );
      shiftSlot(b.artistId, b.dateISO, b.slot, false);
      setPayouts((x) =>
        x.filter((p) => !(p.artistId === b.artistId && p.dateISO === b.dateISO && p.status === "pending")),
      );
      void cloudAct(id, { kind: "cancelArtist", emergency });
      if (!late) return "free";
      penalize(b, "late", emergency ? "proof" : "due");
      return emergency ? "proof" : "penalty";
    },
    [bookings, shiftSlot, penalize, cloudAct],
  );

  const reportNoShow = useCallback(
    (id: number) => {
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status === "noshow") return;
      setBookings((list) => list.map((x) => (x.id === id ? { ...x, status: "noshow" } : x)));
      setPayouts((x) =>
        x.filter((p) => !(p.artistId === b.artistId && p.dateISO === b.dateISO && p.status === "pending")),
      );
      /* Erst anhören: 7 Tage für Stellungnahme oder Notfall-Nachweis */
      penalize(b, "noshow", "hearing");
      void cloudAct(id, { kind: "reportNoShow" });
    },
    [bookings, penalize, cloudAct],
  );

  const claimEmergency = useCallback(
    (penaltyId: number) => {
      setPenalties((x) =>
        x.map((p) => (p.id === penaltyId && (p.status === "due" || p.status === "hearing") ? { ...p, status: "proof" } : p)),
      );
      const pen = penalties.find((p) => p.id === penaltyId);
      if (pen) void cloudAct(pen.bookingId, { kind: "claim" });
    },
    [penalties, cloudAct],
  );

  /* Anhörungsfrist abgelaufen ohne Nachweis: Strafe fällig, Gutschein raus */
  useEffect(() => {
    if (!hydrated) return;
    const now = Date.now();
    const over = penalties.filter((p) => p.status === "hearing" && p.hearingUntil && new Date(p.hearingUntil).getTime() < now);
    if (!over.length) return;
    const ids = new Set(over.map((p) => p.id));
    setPenalties((x) => x.map((p) => (ids.has(p.id) ? { ...p, status: "due", dueAt: new Date().toISOString() } : p)));
    for (const p of over) issueVoucher(p.bookingId);
  }, [hydrated, penalties, issueVoucher]);

  const checkIn = useCallback(
    async (bookingId: number, code: string) => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return false;
      /* Buchung aus der Datenbank: Den Code kennt nur der Server */
      if (cloudOn && isDbId(bookingId)) {
        const r = await cloudAct(bookingId, { kind: "checkin", code: code.replace(/\D/g, "") });
        return r.ok;
      }
      if (code.replace(/\D/g, "") !== checkinCodeOf(b)) return false;
      setBookings((list) =>
        list.map((x) =>
          x.id === bookingId ? { ...x, checkedInAt: new Date().toISOString(), checkedInBy: "artist" } : x,
        ),
      );
      return true;
    },
    [bookings, cloudOn, cloudAct],
  );

  const confirmPresence = useCallback(
    (bookingId: number) => {
      setBookings((list) =>
        list.map((x) =>
          x.id === bookingId && !x.checkedInAt
            ? { ...x, checkedInAt: new Date().toISOString(), checkedInBy: "customer" }
            : x,
        ),
      );
      void cloudAct(bookingId, { kind: "confirmPresence" });
    },
    [cloudAct],
  );

  const saveBank = useCallback((key: string, acc: BankAccount | null) => {
    setBankAccounts((x) => {
      const next = { ...x };
      if (acc) next[key] = acc;
      else delete next[key];
      return next;
    });
  }, []);

  const standing = useCallback(
    (artistId: number) => standingOf(artistId, penalties),
    [penalties],
  );
  const instantFor = useCallback(
    (a: Artist | null | undefined) => isInstant(a) && (!a || standingOf(a.id, penalties).instantAllowed),
    [penalties],
  );

  /* Stornierung durch den Kunden (AGB § 8): bis 24 Stunden vor Beginn
     kostenlos, danach bleibt die Gage für den Künstler vorgemerkt. Eine
     unbeantwortete Anfrage lässt sich immer kostenlos zurückziehen. */
  const cancelByCustomer = useCallback(
    (id: number) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) return false;
      const late = b.status !== "requested" && isLateCancel(b);
      setBookings((list) => list.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
      shiftSlot(b.artistId, b.dateISO, b.slot, false);
      if (!late)
        setPayouts((x) =>
          x.filter((p) => !(p.artistId === b.artistId && p.dateISO === b.dateISO && p.status === "pending")),
        );
      void cloudAct(id, { kind: "cancelCustomer" });
      return late;
    },
    [bookings, shiftSlot, cloudAct],
  );

  /* Unbeantwortete Anfragen verfallen nach der Frist */
  useEffect(() => {
    if (!hydrated) return;
    const stale = bookings.filter((b) => requestExpired(b));
    if (!stale.length) return;
    const ids = new Set(stale.map((b) => b.id));
    setBookings((list) => list.map((x) => (ids.has(x.id) ? { ...x, status: "declined" } : x)));
    for (const b of stale) shiftSlot(b.artistId, b.dateISO, b.slot, false);
  }, [hydrated, bookings, shiftSlot]);

  /* Anmeldung über die Datenbank in die App übernehmen. Ohne hinterlegte
     Schlüssel passiert hier nichts und die lokale Anmeldung gilt weiter. */
  useEffect(() => {
    if (!hydrated || !isBackendConfigured()) return;
    const sb = supabase();
    const apply = async (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!u) return;
      /* Registrierung als Künstler abschließen, die vor der Anmeldung
         begonnen wurde (siehe queueArtistSignup) */
      const signup = loadJSON<ArtistSignup | null>("pendingArtist", null);
      if (signup) {
        const r = await registerArtist({ data: signup }).catch(() => null);
        if (r && !("error" in r)) saveJSON("pendingArtist", null);
      }
      await hydrateDbArtists(u.id).catch(() => 0);
      const { data: prof } = await sb
        .from("profiles")
        .select("role, display_name, email")
        .eq("id", u.id)
        .maybeSingle();
      const { data: own } = await sb.from("artists").select("id").eq("owner", u.id).limit(1);
      const role = prof?.role === "artist" || prof?.role === "planner" ? prof.role : "customer";
      const meta = u.user_metadata || {};
      setSession({
        name: prof?.display_name || String(meta["full_name"] || meta["name"] || "") || u.email || "",
        email: prof?.email || u.email || "",
        role,
        ...(own && own[0] ? { providerId: own[0].id } : {}),
        backend: true,
      });
      void refreshCloud();
    };
    void sb.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") setSession((cur) => (cur?.backend ? null : cur));
      else if (s?.user) void apply(s.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrated, refreshCloud]);

  /* Veröffentlichte Künstler aus der Datenbank in den Katalog holen */
  useEffect(() => {
    if (!hydrated || !isBackendConfigured()) return;
    void hydrateDbArtists()
      .then((n) => n && setAvail((a) => ({ ...a })))
      .catch(() => 0);
  }, [hydrated]);

  /* Beim Zurückkehren in die App den Stand aus der Datenbank holen, etwa
     wenn der Künstler inzwischen eine Anfrage beantwortet hat */
  useEffect(() => {
    if (!cloudOn) return;
    const onFocus = () => void refreshCloud();
    window.addEventListener("focus", onFocus);
    const iv = window.setInterval(onFocus, 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(iv);
    };
  }, [cloudOn, refreshCloud]);

  const queueArtistSignup = useCallback(
    (signup: ArtistSignup) => {
      saveJSON("pendingArtist", signup);
      /* Schon angemeldet: sofort anlegen und die Rolle übernehmen */
      if (cloudOn)
        void registerArtist({ data: signup })
          .then(async (r) => {
            if ("error" in r) return toast(r.error);
            if ("skipped" in r) return;
            saveJSON("pendingArtist", null);
            await hydrateDbArtists(undefined).catch(() => 0);
            setSession((cur) => (cur ? { ...cur, role: signup.planner ? "planner" : "artist", providerId: r.id } : cur));
            void refreshCloud();
          })
          .catch(() => undefined);
    },
    [cloudOn, refreshCloud, toast],
  );

  const signOut = useCallback(async () => {
    if (session?.backend && isBackendConfigured()) await supabase().auth.signOut();
    setSession(null);
  }, [session]);

  const deleteAccount = useCallback(async (): Promise<DeleteOutcome> => {
    if (!session) return "failed";
    const today = new Date().toISOString().slice(0, 10);
    const open = bookings.some(
      (b) =>
        (b.status === "pending" || b.status === "confirmed" || b.status === "requested") &&
        b.dateISO >= today &&
        (session.providerId === undefined || b.artistId === session.providerId),
    );
    if (open) return "open";
    if (session.backend && isBackendConfigured()) {
      const r = await deleteMyAccount();
      if ("error" in r) return r.error === "open" ? "open" : "failed";
      await supabase().auth.signOut();
    }
    deleteLocalAccount(session.email, session.providerId);
    /* Buchungen bleiben für die Buchhaltung, aber ohne Name und Adresse */
    setBookings((list) => list.map(({ customer: _c, address: _a, ...rest }) => rest));
    setFavorites([]);
    setCart([]);
    setCartBookings([]);
    setCartRequests([]);
    setSession(null);
    return "ok";
  }, [session, bookings]);

  const bookedSlots = useCallback(
    (providerId: number, iso: string) => (avail[providerId] && avail[providerId]![iso]) || [],
    [avail],
  );

  const toggleBlock = useCallback((providerId: number, iso: string, slot: string) => {
    setAvail((a) => {
      const forP = { ...(a[providerId] || {}) };
      const cur = forP[iso] || [];
      forP[iso] = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot];
      return { ...a, [providerId]: forP };
    });
  }, []);

  const mediaV = useSyncExternalStore(subscribeMedia, mediaVersion, () => 0);

  const value: Ctx = {
    mediaVersion: mediaV,
    lang,
    setLang,
    t,
    L,
    fmt,
    fmtDate,
    num,
    catLabel,
    favorites,
    toggleFav,
    cart,
    cartOpen,
    setCartOpen,
    addToCart,
    changeQty,
    removeFromCart,
    cartPrice,
    cartTotal,
    cartCount,
    checkout,
    cartBookings,
    addCartBooking,
    updateCartBooking,
    removeCartBooking,
    cartRequests,
    addCartRequest,
    removeCartRequest,
    completeCart,
    bookings,
    addBooking,
    updateBooking,
    cancelBooking,
    respondBooking,
    cancelByArtist,
    cancelByCustomer,
    reportNoShow,
    claimEmergency,
    checkIn,
    confirmPresence,
    standing,
    instantFor,
    penalties,
    vouchers,
    bankAccounts,
    saveBank,
    payouts,
    addPayout,
    orders,
    session,
    hydrated,
    setSession,
    signOut,
    deleteAccount,
    avail,
    bookedSlots,
    toggleBlock,
    toast,
    toastMsg,
    refreshCloud,
    queueArtistSignup,
  };

  return <ShowlyCtx.Provider value={value}>{children}</ShowlyCtx.Provider>;
}

export function useShowly() {
  const c = useContext(ShowlyCtx);
  if (!c) throw new Error("useShowly must be used inside ShowlyProvider");
  return c;
}
