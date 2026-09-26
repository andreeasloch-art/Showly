/* Steuerhinweis für Anbieter und Hinweis für Kunden bei Privatanbietern.
 * Texte: showly/providerStatus.ts */
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { STATUS, TAX, pick } from "@/showly/providerStatus";

/** Kasten mit dem Steuerhinweis (Dashboard, Registrierung, Anbieter-Editor) */
export function TaxNotice({ compact = false }: { compact?: boolean }) {
  const { lang } = useShowly();
  const T = pick(TAX, lang);
  return (
    <div className={"tax-note" + (compact ? " compact" : "")} role="note">
      <Icon name="scale" />
      <div>
        <b>{T.h}</b>
        <p>{T.text}</p>
        {!compact && (
          <Link to="/hilfe" className="tax-note-more">
            {T.more}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Kennzeichnung im Profil: privat oder gewerblich, bei privat mit Hinweis
 *  zu den Verbraucherrechten */
export function ProviderStatusNote({ business }: { business: boolean }) {
  const { lang } = useShowly();
  const S = pick(STATUS, lang);
  if (business)
    return (
      <p className="prov-status biz">
        <Icon name="shield" /> {S.badgeBusiness}
      </p>
    );
  return (
    <div className="prov-status priv" role="note">
      <b>
        <Icon name="user" /> {S.badgePrivate}
      </b>
      <p>{S.consumer}</p>
    </div>
  );
}

/** Auswahl privat / gewerblich für Registrierungen */
export function StatusChoice({ value, onChange }: { value: boolean | null; onChange: (business: boolean) => void }) {
  const { lang } = useShowly();
  const S = pick(STATUS, lang);
  return (
    <fieldset className="status-choice">
      <legend>{S.q}</legend>
      {(
        [
          [false, S.private, S.privateP, "user"],
          [true, S.business, S.businessP, "shield"],
        ] as const
      ).map(([biz, label, sub, icon]) => (
        <label key={String(biz)} className={value === biz ? "on" : ""}>
          <input type="radio" name="provider-status" checked={value === biz} onChange={() => onChange(biz)} />
          <Icon name={icon} />
          <span>
            <b>{label}</b>
            <small>{sub}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Pflicht-Häkchen zum Steuerhinweis */
export function TaxAck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { lang } = useShowly();
  const T = pick(TAX, lang);
  return (
    <label className="reg-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{T.ack}</span>
    </label>
  );
}
