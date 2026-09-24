const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="pay-banner pay-banner-error">
        Live-Zahlungen sind noch nicht eingerichtet. Bitte den Go-live in den Zahlungs-Einstellungen abschließen.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="pay-banner">
        Testmodus: Alle Zahlungen in der Vorschau sind Testzahlungen (Karte 4242 4242 4242 4242).
      </div>
    );
  }
  return null;
}
