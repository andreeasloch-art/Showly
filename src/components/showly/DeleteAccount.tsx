/* Konto löschen, direkt in der App.
 *
 * Apple und Google verlangen, dass man sein Konto in der App selbst löschen
 * kann und nicht erst eine E-Mail schreiben muss. Die Rückfrage steht im
 * Kasten selbst, weil Browser-Dialoge wie confirm() in der App-Hülle
 * gesperrt sein können. */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";

const COPY = {
  de: {
    h: "Konto löschen",
    p: "Dein Konto und alle Daten dazu werden endgültig gelöscht.",
    btn: "Konto löschen",
    sureH: "Wirklich löschen?",
    gone: [
      "Anmeldung und persönliche Angaben",
      "Favoriten, Warenkorb, Beiträge, Kommentare und Bewertungen",
      "bei Künstlern: das öffentliche Profil mit Bildern",
    ],
    kept: "Abgeschlossene Buchungen und Rechnungen bewahren wir ohne deinen Namen auf, weil das Gesetz es verlangt (bis zu 10 Jahre).",
    check: "Ich möchte mein Konto endgültig löschen. Das lässt sich nicht rückgängig machen.",
    confirm: "Endgültig löschen",
    cancel: "Abbrechen",
    busy: "Wird gelöscht …",
    open: "Du hast noch offene Buchungen oder Anfragen. Sag sie zuerst ab oder warte, bis sie vorbei sind, dann kannst du dein Konto löschen.",
    failed: "Das Löschen hat nicht geklappt. Bitte versuch es noch einmal oder schreib an support@showly.de.",
    done: "Dein Konto wurde gelöscht.",
  },
  en: {
    h: "Delete account",
    p: "Your account and all related data will be permanently deleted.",
    btn: "Delete account",
    sureH: "Really delete?",
    gone: [
      "Sign-in and personal details",
      "Favourites, cart, posts, comments and reviews",
      "for artists: the public profile including photos",
    ],
    kept: "We keep completed bookings and invoices without your name, as required by law (up to 10 years).",
    check: "I want to permanently delete my account. This cannot be undone.",
    confirm: "Delete permanently",
    cancel: "Cancel",
    busy: "Deleting …",
    open: "You still have open bookings or requests. Cancel them first or wait until they are over, then you can delete your account.",
    failed: "Deleting didn't work. Please try again or write to support@showly.de.",
    done: "Your account has been deleted.",
  },
  es: {
    h: "Eliminar cuenta",
    p: "Tu cuenta y todos sus datos se eliminarán de forma definitiva.",
    btn: "Eliminar cuenta",
    sureH: "¿Seguro que quieres eliminarla?",
    gone: [
      "Inicio de sesión y datos personales",
      "Favoritos, carrito, publicaciones, comentarios y reseñas",
      "para artistas: el perfil público con fotos",
    ],
    kept: "Guardamos las reservas y facturas cerradas sin tu nombre, porque la ley lo exige (hasta 10 años).",
    check: "Quiero eliminar mi cuenta de forma definitiva. No se puede deshacer.",
    confirm: "Eliminar definitivamente",
    cancel: "Cancelar",
    busy: "Eliminando …",
    open: "Todavía tienes reservas o solicitudes abiertas. Cancélalas primero o espera a que terminen y después podrás eliminar tu cuenta.",
    failed: "No se ha podido eliminar. Inténtalo de nuevo o escribe a support@showly.de.",
    done: "Tu cuenta se ha eliminado.",
  },
} as const;

export function DeleteAccount() {
  const { lang, deleteAccount, toast } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    const r = await deleteAccount();
    setBusy(false);
    if (r === "ok") {
      toast(C.done);
      void navigate({ to: "/" });
    } else setMsg(r === "open" ? C.open : C.failed);
  }

  return (
    <section className="del-acc">
      <div className="del-acc-head">
        <span className="del-acc-ic">
          <Icon name="trash" />
        </span>
        <div>
          <h3>{C.h}</h3>
          <p>{C.p}</p>
        </div>
      </div>
      {!open ? (
        <button type="button" className="del-acc-btn" onClick={() => setOpen(true)}>
          {C.btn}
        </button>
      ) : (
        <div className="del-acc-box">
          <b>{C.sureH}</b>
          <ul>
            {C.gone.map((g) => (
              <li key={g}>
                <Icon name="close" /> {g}
              </li>
            ))}
          </ul>
          <p className="del-acc-kept">{C.kept}</p>
          <label className="del-acc-check">
            <input id="del-acc-ok" type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>{C.check}</span>
          </label>
          {msg && (
            <p className="del-acc-msg" role="alert">
              {msg}
            </p>
          )}
          <div className="del-acc-actions">
            <button
              type="button"
              className="home-btn soft"
              onClick={() => {
                setOpen(false);
                setOk(false);
                setMsg("");
              }}
            >
              {C.cancel}
            </button>
            <button type="button" className="del-acc-go" disabled={!ok || busy} onClick={() => void run()}>
              {busy ? C.busy : C.confirm}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
