/* Ratgeber-Artikel (/ratgeber/<slug>). Eigene Texte mit praktischen Tipps,
 * ohne erfundene Zahlen oder Umfragen. Verweise führen auf passende
 * Stadtseiten und Bereiche der App. Neue Artikel einfach unten anhängen;
 * Sitemap und Übersicht nehmen sie automatisch auf. */

export interface GuideSection {
  h: string;
  p?: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Datum der letzten inhaltlichen Änderung (YYYY-MM-DD) */
  updated: string;
  lead: string;
  sections: GuideSection[];
  links: { to: string; label: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "ideen-kindergeburtstag",
    title: "Ideen für den Kindergeburtstag: Programm nach Alter",
    description:
      "Was Kinder in welchem Alter begeistert, wie lange ein Programm dauern sollte und wie ein entspannter Ablauf für den Kindergeburtstag aussieht.",
    updated: "2026-10-09",
    lead: "Der beste Kindergeburtstag passt zum Alter: Kleine Kinder brauchen kurze, ruhige Programmpunkte, Schulkinder wollen mitmachen, Ältere lieber etwas erleben. Hier sind Ideen, sortiert nach Alter, und ein Ablauf, der auch für die Eltern entspannt bleibt.",
    sections: [
      {
        h: "3 bis 5 Jahre: kurz und vertraut",
        p: [
          "In diesem Alter ist die Aufmerksamkeit kurz und fremde Erwachsene können verunsichern. Gut funktionieren Märchenfiguren, die singen und Geschichten erzählen, Kinderschminken und Seifenblasen. Plane einzelne Programmpunkte eher mit 30 bis 45 Minuten und halte einen ruhigen Rückzugsort bereit.",
        ],
        list: [
          "Märchenfigur oder Prinzessin mit Liedern und kleiner Krönung",
          "Kinderschminken mit einfachen Motiven",
          "Mitmach-Zauberei mit viel Humor statt großer Bühnenshow",
        ],
      },
      {
        h: "6 bis 9 Jahre: mitmachen und gewinnen",
        p: [
          "Jetzt wollen Kinder selbst aktiv sein. Superhelden-Training, Schatzsuche, eine Zaubershow mit Assistenten aus dem Publikum oder Ballonfiguren kommen gut an. Ein Programm von 60 bis 90 Minuten mit Pausen für Kuchen und Spiele passt meist gut.",
        ],
        list: [
          "Superheld mit Heldentraining und Urkunde",
          "Zauberer, der Kinder auf die Bühne holt",
          "Clown mit Ballonfiguren zum Mitnehmen",
        ],
      },
      {
        h: "10 bis 13 Jahre: erleben statt zuschauen",
        p: [
          "Ältere Kinder finden klassische Kinderprogramme schnell zu kindlich. Besser passen ein DJ für eine kleine Party, ein Workshop (Tanz, Jonglage, Zaubertricks lernen) oder ein Mentalist, der die Gruppe verblüfft.",
        ],
      },
      {
        h: "Ein Ablauf, der funktioniert",
        list: [
          "Ankommen und freies Spielen (etwa 20 Minuten), damit alle da sind, bevor das Programm beginnt.",
          "Programmpunkt mit Künstler, solange die Kinder noch frisch sind.",
          "Kuchen und Getränke als Pause.",
          "Freies Spielen oder ein zweiter, ruhiger Programmpunkt.",
          "Abholen mit Mitgebsel, zum Beispiel einem Foto mit der Figur oder dem Ballon.",
        ],
      },
      {
        h: "Tipps für die Buchung",
        list: [
          "Buche früh, wenn der Geburtstag auf ein Wochenende fällt. Samstage sind am gefragtesten.",
          "Sag bei der Buchung Alter und Anzahl der Kinder, damit der Künstler das Programm anpasst.",
          "Kläre den Platz: Wohnzimmer, Garten oder gemieteter Raum, und was bei Regen passiert.",
          "Frag nach Allergien, bevor jemand Süßigkeiten oder Schminke mitbringt.",
        ],
      },
    ],
    links: [
      { to: "/buchen/superheld/berlin", label: "Superheld buchen in Berlin" },
      { to: "/buchen/zauberer/hamburg", label: "Zauberer buchen in Hamburg" },
      { to: "/buchen/motivtorte/muenchen", label: "Motivtorte bestellen in München" },
      { to: "/buchen", label: "Alle Städte und Leistungen" },
    ],
  },
  {
    slug: "kuenstler-buchen-checkliste",
    title: "Künstler buchen: Checkliste für deine Feier",
    description:
      "Woran du einen guten Künstler erkennst, was du vor der Buchung klären solltest und welche Fragen Ärger am Tag selbst vermeiden.",
    updated: "2026-10-09",
    lead: "Ob Zauberer zum Geburtstag oder Band zur Hochzeit: Die meisten Probleme entstehen nicht am Tag selbst, sondern weil vorher etwas nicht abgesprochen war. Mit dieser Checkliste klärst du alles Wichtige vor der Buchung.",
    sections: [
      {
        h: "Vor der Suche",
        list: [
          "Datum, Uhrzeit und Dauer festlegen, mit etwas Puffer.",
          "Anzahl und Alter der Gäste kennen.",
          "Ort und Platz klären: drinnen oder draußen, Bühne oder nicht, Stromanschluss.",
          "Budget festlegen, inklusive möglicher Anfahrt.",
        ],
      },
      {
        h: "Beim Vergleichen der Profile",
        list: [
          "Fotos und Videos ansehen: Passt der Stil zu deiner Feier?",
          "Bewertungen lesen, vor allem zu ähnlichen Anlässen.",
          "Auf die Stornoregeln achten: flexibel, moderat oder streng.",
          "Prüfen, ob der Künstler in deine Stadt kommt (Umkreis im Profil).",
        ],
      },
      {
        h: "Was du vor der Buchung klären solltest",
        list: [
          "Was genau im Preis enthalten ist: Technik, Material, Anfahrt.",
          "Wie viel Zeit für Aufbau und Abbau gebraucht wird.",
          "Ob Fotos und Videos vom Auftritt gemacht werden dürfen.",
          "Wer am Tag Ansprechpartner vor Ort ist.",
        ],
      },
      {
        h: "Am Tag selbst",
        p: [
          "Halte den Platz frei und sorg dafür, dass der Künstler parken und ausladen kann. Auf Showly bekommst du einen Check-in-Code, den du dem Künstler beim Ankommen gibst. Damit ist festgehalten, dass der Auftritt stattgefunden hat.",
        ],
      },
      {
        h: "Wenn etwas schiefgeht",
        p: [
          "Sagt ein Künstler ab oder kommt nicht, bekommst du bei Showly dein Geld zurück, Ersatzvorschläge und einen Gutschein. Probleme mit dem Auftritt kannst du bis 48 Stunden danach in deinem Konto melden.",
        ],
      },
    ],
    links: [
      { to: "/wie-funktioniert-showly", label: "So funktioniert Showly" },
      { to: "/buchen/dj/koeln", label: "DJ buchen in Köln" },
      { to: "/buchen/band/frankfurt-am-main", label: "Band buchen in Frankfurt am Main" },
      { to: "/hilfe", label: "Hilfe und häufige Fragen" },
    ],
  },
  {
    slug: "motivtorte-bestellen",
    title: "Motivtorte bestellen: Vorlauf, Größe, Allergene, Transport",
    description:
      "Wie früh du eine Motivtorte bestellen solltest, wie du die Größe abschätzt, worauf du bei Allergenen achtest und wie die Torte heil ankommt.",
    updated: "2026-10-09",
    lead: "Eine Motivtorte ist Handarbeit. Damit sie rechtzeitig fertig wird und zum Fest passt, braucht die Konditorei ein paar Angaben und etwas Vorlauf. Hier steht, worauf es ankommt.",
    sections: [
      {
        h: "Wie früh bestellen?",
        p: [
          "Jede Konditorei gibt im Profil ihre Vorlaufzeit an, oft liegt sie zwischen einer und drei Wochen. Für Hochzeitstorten und Termine im Dezember lieber früher anfragen. Je aufwendiger das Motiv, desto mehr Zeit braucht es.",
        ],
      },
      {
        h: "Wie groß muss die Torte sein?",
        p: [
          "Zähle die Gäste, die wirklich Torte essen, und sag der Konditorei, ob es noch anderen Kuchen oder ein Dessert gibt. Die Konditorei kennt ihre Größen und sagt dir, welche Torte für wie viele Stücke reicht. Bei Etagentorten zählt jede Etage mit.",
        ],
      },
      {
        h: "Was die Konditorei wissen muss",
        list: [
          "Datum und Uhrzeit, Abholung oder Lieferung.",
          "Anzahl der Gäste.",
          "Motiv mit Beispielbild, Farben und Schriftzug (Namen richtig geschrieben).",
          "Allergien und Unverträglichkeiten, zum Beispiel Nüsse, Gluten oder Laktose.",
          "Ob die Torte alkoholfrei sein muss, etwa für Kinder.",
        ],
      },
      {
        h: "Allergene und Zutaten",
        p: [
          "Auf Showly stehen bei jedem Angebot die Allergene, die Zutaten und die Haltbarkeit. Frag trotzdem nach, wenn jemand stark allergisch ist: In einer Backstube können Spuren anderer Zutaten nie ganz ausgeschlossen werden.",
        ],
      },
      {
        h: "Transport und Lagerung",
        list: [
          "Die Torte flach im Auto transportieren, nicht auf dem Sitz, sondern im Fußraum oder Kofferraum auf rutschfester Unterlage.",
          "Sahne- und Cremetorten kühl lagern und erst kurz vor dem Anschneiden herausholen.",
          "Im Sommer: kurze Wege, Klimaanlage an, nicht in der Sonne stehen lassen.",
        ],
      },
    ],
    links: [
      { to: "/torten", label: "Torten & Süßes ansehen" },
      { to: "/buchen/motivtorte/berlin", label: "Motivtorte bestellen in Berlin" },
      { to: "/buchen/motivtorte/stuttgart", label: "Motivtorte bestellen in Stuttgart" },
      { to: "/torten/anbieten", label: "Selbst Torten anbieten" },
    ],
  },
  {
    slug: "unterhaltung-hochzeit",
    title: "Unterhaltung für die Hochzeit: was wann passt",
    description:
      "Musik zur Trauung, Zauberer zum Sektempfang, DJ oder Band am Abend: welche Unterhaltung zu welchem Teil der Hochzeit passt und was du klären solltest.",
    updated: "2026-10-09",
    lead: "Eine Hochzeit hat mehrere Teile mit ganz verschiedener Stimmung. Gute Unterhaltung passt sich daran an: leise bei der Trauung, locker beim Empfang, laut am Abend.",
    sections: [
      {
        h: "Trauung",
        p: [
          "Live-Musik mit Gesang, Gitarre, Klavier oder Geige macht die Trauung persönlich. Lege vorher die Lieder für Einzug, Ringtausch und Auszug fest und kläre, ob in der Kirche oder am Trauort verstärkt werden darf.",
        ],
      },
      {
        h: "Sektempfang und Fotos",
        p: [
          "Während das Brautpaar Fotos macht, warten die Gäste. Ein Close-up-Zauberer, ein Walking Act oder ein Karikaturist überbrückt diese Zeit, ohne dass jemand still sitzen muss. Auch Kinder sind so beschäftigt.",
        ],
      },
      {
        h: "Dinner",
        p: [
          "Beim Essen darf Musik nur begleiten. Ein Akustik-Duo oder Hintergrundmusik vom DJ passt besser als eine laute Band. Kurze Showeinlagen zwischen den Gängen halten die Stimmung, ohne die Gespräche zu stören.",
        ],
      },
      {
        h: "Party",
        p: [
          "Am Abend entscheidet sich, ob DJ oder Band. Eine Band bringt Livegefühl, ein DJ ist flexibler bei Wünschen. Viele Paare kombinieren: Band bis Mitternacht, danach DJ.",
        ],
      },
      {
        h: "Was du klären solltest",
        list: [
          "Lautstärkeregeln und Sperrstunde der Location.",
          "Strom, Bühnenfläche, Aufbauzeiten und wo die Künstler sich umziehen können.",
          "Essen und Getränke für die Künstler bei langen Einsätzen.",
          "Einen Ansprechpartner am Tag, der nicht das Brautpaar ist.",
        ],
      },
    ],
    links: [
      { to: "/buchen/hochzeitsplaner/muenchen", label: "Hochzeitsplaner buchen in München" },
      { to: "/buchen/musiker/duesseldorf", label: "Musiker buchen in Düsseldorf" },
      { to: "/buchen/zauberer/berlin", label: "Zauberer buchen in Berlin" },
      { to: "/buchen/dj/hamburg", label: "DJ buchen in Hamburg" },
    ],
  },
];

export const guideBySlug = (s: string) => GUIDES.find((g) => g.slug === s) ?? null;
