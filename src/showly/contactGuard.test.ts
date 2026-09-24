import { describe, expect, it } from "vitest";
import { findContact } from "./contactGuard";

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
    "Adresse: Hauptstraße 12, 70173 Stuttgart, Eingang hinten.",
    "Treffpunkt Hauptstr. 12a, 80331 München, bitte 15 Minuten vorher da sein.",
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
