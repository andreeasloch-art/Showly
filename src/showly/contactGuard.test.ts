import { describe, expect, it } from "vitest";
import { findContact, mentionsName } from "./contactGuard";

const has = (t: string, k: string) => findContact(t).includes(k as never);
const clean = (t: string) => findContact(t);

describe("Telefonnummern", () => {
  it.each([
    "0151 23456789",
    "Ruf an: 015123456789",
    "+49 151 234 567 89",
    "0049-151-2345-6789",
    "0 1 5 1 2 3 4 5 6 7 8",
    "0151.234.567.89",
    "0151/2345678",
    "(0711) 123 456",
    "0151_23_45_67_89",
    "0151*234*56789",
    "null eins fünf eins zwei drei vier fünf sechs sieben acht",
    "Null-Eins-Fünf-Eins, zwo drei vier, fünf sechs sieben",
    "nulleinsfuenfeinszweidreiviersechs",
    "0 eins 5 eins 2 drei 4 fünf 6",
    "O151 2345678",
    "zero one five one two three four five six",
    "cero uno cinco uno dos tres cuatro",
    "0️⃣1️⃣5️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣",
    "０１５１２３４５６７８",
    "meine nr lautet 0-1-5-1-2-3-4-5-6-7",
  ])("%s", (t) => expect(has(t, "phone")).toBe(true));
});

describe("E-Mail-Adressen", () => {
  it.each([
    "anna@example.de",
    "anna @ gmx . de",
    "anna (at) web punkt de",
    "anna [at] mail [dot] com",
    "anna at gmail dot com",
    "Schreib mir bei gmx",
    "anna ät outlook punkt de",
  ])("%s", (t) => expect(has(t, "email")).toBe(true));
});

describe("Webseiten und Shops", () => {
  it.each([
    "www.zauber-max.de",
    "www punkt zaubermax punkt de",
    "Schau auf zaubermax.de vorbei",
    "zaubermax punkt de",
    "https://example.com/shop",
    "tortenliebe (dot) shop",
  ])("%s", (t) => expect(has(t, "web")).toBe(true));
});

describe("Social Media und Messenger", () => {
  it.each(["Folg mir auf Instagram", "schreib per WhatsApp", "insta: @zauber_max", "Telegram", "@zauber.max"])(
    "%s",
    (t) => expect(has(t, "social")).toBe(true),
  );
});

describe("Aufforderung zum direkten Kontakt", () => {
  it.each([
    "Ruf mich an, dann klären wir das",
    "Buch mich lieber direkt bei mir, ohne Showly",
    "Wir können das auch in bar machen",
    "Google mich einfach, mein Shop heißt Tortenliebe",
    "Das spart dir die Servicegebühr, wenn wir außerhalb von Showly buchen",
    "Tel. auf Anfrage",
    "call me",
    "Bitte ruft vorher kurz an",
  ])("%s", (t) => expect(has(t, "offplatform")).toBe(true));
});

describe("harmlose Texte bleiben erlaubt", () => {
  it.each([
    "Kindergeburtstag am 24.12.2026 um 15:00 Uhr, 12 Kinder zwischen 5 und 8 Jahren.",
    "Hochzeit am 24. 12. 2026 von 18 bis 23 Uhr mit 120 Gästen, Budget 1.500 €.",
    "Wir sind acht Erwachsene und drei Kinder.",
    "Die Torte sollte drei Etagen haben, für ca. 60 Personen, Kosten bis 450 Euro.",
    "Bitte ein Programm von 45 Minuten, Start 16.30 Uhr, Ende 17.15 Uhr.",
    "Mein Sohn wird 7 und liebt Elsa aus der Eiskönigin.",
    "Super Show, alle waren begeistert. Gerne wieder!",
    "Paket Gold für 2026, Bühne 4 x 6 m, Strom vorhanden.",
    "Ich spiele Gitarre und singe auf Deutsch und Englisch.",
    "Ein, zwei Lieder zum Einzug wären schön.",
  ])("%s", (t) => expect(clean(t)).toEqual([]));
});

/* Adressen gehören ins Adressfeld der Kasse, nicht in Nachrichten */
describe("Adressen", () => {
  it.each([
    "Adresse: Hauptstraße 12, 70173 Stuttgart, Eingang hinten.",
    "Treffpunkt Hauptstr. 12a, 80331 München, bitte 15 Minuten vorher da sein.",
    "Abholung im Lindenweg 4",
    "Wir sind in D-10115 Berlin",
    "Kommt einfach zur Bahnhofstrasse 3",
    "Calle Mayor 14, Madrid",
    "Bei mir zu Hause abholen",
    "Meine Adresse schicke ich dir noch",
  ])("%s", (t) => expect(has(t, "address")).toBe(true));
  it.each([
    "Bring 2 Torten mit",
    "Hochzeit im Juni 2026 feiern",
    "3 Etagen, 60 Personen, in Nürnberg 3 Tage vorher",
    "Am Samstag 14 Uhr abholen",
    "10000 Gäste sind es nicht, eher 40",
  ])("kein Treffer: %s", (t) => expect(has(t, "address")).toBe(false));
});

describe("Namen", () => {
  it.each([
    "Ich heiße Maria Schulz",
    "Mein Name ist Jonas",
    "Unsere Konditorei heißt Tortenliebe",
    "My name is Anna",
    "Me llamo Lucía",
  ])("%s", (t) => expect(has(t, "name")).toBe(true));
  it("Ich heiße dich willkommen ist kein Name", () => expect(has("Ich heiße dich herzlich willkommen", "name")).toBe(false));
  it("echte Namen der Beteiligten", () => {
    expect(findContact("Frag nach Frau Brenner", { names: ["Sabine Brenner"] })).toContain("name");
    expect(findContact("Schreib an Zuckerblüte direkt", { names: ["Konditorei Zuckerblüte"] })).toContain("name");
    expect(findContact("Die Konditorei macht das gern", { names: ["Konditorei Zuckerblüte"] })).toEqual([]);
  });
  it("mentionsName ignoriert Allerweltswörter", () => {
    expect(mentionsName("Eine Torte aus Berlin", ["Torten Atelier Berlin"])).toBe(false);
    expect(mentionsName("Bei SAHNEHÄUBCHEN bestellt", ["Tortenatelier Sahnehäubchen"])).toBe(true);
  });
});
