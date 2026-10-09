/* Wunschtorte mit höherem Preis: Kunde bestätigt und zahlt die Differenz
 * nach (Stripe), oder lehnt ab und bekommt alles zurück
 * (utils/wishcake.functions.ts).
 * Angebot auf eine Anfrage ohne Vorauszahlung: in den Warenkorb legen und
 * an der Kasse bezahlen, oder ablehnen. */
import { useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useShowly } from "@/showly/store";
import type { SweetRequest } from "@/showly/sweets";

export function QuoteDecision({ r }: { r: SweetRequest }) {
  const { fmt, toast, refreshCloud, addCartRequest, cartRequests, setCartOpen } = useShowly();
  const [pay, setPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = Number(r.id.replace(/^db-/, ""));
  const quote = r.quote ?? 0;
  /* Ohne Vorauszahlung: reines Angebot */
  const offer = !r.paid || r.paid <= 0;
  const paid = r.paid ?? r.estimate;
  const due = Math.max(0, Math.round((quote - paid) * 100) / 100);

  async function decline() {
    if (!window.confirm(offer ? "Angebot ablehnen?" : `Neuen Preis ablehnen? Die Torte entfällt und du bekommst ${fmt(paid)} zurück.`)) return;
    setBusy(true);
    const { quoteDecline } = await import("@/utils/wishcake.functions");
    const res = await quoteDecline({ data: { requestId: id } }).catch(() => ({ error: "Hat nicht geklappt" }));
    setBusy(false);
    if ("error" in res) return toast(res.error);
    toast(offer ? "Angebot abgelehnt." : `Abgelehnt. ${fmt(paid)} gehen an dich zurück.`);
    void refreshCloud();
  }

  const fetchClientSecret = async () => {
    const { quoteCheckout } = await import("@/utils/wishcake.functions");
    const res = await quoteCheckout({
      data: {
        requestId: id,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/dashboard?tab=requests&nachzahlung={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in res) {
      toast(res.error);
      throw new Error(res.error);
    }
    return res.clientSecret;
  };

  function toCart() {
    if (!cartRequests.some((x) => x.offerId === id))
      addCartRequest({
        sweetId: r.sweetId,
        bakerId: r.bakerId,
        dateISO: r.dateISO,
        qty: r.qty,
        city: r.city,
        wishes: r.wishes,
        estimate: quote,
        offerId: id,
      });
    toast("Angebot liegt im Warenkorb.");
    setCartOpen(true);
  }

  if (offer)
    return (
      <div className="quote-box" role="group" aria-label="Angebot">
        <p>
          <b>Angebot der Konditorei: {fmt(quote)}</b>. Erst mit der Zahlung ist die Torte bestellt.
        </p>
        {r.quoteNote && <p className="fair-muted">Dazu schreibt die Konditorei: „{r.quoteNote}“</p>}
        <div className="fair-row wrap">
          <button type="button" className="dash26-mini" disabled={busy} onClick={toCart}>
            In den Warenkorb
          </button>
          <button type="button" className="dash26-mini outline inb-decline-ghost" disabled={busy} onClick={() => void decline()}>
            Ablehnen
          </button>
        </div>
      </div>
    );

  return (
    <div className="quote-box" role="group" aria-label="Neuer Preis">
      <p>
        <b>Neuer Preis: {fmt(quote)}</b> statt {fmt(paid)}. Bestätigst du, zahlst du <b>{fmt(due)}</b> nach.
      </p>
      {r.quoteNote && <p className="fair-muted">Begründung der Konditorei: „{r.quoteNote}“</p>}
      {pay ? (
        <div id="checkout">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : (
        <div className="fair-row wrap">
          <button type="button" className="dash26-mini" disabled={busy} onClick={() => setPay(true)}>
            Bestätigen und {fmt(due)} nachzahlen
          </button>
          <button type="button" className="dash26-mini outline inb-decline-ghost" disabled={busy} onClick={() => void decline()}>
            Ablehnen, Geld zurück
          </button>
        </div>
      )}
    </div>
  );
}
