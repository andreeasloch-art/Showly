/* Suchbegriffe je Kategorie.
 *
 * Wer "Magier" tippt, meint Zauberer; wer "Sänger" tippt, meint Musiker.
 * Die Liste ordnet solche Wörter (Deutsch, Englisch, Spanisch) den
 * Kategorien zu. Der Name der Kategorie in der gewählten Sprache zählt
 * immer mit, er muss hier nicht stehen. */
export const CAT_TERMS: Record<string, string[]> = {
  fairy: [
    "märchen",
    "märchenfigur",
    "prinzessin",
    "eiskönigin",
    "schneekönigin",
    "fee",
    "meerjungfrau",
    "fairy",
    "princess",
    "princesa",
    "cuento",
  ],
  magician: [
    "zauberer",
    "zauberin",
    "zauberkünstler",
    "zaubershow",
    "zaubern",
    "zauberei",
    "magier",
    "magierin",
    "magie",
    "magic",
    "magician",
    "illusionist",
    "trickkünstler",
    "kartentricks",
    "mago",
    "maga",
    "magia",
  ],
  mentalist: [
    "mentalist",
    "mentalistin",
    "gedankenleser",
    "gedankenlesen",
    "mind reader",
    "mentalista",
  ],
  hypnotist: [
    "hypnose",
    "hypnotiseur",
    "hypnotiseurin",
    "hypnotist",
    "hypnosis",
    "hipnotizador",
    "hipnosis",
  ],
  santa: [
    "weihnachtsmann",
    "nikolaus",
    "christkind",
    "weihnachten",
    "santa",
    "christmas",
    "papá noel",
    "papa noel",
    "navidad",
  ],
  dj: ["dj", "deejay", "discjockey", "disc jockey", "auflegen"],
  musician: [
    "musiker",
    "musikerin",
    "sänger",
    "sängerin",
    "gesang",
    "singen",
    "live musik",
    "livemusik",
    "musik",
    "gitarrist",
    "pianist",
    "geiger",
    "saxophonist",
    "duo",
    "singer",
    "music",
    "musician",
    "músico",
    "musica",
    "música",
    "cantante",
  ],
  band: [
    "band",
    "liveband",
    "coverband",
    "musikgruppe",
    "live musik",
    "livemusik",
    "musik",
    "music",
    "grupo",
    "banda",
  ],
  dancer: [
    "tänzer",
    "tänzerin",
    "tanz",
    "tanzen",
    "tanzshow",
    "bauchtanz",
    "dancer",
    "dance",
    "bailarín",
    "bailarina",
    "baile",
  ],
  clown: ["clown", "clownin", "kinderclown", "payaso"],
  acrobat: [
    "akrobat",
    "akrobatin",
    "akrobatik",
    "jongleur",
    "jonglage",
    "feuershow",
    "luftakrobatik",
    "acrobat",
    "acrobatics",
    "acróbata",
  ],
  comedy: [
    "comedy",
    "comedian",
    "komiker",
    "komikerin",
    "kabarett",
    "stand-up",
    "standup",
    "humor",
    "comedia",
    "humorista",
  ],
  walkingact: [
    "walking act",
    "walkingact",
    "walkact",
    "stelzen",
    "stelzenläufer",
    "stelzenlauf",
  ],
  pantomime: ["pantomime", "pantomimin", "mime", "mimo"],
  street: [
    "straßenkunst",
    "straßenkünstler",
    "strassenkunst",
    "street art",
    "streetart",
    "graffiti",
    "arte urbano",
  ],
  host: [
    "moderator",
    "moderatorin",
    "moderation",
    "host",
    "mc",
    "conferencier",
    "presentador",
    "presentadora",
  ],
  photographer: [
    "fotograf",
    "fotografin",
    "fotografie",
    "fotos",
    "photograph",
    "photographer",
    "photography",
    "fotógrafo",
    "fotógrafa",
  ],
  facepaint: [
    "kinderschminken",
    "kinderschminkerin",
    "kinderschminker",
    "schminken",
    "schminke",
    "gesichtsbemalung",
    "glitzertattoo",
    "glitzer-tattoo",
    "face painting",
    "facepainting",
    "face painter",
    "face paint",
    "pintacaras",
    "maquillaje infantil",
  ],
  superhero: [
    "superheld",
    "superheldin",
    "superhelden",
    "spiderman",
    "batman",
    "superman",
    "superhero",
    "superhéroe",
  ],
  eventplanner: [
    "eventplaner",
    "eventplanerin",
    "eventplanung",
    "eventmanager",
    "partyplaner",
    "event planner",
    "organizador de eventos",
  ],
  weddingplanner: [
    "hochzeitsplaner",
    "hochzeitsplanerin",
    "hochzeitsplanung",
    "hochzeit",
    "wedding planner",
    "wedding",
    "boda",
    "organizador de bodas",
  ],
};

/* Klein, ohne Akzente, ä → ae usw., damit "Saenger" und "Sänger" gleich sind */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Wie gut passt die Eingabe zur Kategorie? 0 = gar nicht, 3 = Wortanfang
 * des Namens, 2 = Wortanfang eines Begriffs, 1 = irgendwo enthalten. */
export function catScore(catId: string, query: string, label: string): number {
  const q = norm(query);
  if (!q) return 0;
  const name = norm(label);
  const terms = (CAT_TERMS[catId] || []).map(norm);
  if (name.startsWith(q)) return 3;
  if (
    terms.some(
      (t) => t.startsWith(q) || t.split(" ").some((w) => w.startsWith(q)),
    )
  )
    return 2;
  if (q.length >= 3 && [name, ...terms].some((t) => t.includes(q))) return 1;
  /* "Zauberer für Kindergeburtstag": ein bekannter Begriff steckt in der Eingabe */
  if ([name, ...terms].some((t) => t.length >= 4 && q.includes(t))) return 1;
  return 0;
}
