/* Lokale Landingpages: „Zauberer buchen Berlin“, „Motivtorte bestellen
 * München“ (rein, getestet in landing.test.ts).
 *
 * Adresse: /buchen/<leistung>/<stadt>, z. B. /buchen/zauberer/berlin.
 *
 * Gegen Duplicate Content:
 *  - Jede Leistung hat einen eigenen, von Hand geschriebenen Text (unten).
 *  - Der Stadtteil der Seite besteht aus echten Daten: welche Anbieter dort
 *    auftreten bzw. liefern, Preisspanne aus ihren Profilen, Bewertungen,
 *    Nachbarstädte.
 *  - In den Suchindex kommt eine Seite erst, wenn dort mindestens
 *    MIN_INDEX echte Anbieter (keine Beispiele) zu finden sind. Bis dahin
 *    steht sie auf noindex und fehlt in der Sitemap. So entstehen keine
 *    Tausende leerer Stadtseiten. */

export const MIN_INDEX = 3;

export interface City {
  slug: string;
  name: string;
  /** Bundesland bzw. Land, nur zur Einordnung im Text */
  region: string;
  lat: number;
  lon: number;
}

/* Größte Städte im Liefergebiet. Weitere lassen sich ergänzen; Koordinaten
   ungefähr Stadtmitte. */
export const CITIES: City[] = [
  { slug: "berlin", name: "Berlin", region: "Berlin", lat: 52.52, lon: 13.405 },
  { slug: "hamburg", name: "Hamburg", region: "Hamburg", lat: 53.551, lon: 9.994 },
  { slug: "muenchen", name: "München", region: "Bayern", lat: 48.137, lon: 11.575 },
  { slug: "koeln", name: "Köln", region: "Nordrhein-Westfalen", lat: 50.938, lon: 6.96 },
  { slug: "frankfurt-am-main", name: "Frankfurt am Main", region: "Hessen", lat: 50.11, lon: 8.682 },
  { slug: "stuttgart", name: "Stuttgart", region: "Baden-Württemberg", lat: 48.776, lon: 9.183 },
  { slug: "duesseldorf", name: "Düsseldorf", region: "Nordrhein-Westfalen", lat: 51.227, lon: 6.774 },
  { slug: "leipzig", name: "Leipzig", region: "Sachsen", lat: 51.34, lon: 12.375 },
  { slug: "dortmund", name: "Dortmund", region: "Nordrhein-Westfalen", lat: 51.514, lon: 7.468 },
  { slug: "essen", name: "Essen", region: "Nordrhein-Westfalen", lat: 51.456, lon: 7.012 },
  { slug: "bremen", name: "Bremen", region: "Bremen", lat: 53.079, lon: 8.802 },
  { slug: "dresden", name: "Dresden", region: "Sachsen", lat: 51.05, lon: 13.738 },
  { slug: "hannover", name: "Hannover", region: "Niedersachsen", lat: 52.375, lon: 9.732 },
  { slug: "nuernberg", name: "Nürnberg", region: "Bayern", lat: 49.452, lon: 11.077 },
  { slug: "wien", name: "Wien", region: "Österreich", lat: 48.208, lon: 16.373 },
  { slug: "zuerich", name: "Zürich", region: "Schweiz", lat: 47.377, lon: 8.54 },
];

