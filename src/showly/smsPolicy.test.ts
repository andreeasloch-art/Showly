import { describe, expect, it } from "vitest";
import { checkSmsNumber, parseCountryList } from "./smsPolicy";

describe("SMS nur an echte Handynummern in freigegebenen Ländern", () => {
  it("deutsche, österreichische, spanische Handynummern", () => {
    expect(checkSmsNumber("+4915123456789")).toEqual({ e164: "+4915123456789", country: "DE" });
    expect(checkSmsNumber("+436641234567")).toMatchObject({ country: "AT" });
    expect(checkSmsNumber("+34612345678")).toMatchObject({ country: "ES" });
    expect(checkSmsNumber("+573001234567")).toMatchObject({ country: "CO" });
    expect(checkSmsNumber("+12025550123")).toMatchObject({ country: "US" });
  });
  it("Festnetz und Sondernummern bekommen keine SMS", () => {
    expect(checkSmsNumber("+4930123456")).toEqual({ refused: "landline" });
    expect(checkSmsNumber("+499001234567")).toEqual({ refused: "landline" });
  });
  it("Länder außerhalb der Liste nur mit Freischaltung", () => {
    expect(checkSmsNumber("+33612345678")).toEqual({ refused: "country" });
    expect(checkSmsNumber("+33612345678", ["FR"])).toMatchObject({ country: "FR" });
  });
  it("Unsinn wird abgelehnt", () => {
    expect(checkSmsNumber("123")).toEqual({ refused: "invalid" });
    expect(checkSmsNumber("")).toEqual({ refused: "invalid" });
  });
  it("Länderliste aus der Einstellung", () => {
    expect(parseCountryList("fr, it;NL x")).toEqual(["FR", "IT", "NL"]);
    expect(parseCountryList(undefined)).toEqual([]);
  });
});
