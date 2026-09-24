import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

/* Die Adressen der Showly-Kanaele stehen an einer Stelle. Sobald die echten
   Benutzernamen feststehen, nur hier austauschen. */
const SOCIAL = [
  { name: "Instagram", icon: "instagram", url: "https://www.instagram.com/showly" },
  { name: "Facebook", icon: "facebook", url: "https://www.facebook.com/showly" },
  { name: "TikTok", icon: "tiktok", url: "https://www.tiktok.com/@showly" },
  { name: "X (Twitter)", icon: "twitter", url: "https://x.com/showly" },
] as const;

/* Die App-Verweise. Die Kennung der iOS-App steht erst nach der ersten
   Einreichung fest; bis dahin zeigt der Verweis auf die Suche im App Store.
   Sobald sie da ist, nur hier austauschen. */
const STORES = {
  apple: "https://apps.apple.com/de/search?term=showly",
  google: "https://play.google.com/store/apps/details?id=com.showly.app",
} as const;

/* Die beiden Markenzeichen stehen hier als Bild im Text, nicht in ICON:
   Apple ist einfarbig, Google Play trägt vier feste Farben. */
function AppleMark() {
  return (
    <svg className="store-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.9 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4 0-.1-2.3-.9-2.3-3.3Z" />
      <path d="M14.8 6.2c.6-.7 1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.6 2.7-1.4Z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg className="store-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.7 2.1c-.4.3-.6.8-.6 1.4v17c0 .6.2 1.1.6 1.4l9.4-9.9z" fill="#00D1FF" />
      <path d="M16.6 15.4 13.1 12l3.5-3.4 3.7 2.1c1.1.6 1.1 1.7 0 2.4z" fill="#FFCE00" />
      <path d="M16.6 15.4 13.1 12l-9.4 9.9c.5.4 1.1.4 1.8 0z" fill="#FF3A44" />
      <path d="M16.6 8.6 13.1 12 3.7 2.1c.7-.4 1.3-.4 1.8 0z" fill="#00E676" />
    </svg>
  );
}

export function Footer() {
  const { t, lang, setLang } = useShowly();
  const navigate = useNavigate();

  return (
    <div className="site-footer">
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <img
                src="/logo-showly@2x.png"
                srcSet="/logo-showly.png 1x, /logo-showly@2x.png 2x"
                alt="Showly"
                width={235}
                height={72}
                className="logo-img"
              />
            </div>
            <p className="footer-desc">{t("foot.desc")}</p>
            <div className="social-row">
              {SOCIAL.map((s) => (
                <a
                  key={s.name}
                  className={"social-btn social-" + s.icon}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  title={s.name}
                >
                  <Icon name={s.icon} />
                </a>
              ))}
            </div>

            <div className="footer-apps">
              <div className="footer-col-title">{t("foot.apps")}</div>
              <p className="footer-apps-p">{t("foot.appsP")}</p>
              <div className="store-row">
                <a
                  className="store-badge"
                  href={STORES.apple}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("foot.appStoreTop") + " App Store"}
                >
                  <AppleMark />
                  <span className="store-text">
                    <small>{t("foot.appStoreTop")}</small>
                    <strong>App Store</strong>
                  </span>
                </a>
                <a
                  className="store-badge"
                  href={STORES.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("foot.playTop") + " Google Play"}
                >
                  <PlayMark />
                  <span className="store-text">
                    <small>{t("foot.playTop")}</small>
                    <strong>Google Play</strong>
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.platform")}</div>
            <ul className="footer-links">
              <li onClick={() => navigate({ to: "/" })}>{t("foot.find")}</li>
              <li onClick={() => navigate({ to: "/shop" })}>{t("foot.shop")}</li>
              <li onClick={() => navigate({ to: "/shop", search: { bereich: "deko" } })}>{t("shop.deko")}</li>
              <li onClick={() => navigate({ to: "/torten" })}>{t("nav.sweets")}</li>
              <li onClick={() => navigate({ to: "/mitmachen" })}>{t("foot.become")}</li>
              <li onClick={() => navigate({ to: "/dashboard" })}>{t("foot.dash")}</li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.company")}</div>
            <ul className="footer-links">
              <li>{t("foot.about")}</li>
              <li onClick={() => navigate({ to: "/blog" })}>{t("foot.blog")}</li>
              <li>{t("foot.jobs")}</li>
              <li>{t("foot.press")}</li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.legal")}</div>
            <ul className="footer-links">
              <li onClick={() => navigate({ to: "/rechtliches/$doc", params: { doc: "terms" } })}>
                {t("foot.terms")}
              </li>
              <li onClick={() => navigate({ to: "/rechtliches/$doc", params: { doc: "privacy" } })}>
                {t("foot.privacy")}
              </li>
              <li onClick={() => navigate({ to: "/rechtliches/$doc", params: { doc: "imprint" } })}>
                {t("foot.imprint")}
              </li>
              <li onClick={() => navigate({ to: "/rechtliches/$doc", params: { doc: "cookies" } })}>
                {t("cookie.change")}
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t("foot.rights")}</span>
          <span className="footer-lang">
            <button className={lang === "de" ? "active" : ""} onClick={() => setLang("de")}>DE</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "es" ? "active" : ""} onClick={() => setLang("es")}>ES</button>
          </span>
          <span>{t("foot.countries")}</span>
        </div>
      </footer>
    </div>
  );
}