export const cityBySlug = (s: string) => CITIES.find((c) => c.slug === s) ?? null;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Nachbarstädte (für Links), nach Entfernung */
export function nearbyCities(c: City, n = 4): City[] {
  return CITIES.filter((x) => x.slug !== c.slug)
    .map((x) => ({ x, d: distanceKm(c, x) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, n)
    .map((p) => p.x);
}

/** Kommt ein Anbieter mit Wohnort `homeSlug` und Umkreis `radiusKm` in die Stadt? */
export function serves(homeSlug: string, radiusKm: number, city: City): boolean {
  if (!homeSlug) return false;
  if (homeSlug === city.slug) return true;
  const home = cityBySlug(homeSlug);
  if (!home) return false;
  return distanceKm(home, city) <= Math.max(0, radiusKm);
}

export interface Service {
  /** Teil der Adresse */
  slug: string;
  /** Kategorie der Künstler; "cake" für Torten */
  cat: string;
  /** „Zauberer“, „Motivtorten“ */
  plural: string;
  /** „Zauberer buchen“, „Motivtorte bestellen“ */
  verb: string;
  intro: string;
  tips: string[];
  occasions: string[];
}

/* Eigene Texte je Leistung. Keine erfundenen Zahlen: Preise, Anzahl und
   Bewertungen kommen auf der Seite aus den echten Profilen. */
export const SERVICES: Service[] = [
  {
    slug: "zauberer",
    cat: "magician",
    plural: "Zauberer",
    verb: "Zauberer buchen",
    intro:
      "Ein Zauberer funktioniert fast überall: am Tisch zwischen den Gästen, auf einer kleinen Bühne oder im Wohnzimmer beim Kindergeburtstag. Gute Zauberkünstler passen ihr Programm an das Publikum an. Für Kinder gibt es Mitmach-Tricks mit viel Humor, für Erwachsene Close-up-Magie mit Karten, Münzen und geliehenen Gegenständen.",
    tips: [
      "Frag nach dem Alter des Publikums: Kinderprogramm und Close-up für Erwachsene sind zwei verschiedene Shows.",
      "Kläre den Platz: Für eine Bühnenshow braucht es eine freie Fläche, für Tischzauberei nur Laufwege zwischen den Tischen.",
      "Bei Kindern unter fünf Jahren lieber ein kurzes Programm von 30 bis 45 Minuten wählen.",
    ],
    occasions: ["Kindergeburtstag", "Hochzeit (Sektempfang)", "Firmenfeier", "Weihnachtsfeier"],
  },
  {
    slug: "superheld",
    cat: "superhero",
    plural: "Superhelden",
    verb: "Superheld buchen",
    intro:
      "Ein Superheld zum Kindergeburtstag ist für viele Kinder das Highlight des Jahres. Die Darsteller kommen im Kostüm, spielen Heldentraining, Schatzsuche oder Fotorunde und bleiben dabei in ihrer Rolle. Welche Figuren jemand spielt, steht im jeweiligen Profil.",
    tips: [
      "Schau im Profil nach den angebotenen Figuren und wähle sie bei der Buchung aus.",
      "Plane einen ruhigen Moment für Fotos ein, am besten gleich zu Beginn.",
      "Für draußen: Frag nach, ob das Programm auch im Garten oder Park funktioniert.",
    ],
    occasions: ["Kindergeburtstag", "Kita- und Schulfest", "Stadtfest", "Einweihung"],
  },
  {
    slug: "maerchenfiguren",
    cat: "fairy",
    plural: "Märchenfiguren",
    verb: "Märchenfigur buchen",
    intro:
      "Prinzessin, Eiskönigin oder Fee: Märchenfiguren besuchen Kindergeburtstage und Familienfeste im passenden Kostüm, erzählen Geschichten, singen und spielen mit den Kindern. Viele bringen kleine Aktionen mit, etwa Krönung, Schminken oder eine Tanzrunde.",
    tips: [
      "Sag vorher, welche Figur sich das Geburtstagskind wünscht, und wie alt die Kinder sind.",
      "Kurz und intensiv ist bei Kleinen oft besser: 60 Minuten reichen meist.",
      "Frag, ob Fotos mit der Figur erlaubt sind und ob ein Geschenk übergeben werden soll.",
    ],
    occasions: ["Kindergeburtstag", "Taufe", "Kita-Fest", "Weihnachtsmarkt"],
  },
  {
    slug: "clown",
    cat: "clown",
    plural: "Clowns",
    verb: "Clown buchen",
    intro:
      "Clowns bringen Kinder und Erwachsene mit Slapstick, Ballonfiguren und kleinen Mitmach-Nummern zum Lachen. Ein gutes Clownprogramm ist laut und leise zugleich: Es lässt schüchternen Kindern Raum und holt die mutigen nach vorne.",
    tips: [
      "Manche Kinder haben Angst vor Clowns. Ein Clown mit dezenter Schminke ist dann die bessere Wahl.",
      "Ballonfiguren dauern: Bei vielen Kindern lieber etwas mehr Zeit buchen.",
      "Frag nach dem Programm bei Regen, wenn draußen gefeiert wird.",
    ],
    occasions: ["Kindergeburtstag", "Sommerfest", "Eröffnung", "Familienfest"],
  },
  {
    slug: "kinderschminken",
    cat: "facepaint",
    plural: "Kinderschminker",
    verb: "Kinderschminken buchen",
    intro:
      "Beim Kinderschminken wird aus jedem Kind in wenigen Minuten ein Tiger, Schmetterling oder Superheld. Profis arbeiten mit hautfreundlichen Schminkfarben auf Wasserbasis und haben Motivbücher dabei, aus denen die Kinder wählen.",
    tips: [
      "Rechne grob mit drei bis acht Minuten pro Kind, je nach Motiv.",
      "Frag nach den verwendeten Farben, wenn ein Kind empfindliche Haut hat.",
      "Ein Tisch, zwei Stühle und Licht reichen als Platz.",
    ],
    occasions: ["Kindergeburtstag", "Kita- und Schulfest", "Firmen-Familientag", "Stadtfest"],
  },
  {
    slug: "weihnachtsmann",
    cat: "santa",
    plural: "Weihnachtsmänner",
    verb: "Weihnachtsmann buchen",
    intro:
      "Der Weihnachtsmann kommt an Heiligabend nach Hause, zur Weihnachtsfeier in die Firma oder auf den Weihnachtsmarkt. Die meisten Termine sind am 24. Dezember gefragt, deshalb lohnt es sich, früh zu buchen.",
    tips: [
      "Gib vorher die Namen der Kinder und ein paar Sätze zu jedem Kind weiter.",
      "Stell die Geschenke an einen abgesprochenen Ort, zum Beispiel vor die Tür.",
      "An Heiligabend sind kurze Besuche üblich, oft 15 bis 30 Minuten.",
    ],
    occasions: ["Heiligabend", "Weihnachtsfeier", "Nikolaus in Kita und Schule", "Weihnachtsmarkt"],
  },
  {
    slug: "dj",
    cat: "dj",
    plural: "DJs",
    verb: "DJ buchen",
    intro:
      "Ein DJ macht aus einem Raum eine Tanzfläche. Für Hochzeiten und Geburtstage zählt vor allem, dass er das Publikum liest: ruhige Musik zum Essen, dann der richtige Moment für die Tanzfläche. Viele DJs bringen Anlage und Licht mit.",
    tips: [
      "Kläre, ob Technik und Licht im Preis enthalten sind und wie viel Strom gebraucht wird.",
      "Gib eine kurze Liste mit Wünschen und No-Gos mit.",
      "Frag nach der Lautstärke-Regelung der Location und der Sperrstunde.",
    ],
    occasions: ["Hochzeit", "Geburtstag", "Firmenfeier", "Abiball"],
  },
  {
    slug: "band",
    cat: "band",
    plural: "Bands",
    verb: "Band buchen",
    intro:
      "Livemusik verändert die Stimmung einer Feier sofort. Coverbands spielen bekannte Songs zum Mitsingen und Tanzen, Jazz- oder Akustik-Ensembles passen zu Empfang und Dinner.",
    tips: [
      "Frag nach Bühnenfläche, Stromanschluss und Aufbauzeit.",
      "Kläre Pausen und ob in den Pausen Musik vom Band läuft.",
      "Bei Hochzeiten: den Song für den Eröffnungstanz rechtzeitig absprechen.",
    ],
    occasions: ["Hochzeit", "Firmenfeier", "Sommerfest", "Jubiläum"],
  },
  {
    slug: "musiker",
    cat: "musician",
    plural: "Musiker",
    verb: "Musiker buchen",
    intro:
      "Solo-Musiker mit Gesang, Gitarre, Klavier oder Geige begleiten Trauungen, Empfänge und Dinner. Sie brauchen wenig Platz und spielen so, dass man sich nebenbei noch unterhalten kann.",
    tips: [
      "Für die Trauung: Lieder für Einzug, Ringtausch und Auszug vorher festlegen.",
      "Frag, ob ein eigenes Mikrofon und eine kleine Anlage dabei sind.",
      "Bei Feiern im Freien an einen Regenplan denken.",
    ],
    occasions: ["Trauung", "Sektempfang", "Geburtstag", "Trauerfeier"],
  },
  {
    slug: "taenzer",
    cat: "dancer",
    plural: "Tänzer",
    verb: "Tänzer buchen",
    intro:
      "Tanz-Acts reichen von Showeinlagen zwischen zwei Gängen bis zu Mitmach-Workshops für Gäste. Bauchtanz, Hip-Hop, Feuer- oder Salsa-Show: Was jemand anbietet, steht im Profil.",
    tips: [
      "Kläre die Bühnengröße und den Boden: Manche Shows brauchen glatten, rutschfesten Untergrund.",
      "Frag nach Umkleidemöglichkeit vor Ort.",
      "Bei Feuershows vorher die Erlaubnis der Location einholen.",
    ],
    occasions: ["Hochzeit", "Firmenfeier", "Gala", "Geburtstag"],
  },
  {
    slug: "comedian",
    cat: "comedy",
    plural: "Comedians",
    verb: "Comedian buchen",
    intro:
      "Ein Comedian lockert Firmenfeiern, Galas und runde Geburtstage auf. Viele schreiben auf Wunsch ein paar Minuten über die Firma oder das Geburtstagskind, wenn sie vorher ein paar Infos bekommen.",
    tips: [
      "Sag, welche Themen tabu sind.",
      "Ein Mikrofon und ruhiges Publikum sind wichtiger als eine große Bühne.",
      "Die Show am besten nach dem Essen einplanen, nicht währenddessen.",
    ],
    occasions: ["Firmenfeier", "Gala", "Geburtstag", "Vereinsfeier"],
  },
  {
    slug: "akrobat",
    cat: "acrobat",
    plural: "Akrobaten",
    verb: "Akrobaten buchen",
    intro:
      "Akrobatik, Jonglage und Luftartistik sorgen für Staunen bei Galas, Eröffnungen und Stadtfesten. Die Acts reichen von kurzen Showeinlagen bis zu ganzen Programmen.",
    tips: [
      "Kläre Deckenhöhe und Aufhängepunkte bei Luftartistik.",
      "Frag nach Aufwärm- und Aufbauzeit vor dem Auftritt.",
      "Für draußen: Wind und Untergrund vorher besprechen.",
    ],
    occasions: ["Gala", "Eröffnung", "Stadtfest", "Firmenfeier"],
  },
  {
    slug: "walking-act",
    cat: "walkingact",
    plural: "Walking Acts",
    verb: "Walking Act buchen",
    intro:
      "Walking Acts sind mobile Künstler, die sich unter die Gäste mischen: Stelzenläufer, lebende Statuen oder Figuren im Kostüm. Sie brauchen keine Bühne und sind ideal für Empfänge, Messen und Märkte.",
    tips: [
      "Plane Pausen ein, vor allem bei Stelzen und schweren Kostümen.",
      "Kläre, ob der Act Flyer oder Proben verteilen soll.",
      "Ein ruhiger Raum zum Umziehen gehört dazu.",
    ],
    occasions: ["Messe", "Eröffnung", "Stadtfest", "Hochzeit"],
  },
  {
    slug: "pantomime",
    cat: "pantomime",
    plural: "Pantomimen",
    verb: "Pantomime buchen",
    intro:
      "Pantomime funktioniert ohne Worte und damit für jedes Publikum, auch wenn Gäste verschiedene Sprachen sprechen. Oft als Walking Act oder kurze Bühnennummer.",
    tips: [
      "Ideal für internationale Gäste.",
      "Frag nach Programmen für Kinder und für Erwachsene.",
      "Auch als Begrüßung am Eingang gut einsetzbar.",
    ],
    occasions: ["Empfang", "Messe", "Kinderfest", "Gala"],
  },
  {
    slug: "strassenkuenstler",
    cat: "street",
    plural: "Straßenkünstler",
    verb: "Straßenkünstler buchen",
    intro:
      "Straßenkünstler bringen Kleinkunst nah an die Leute: Jonglage, Seifenblasen, Feuer oder Musik mitten im Geschehen. Sie sind es gewohnt, Laufpublikum anzuziehen.",
    tips: [
      "Kläre die Fläche und ob der Auftritt draußen stattfinden darf.",
      "Frag nach einem Plan bei schlechtem Wetter.",
      "Für Märkte mehrere kurze Auftritte statt eines langen buchen.",
    ],
    occasions: ["Stadtfest", "Markt", "Sommerfest", "Eröffnung"],
  },
  {
    slug: "mentalist",
    cat: "mentalist",
    plural: "Mentalisten",
    verb: "Mentalisten buchen",
    intro:
      "Mentalisten scheinen Gedanken zu lesen und Entscheidungen vorherzusagen. Ihre Shows leben von der Interaktion mit dem Publikum und passen gut zu Firmenevents und Abendveranstaltungen.",
    tips: [
      "Am besten für Erwachsene und Jugendliche geeignet.",
      "Ein Mikrofon und gute Sicht für alle sind wichtig.",
      "Auch als Close-up zwischen den Tischen möglich.",
    ],
    occasions: ["Firmenfeier", "Gala", "Geburtstag", "Messe"],
  },
  {
    slug: "hypnotiseur",
    cat: "hypnotist",
    plural: "Hypnotiseure",
    verb: "Hypnotiseur buchen",
    intro:
      "Showhypnose ist Unterhaltung mit freiwilligen Gästen auf der Bühne. Seriöse Hypnotiseure achten darauf, dass niemand bloßgestellt wird, und erklären vorher, wie die Show abläuft.",
    tips: [
      "Nur für Erwachsene planen.",
      "Frag nach dem Ablauf und wie Freiwillige ausgewählt werden.",
      "Eine Bühne mit Stühlen für die Teilnehmer wird gebraucht.",
    ],
    occasions: ["Firmenfeier", "Gala", "Geburtstag", "Abiball"],
  },
  {
    slug: "moderator",
    cat: "host",
    plural: "Moderatoren",
    verb: "Moderator buchen",
    intro:
      "Moderatoren führen durch Galas, Hochzeiten, Firmenfeiern und Preisverleihungen. Sie halten den Zeitplan, kündigen Programmpunkte an und überbrücken Pausen.",
    tips: [
      "Schick vorher einen Ablaufplan mit Namen und Aussprache.",
      "Kläre, ob Mikrofon und Technik vor Ort vorhanden sind.",
      "Ein kurzes Vorgespräch vor dem Termin lohnt sich.",
    ],
    occasions: ["Gala", "Hochzeit", "Firmenfeier", "Preisverleihung"],
  },
  {
    slug: "fotograf",
    cat: "photographer",
    plural: "Fotografen",
    verb: "Fotografen buchen",
    intro:
      "Ein Eventfotograf hält Momente fest, die man selbst verpasst: Reden, Umarmungen, die volle Tanzfläche. Im Profil siehst du Beispielbilder und was im Preis enthalten ist.",
    tips: [
      "Kläre Anzahl und Lieferzeit der bearbeiteten Bilder.",
      "Frag nach den Nutzungsrechten, wenn die Fotos öffentlich genutzt werden sollen.",
      "Gib eine Liste der wichtigsten Personen und Gruppenfotos mit.",
    ],
    occasions: ["Hochzeit", "Firmenfeier", "Geburtstag", "Taufe"],
  },
  {
    slug: "eventplaner",
    cat: "eventplanner",
    plural: "Eventplaner",
    verb: "Eventplaner buchen",
    intro:
      "Eventplaner nehmen dir die Organisation ab: Location, Ablauf, Dienstleister und Koordination am Tag selbst. Auf Showly bieten sie feste Pakete an, deren Leistungen im Profil aufgelistet sind.",
    tips: [
      "Vergleiche die Pakete: Was ist enthalten, was kostet extra?",
      "Kläre, ob die Planerin am Tag selbst vor Ort ist.",
      "Früh anfragen: Gute Planer sind oft Monate im Voraus ausgebucht.",
    ],
    occasions: ["Firmenfeier", "Geburtstag", "Jubiläum", "Sommerfest"],
  },
  {
    slug: "hochzeitsplaner",
    cat: "weddingplanner",
    plural: "Hochzeitsplaner",
    verb: "Hochzeitsplaner buchen",
    intro:
      "Hochzeitsplaner begleiten von der Location-Suche bis zum letzten Tanz. Je nach Paket übernehmen sie die ganze Planung oder nur die Koordination am Hochzeitstag.",
    tips: [
      "Sag früh, wie hoch das Budget insgesamt ist.",
      "Frag nach Erfahrungen mit freien Trauungen, wenn ihr eine plant.",
      "Kläre, wer am Tag Ansprechpartner für Dienstleister ist.",
    ],
    occasions: ["Hochzeit", "Standesamt", "Freie Trauung", "Polterabend"],
  },
  {
    slug: "motivtorte",
    cat: "cake",
    plural: "Konditoreien",
    verb: "Motivtorte bestellen",
    intro:
      "Eine Motivtorte macht das Thema der Feier essbar: Einhorn, Fußball, Superheld oder Hochzeitstorte in mehreren Etagen. Konditoreien und angemeldete Hobbybäcker zeigen auf Showly Fotos, Allergene und Vorlaufzeit; abgeholt oder geliefert wird am Wunschtag.",
    tips: [
      "Früh bestellen: Die Vorlaufzeit steht im Profil, oft eine bis drei Wochen.",
      "Gib Anzahl der Gäste, Allergien und das Motiv mit einem Beispielbild an.",
      "Kläre Kühlung und Transport, vor allem bei Sahne und im Sommer.",
    ],
    occasions: ["Kindergeburtstag", "Hochzeit", "Taufe", "Firmenjubiläum"],
  },
];

export const serviceBySlug = (s: string) => SERVICES.find((x) => x.slug === s) ?? null;

export function landingPath(service: string, city: string): string {
  return `/buchen/${service}/${city}`;
}
