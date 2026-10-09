/* E-Rechnung für Firmenkunden gewerblicher Anbieter (e_rechnung_erforderlich):
 * XRechnung 3.0 in der CII-Syntax (UN/CEFACT Cross Industry Invoice,
 * EN 16931). Die XML-Datei ist die eigentliche E-Rechnung; zusätzlich wird
 * sie als "xrechnung.xml" in das PDF eingebettet (ZUGFeRD-ähnliches
 * Hybrid-PDF, aber ohne PDF/A-3-Zertifizierung).
 *
 * Warum selbst erzeugt: Die gängigen Bibliotheken (z. B. @e-invoice-eu/core)
 * brauchen Dateisystem und Node-Module, die im Cloudflare-Worker nicht laufen.
 * Vor dem Pflichtbetrieb (Ausstellungspflicht ab 2027/2028) einmal mit dem
 * KoSIT-Validator prüfen (EINRICHTUNG.md). */
import { AFRelationship, PDFDocument } from "pdf-lib";
import type { BelegEntwurf, Partei } from "@/showly/belege";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const betrag = (c: number) => (c / 100).toFixed(2);
const tag = (d: string | null | undefined) => (d || "").replace(/-/g, "");
const rund = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

/** Belegart -> Rechnungstyp (UNTDID 1001) */
const TYP: Record<string, string> = { rechnung: "380", korrektur: "384", storno: "381", provisionsrechnung: "380" };

