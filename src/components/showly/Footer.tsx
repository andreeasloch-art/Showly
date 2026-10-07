import { Link, useNavigate } from "@tanstack/react-router";
import { openConsentSettings } from "@/showly/consent";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { InstallApp } from "@/components/showly/InstallApp";

/* Die Adressen der Showly-Kanaele stehen an einer Stelle. Sobald die echten
   Benutzernamen feststehen, nur hier austauschen. */
const SOCIAL = [
  { name: "Instagram", icon: "instagram", url: "https://www.instagram.com/__showly__/" },
  { name: "Facebook", icon: "facebook", url: "https://www.facebook.com/profile.php?id=61595200046446" },
  { name: "TikTok", icon: "tiktok", url: "https://www.tiktok.com/@showly938" },
  { name: "X (Twitter)", icon: "twitter", url: "https://x.com/__showly__" },
] as const;

export function Footer() {
  const { t, lang, setLang, session } = useShowly();
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
              <InstallApp compact stores />
            </div>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.platform")}</div>
            <ul className="footer-links">
              <li>
                <Link to="/">{t("foot.find")}</Link>
              </li>
              <li>
                <Link to="/shop">{t("foot.shop")}</Link>
              </li>
              <li>
                <Link to="/shop" search={{ bereich: "deko" }}>{t("shop.deko")}</Link>
              </li>
              <li>
                <Link to="/torten">{t("nav.sweets")}</Link>
              </li>
              <li>
                <Link to="/mitmachen">{t("foot.become")}</Link>
              </li>
              {session && <li>
                <Link to="/dashboard">{t("foot.dash")}</Link>
              </li>}
              {session?.admin && <li>
                <Link to="/admin">Verwaltung</Link>
              </li>}
            </ul>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.company")}</div>
            <ul className="footer-links">
              <li>
                <Link to="/ueber-showly">{t("foot.about")}</Link>
              </li>
              <li>
                <Link to="/blog">{t("foot.blog")}</Link>
              </li>
              <li>
                <Link to="/wie-funktioniert-showly">{lang === "en" ? "How it works" : lang === "es" ? "Cómo funciona" : "So funktioniert's"}</Link>
              </li>
              <li>
                <Link to="/hilfe">{lang === "en" ? "Help & contact" : lang === "es" ? "Ayuda y contacto" : "Hilfe & Kontakt"}</Link>
              </li>
              <li>{t("foot.jobs")}</li>
              <li>{t("foot.press")}</li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">{t("foot.legal")}</div>
            <ul className="footer-links">
              <li>
                <Link to="/rechtliches/$doc" params={{ doc: "terms" }}>{t("foot.terms")}</Link>
              </li>
              <li>
                <Link to="/rechtliches/$doc" params={{ doc: "privacy" }}>{t("foot.privacy")}</Link>
              </li>
              <li>
                <Link to="/rechtliches/$doc" params={{ doc: "imprint" }}>{t("foot.imprint")}</Link>
              </li>
              <li>
                <Link to="/widerruf">{lang === "en" ? "Withdraw from contract" : lang === "es" ? "Desistir del contrato" : "Vertrag widerrufen"}</Link>
              </li>
              <li>
                <Link to="/rechtliches/$doc" params={{ doc: "withdrawal" }}>
                  {lang === "en" ? "Withdrawal policy" : lang === "es" ? "Derecho de desistimiento" : "Widerrufsbelehrung"}
                </Link>
              </li>
              <li>
                <Link to="/rechtliches/$doc" params={{ doc: "accessibility" }}>
                  {lang === "en" ? "Accessibility" : lang === "es" ? "Accesibilidad" : "Barrierefreiheit"}
                </Link>
              </li>
              <li>
                <button type="button" className="footer-linkbtn" onClick={openConsentSettings}>
                  {t("cookie.change")}
                </button>
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
