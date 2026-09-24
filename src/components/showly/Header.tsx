import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { useScrolled } from "@/showly/use-scrolled";

export function Header() {
  const { t, lang, setLang, cartCount, setCartOpen, session } = useShowly();
  const navigate = useNavigate();

  /* Kopfzeile bekommt beim Scrollen Schatten und staerkere Unschaerfe */
  useScrolled();

  return (
    <nav>
      <div className="nav-inner">
        <button className="logo" onClick={() => navigate({ to: "/" })} aria-label="Showly">
          <img
            src="/logo-showly@2x.png"
            srcSet="/logo-showly.png 1x, /logo-showly@2x.png 2x"
            alt="Showly"
            width={235}
            height={72}
            className="logo-img"
          />
        </button>
        <div className="nav-links">
          <Link className="nav-link" to="/">
            {t("nav.artists")}
          </Link>
          <Link className="nav-link" to="/shop">
            {t("nav.shop")}
          </Link>
          <Link className="nav-link" to="/torten">
            {t("nav.sweets")}
          </Link>
          <Link className="nav-link hide-sm" to="/mitmachen">
            {t("nav.become")}
          </Link>
          <Link className="nav-link hide-sm" to="/blog">
            {lang === "en" ? "Event blog" : lang === "es" ? "Blog" : "Event-Blog"}
          </Link>
          <LangMenu lang={lang} setLang={setLang} />
          <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Warenkorb">
            <Icon name="cart" />
            <span className="cart-count">{cartCount}</span>
          </button>
          {session && (session.role === "artist" || session.role === "planner") && (
            <Link className="nav-link btn-nav-outline hide-xs" to="/portal">
              {lang === "en" ? "Portal" : lang === "es" ? "Portal" : "Portal"}
            </Link>
          )}
          {/* Ohne Anmeldung fuehrt der Knopf zum Konto, mit Anmeldung ins Dashboard */}
          <Link className="nav-link btn-nav-outline hide-xs" to={session ? "/dashboard" : "/konto"}>
            {session ? session.name.split(" ")[0] : t("nav.login")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

const LANGS = [
  { id: "de", short: "DE", name: "Deutsch" },
  { id: "en", short: "EN", name: "English" },
  { id: "es", short: "ES", name: "Español" },
] as const;

/* Sprachwahl als ein einziger Knopf.
 *
 * Zu sehen ist nur die eingestellte Sprache. Erst ein Klick klappt die
 * Liste auf, die Sprachen stehen untereinander, die aktive mit Haken. Die
 * Liste schließt nach der Wahl, mit Esc und mit einem Klick daneben. Mit den
 * Pfeiltasten wandert man durch die Liste. */
function LangMenu({ lang, setLang }: { lang: string; setLang: (l: "de" | "en" | "es") => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    /* Fokus auf die aktive Sprache, damit die Pfeiltasten sofort gehen */
    wrap.current?.querySelector<HTMLButtonElement>(".lang-menu-item.on")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>(".lang-menu-item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className={"lang-menu" + (open ? " open" : "")} ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="lang-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sprache / Language: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="globe" />
        <span>{current.short}</span>
        <svg className="lang-menu-chev" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="lang-menu-list" role="menu" onKeyDown={onListKey}>
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitemradio"
              aria-checked={l.id === lang}
              className={"lang-menu-item" + (l.id === lang ? " on" : "")}
              onClick={() => {
                if (l.id !== lang) setLang(l.id);
                setOpen(false);
                btn.current?.focus();
              }}
            >
              <span className="lang-menu-code">{l.short}</span>
              <span className="lang-menu-name">{l.name}</span>
              {l.id === lang && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