function partei(rolle: "SellerTradeParty" | "BuyerTradeParty", p: Partei & Record<string, unknown>) {
  const name = p.firma && String(p.firma).trim() ? p.firma : p.name;
  const steuer = [
    p.ust_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.ust_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
    rolle === "SellerTradeParty" && p.steuernummer
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(p.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "",
  ].join("");
  const kontakt =
    rolle === "SellerTradeParty"
      ? `<ram:DefinedTradeContact><ram:PersonName>${esc(p.name || name)}</ram:PersonName><ram:EmailURIUniversalCommunication><ram:URIID>${esc(p.email || "rechnung@showly.eu")}</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>`
      : "";
  return (
    `<ram:${rolle}><ram:Name>${esc(name)}</ram:Name>${kontakt}` +
    `<ram:PostalTradeAddress><ram:PostcodeCode>${esc(p.plz)}</ram:PostcodeCode><ram:LineOne>${esc(p.strasse)}</ram:LineOne>` +
    `<ram:CityName>${esc(p.ort)}</ram:CityName><ram:CountryID>${esc(p.land || "DE")}</ram:CountryID></ram:PostalTradeAddress>` +
    `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email || (rolle === "SellerTradeParty" ? "rechnung@showly.eu" : "kunde@showly.eu"))}</ram:URIID></ram:URIUniversalCommunication>` +
    `${steuer}</ram:${rolle}>`
  );
}

/** Nettobeträge je Position so verteilen, dass sie je Steuersatz genau die
 *  Netto-Summe der Gruppe ergeben (EN 16931 BR-S-08). Bei Provisions-
 *  rechnungen sind die Positionen schon netto. */
export function zeilenNetto(b: BelegEntwurf): number[] {
  if (b.art === "provisionsrechnung") return b.positionen.map((p) => p.brutto_cent);
  const out = b.positionen.map(() => 0);
  for (const g of b.steuer_aufstellung) {
    const idx = b.positionen.map((p, i) => (p.steuersatz === g.satz ? i : -1)).filter((i) => i >= 0);
    let rest = g.netto_cent;
    idx.forEach((i, k) => {
      const p = b.positionen[i]!;
      const n = k === idx.length - 1 ? rest : g.brutto_cent ? rund((g.netto_cent * p.brutto_cent) / g.brutto_cent) : 0;
      out[i] = n;
      rest -= n;
    });
  }
  return out;
}

export function xrechnungCii(b: BelegEntwurf & { nummer: string; bezug_nummer?: string | null }): string {
  const netto = zeilenNetto(b);
  const kat = (satz: number) => (satz > 0 ? "S" : b.aussteller_snapshot["typ"] === "kleinunternehmer" ? "E" : "Z");
  const zeilen = b.positionen
    .map((p, i) => {
      const menge = p.menge || 1;
      return (
        `<ram:IncludedSupplyChainTradeLineItem>` +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct><ram:Name>${esc(p.beschreibung)}</ram:Name></ram:SpecifiedTradeProduct>` +
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${(netto[i]! / 100 / menge).toFixed(4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${menge}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        `<ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${kat(p.steuersatz)}</ram:CategoryCode><ram:RateApplicablePercent>${p.steuersatz}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${betrag(netto[i]!)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>` +
        `</ram:IncludedSupplyChainTradeLineItem>`
      );
    })
    .join("");
  const steuern = b.steuer_aufstellung
    .map(
      (g) =>
        `<ram:ApplicableTradeTax><ram:CalculatedAmount>${betrag(g.steuer_cent)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>` +
        (kat(g.satz) === "E" ? `<ram:ExemptionReason>Kleinunternehmer gemäß § 19 UStG</ram:ExemptionReason>` : "") +
        `<ram:BasisAmount>${betrag(g.netto_cent)}</ram:BasisAmount><ram:CategoryCode>${kat(g.satz)}</ram:CategoryCode>` +
        (kat(g.satz) === "E" ? `<ram:ExemptionReasonCode>VATEX-EU-132</ram:ExemptionReasonCode>` : "") +
        `<ram:RateApplicablePercent>${g.satz}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`,
    )
    .join("");
  const hinweise = b.pflichthinweise.map((h) => `<ram:IncludedNote><ram:Content>${esc(h)}</ram:Content></ram:IncludedNote>`).join("");
  const bezahlt = b.art === "rechnung" ? b.brutto_cent : 0;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">` +
    `<rsm:ExchangedDocumentContext>` +
    `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` +
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>` +
    `</rsm:ExchangedDocumentContext>` +
    `<rsm:ExchangedDocument><ram:ID>${esc(b.nummer)}</ram:ID><ram:TypeCode>${TYP[b.art] ?? "380"}</ram:TypeCode>` +
    `<ram:IssueDateTime><udt:DateTimeString format="102">${tag(b.belegdatum)}</udt:DateTimeString></ram:IssueDateTime>${hinweise}</rsm:ExchangedDocument>` +
    `<rsm:SupplyChainTradeTransaction>${zeilen}` +
    `<ram:ApplicableHeaderTradeAgreement><ram:BuyerReference>${esc(b.order_id ? `Showly-${b.order_id}` : b.nummer)}</ram:BuyerReference>` +
    partei("SellerTradeParty", b.aussteller_snapshot) +
    partei("BuyerTradeParty", b.empfaenger_snapshot) +
    `</ram:ApplicableHeaderTradeAgreement>` +
    `<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${tag(b.leistung_bis || b.belegdatum)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>` +
    `<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>` +
    `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>ZZZ</ram:TypeCode><ram:Information>Über Showly bezahlt (Karte bzw. Zahlungsdienst)</ram:Information></ram:SpecifiedTradeSettlementPaymentMeans>` +
    steuern +
    (b.leistung_von && b.leistung_bis
      ? `<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">${tag(b.leistung_von)}</udt:DateTimeString></ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">${tag(b.leistung_bis)}</udt:DateTimeString></ram:EndDateTime></ram:BillingSpecifiedPeriod>`
      : "") +
    `<ram:SpecifiedTradePaymentTerms><ram:Description>${bezahlt ? "Bereits bezahlt über Showly." : "Verrechnung über Showly."}</ram:Description></ram:SpecifiedTradePaymentTerms>` +
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    `<ram:LineTotalAmount>${betrag(netto.reduce((n, x) => n + x, 0))}</ram:LineTotalAmount>` +
    `<ram:TaxBasisTotalAmount>${betrag(b.netto_cent)}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="EUR">${betrag(b.steuer_cent)}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${betrag(b.brutto_cent)}</ram:GrandTotalAmount>` +
    `<ram:TotalPrepaidAmount>${betrag(bezahlt)}</ram:TotalPrepaidAmount>` +
    `<ram:DuePayableAmount>${betrag(b.brutto_cent - bezahlt)}</ram:DuePayableAmount>` +
    `</ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    (b.bezug_nummer ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(b.bezug_nummer)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : "") +
    `</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`
  );
}

/** XML als Anhang in das PDF einbetten (Hybrid-PDF) */
export async function pdfMitXml(pdf: Uint8Array, xml: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  await doc.attach(new TextEncoder().encode(xml), "xrechnung.xml", {
    mimeType: "application/xml",
    description: "XRechnung (CII), EN 16931",
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  return doc.save({ useObjectStreams: false });
}
