/* Benachrichtigungen per E-Mail, nur auf dem Server.
 *
 * Damit Künstler, Planer und Anbieter neue Anfragen nicht verpassen, und
 * Kunden wissen, woran sie sind. Inhalt bewusst knapp: keine Kontaktdaten,
 * keine Nachrichtentexte (die stehen in der App), nur was passiert ist und
 * ein Link dorthin.
 *
 * Mit "key" geht dieselbe Benachrichtigung höchstens einmal raus (Tabelle
 * notifications_sent), etwa eine Erinnerung oder bei vielen Nachrichten
 * hintereinander nur eine Mail je halbe Stunde. Personen, die sich nur mit
 * Handynummer angemeldet haben, haben keine E-Mail-Adresse; sie sehen alles
 * in der App (Hinweise im Dashboard). */
import { adminClient } from "./supabase.server";
import { sendMail } from "./mail.server";
import { SITE } from "@/showly/seo";

export async function notify(
  profile: string | null | undefined,
  subject: string,
  lines: string[],
  opts: { key?: string; path?: string } = {},
): Promise<boolean> {
  if (!profile) return false;
  const db = adminClient();
  if (opts.key) {
    /* Zuerst eintragen: wer zweiter ist, scheitert am Primärschlüssel */
    const { error } = await db.from("notifications_sent").insert({ key: opts.key.slice(0, 120) });
    if (error) return false;
  }
  const { data } = await db.from("profiles").select("email").eq("id", profile).maybeSingle();
  /* Konten nur mit Handynummer haben eine Ersatzadresse (sms.server.ts) */
  if (!data?.email || data.email.endsWith("@sms.showly.eu")) return false;
  return sendMail(data.email, subject, [...lines, `Zur App: ${SITE}${opts.path ?? "/dashboard"}`]);
}

const dateDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Eigentümer eines Künstlerprofils */
export async function ownerOfArtist(artistId: number | null | undefined): Promise<string | null> {
  if (!artistId) return null;
  const { data } = await adminClient().from("artists").select("owner").eq("id", artistId).maybeSingle();
  return data?.owner ?? null;
}

/** Neue Buchung oder Anfrage beim Künstler */
export async function notifyNewBooking(b: { id: number; artist_id: number | null; day: string; slot: string | null; status: string }) {
  const owner = await ownerOfArtist(b.artist_id);
  const when = `${dateDe(b.day)}${b.slot ? `, ${b.slot} Uhr` : ""}`;
  if (b.status === "requested")
    return notify(owner, "Neue Buchungsanfrage bei Showly", [
      `Du hast eine neue Anfrage für den ${when}.`,
      "Bitte sag innerhalb von 48 Stunden zu oder ab. Danach verfällt die Anfrage automatisch und der Kunde bekommt sein Geld zurück.",
    ]);
  return notify(owner, "Neue Buchung bei Showly", [`Du wurdest für den ${when} gebucht. Alle Angaben findest du in der App.`]);
}

/** Antwort oder Absage an den Kunden bzw. die andere Seite */
export async function notifyBookingChange(
  kind: "accepted" | "declined" | "cancelledByArtist" | "cancelledByCustomer",
  b: { customer: string | null; artist_id: number | null; day: string },
) {
  const when = dateDe(b.day);
  switch (kind) {
    case "accepted":
      return notify(b.customer, "Deine Buchung ist bestätigt", [`Der Termin am ${when} ist fest zugesagt.`]);
    case "declined":
      return notify(b.customer, "Deine Anfrage wurde abgelehnt", [
        `Für den ${when} hat es leider nicht geklappt. Bereits gezahltes Geld bekommst du vollständig zurück.`,
        "Schau gern nach einem anderen Act für deinen Termin.",
      ]);
    case "cancelledByArtist":
      return notify(b.customer, "Absage für deinen Termin – deine Ersatzgarantie greift", [
        `Der Termin am ${when} wurde von der anbietenden Person abgesagt. Du bekommst den gezahlten Betrag vollständig zurück.`,
        "Showly-Ersatzgarantie: Unser Team schlägt dir innerhalb von 24 Stunden passende Ersatz-Künstler für deinen Termin vor. Kostet der Ersatz mehr, übernehmen wir den Aufpreis bis 20 % per Gutschein. Möchtest du keinen Ersatz, musst du nichts tun.",
      ]);
    case "cancelledByCustomer":
      return notify(await ownerOfArtist(b.artist_id), "Eine Buchung wurde storniert", [
        `Der Kunde hat den Termin am ${when} storniert. Der Termin ist in deinem Kalender wieder frei.`,
      ]);
  }
}

/** Neue Torten- oder Deko-Anfrage beim Anbieter */
export async function notifyNewSweet(owner: string | null, day: string, direct: boolean) {
  return notify(owner, direct ? "Neue Bestellung bei Showly" : "Neue Anfrage bei Showly", [
    direct
      ? `Es gibt eine neue, bezahlte Bestellung für den ${dateDe(day)}.`
      : `Es gibt eine neue Anfrage für den ${dateDe(day)}. Bitte antworte innerhalb von 48 Stunden in der App mit einem Angebot oder einer Absage.`,
  ]);
}

/** Neue Nachricht im Chat: höchstens eine Mail je Verlauf und halbe Stunde */
export async function notifyMessage(recipient: string | null, thread: string) {
  const slot = Math.floor(Date.now() / 1800000);
  return notify(recipient, "Neue Nachricht bei Showly", ["Du hast eine neue Nachricht. Lesen und antworten kannst du in der App."], {
    key: `msg:${thread}:${recipient}:${slot}`,
  });
}

/** Tägliche Erinnerungen: Anfragen, die seit über 24 Stunden warten */
export async function remindOpenRequests(): Promise<number> {
  const db = adminClient();
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data } = await db
    .from("bookings")
    .select("id, artist_id, day")
    .eq("status", "requested")
    .lt("requested_at", since)
    .limit(200);
  let n = 0;
  for (const b of data || []) {
    const ok = await notify(
      await ownerOfArtist(b.artist_id),
      "Erinnerung: Anfrage wartet auf deine Antwort",
      [`Eine Anfrage für den ${dateDe(b.day)} ist noch offen. Ohne Antwort verfällt sie bald automatisch.`],
      { key: `remind:${b.id}` },
    );
    if (ok) n++;
  }
  return n;
}

const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";
const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Bestätigung mit Zahlungsbeleg an den Kunden, einmal je Zahlung */
export async function notifyOrderConfirmation(
  customer: string,
  sessionId: string,
  lines: { label: string; cents: number }[],
  totalCents: number,
) {
  return notify(
    customer,
    "Buchungsbestätigung und Zahlungsbeleg",
    [
      "Danke für deine Buchung bei Showly. Deine Zahlung ist eingegangen.",
      lines.map((l) => `• ${l.label}: ${euro(l.cents)}`).join("\n"),
      `Bezahlt: ${euro(totalCents)} · Zahlungsnummer ${sessionId.slice(-12)}`,
      "Künstler-Anfragen werden erst mit der Zusage verbindlich; bis dahin ist der Betrag nur vorgemerkt bzw. wird bei Absage vollständig erstattet. Kautionen bekommst du nach der Rückgabe zurück.",
      "Rechnungen über die Leistungen stellen die jeweiligen Anbieter aus; du findest alle Angaben und deine Buchungen in der App.",
    ],
    { key: `order:${sessionId}`, path: "/dashboard" },
  );
}

/** Tägliche Mails rund um das Event: Erinnerung 2 Tage vorher, Bewertung am
 *  Tag danach, Rückgabe-Erinnerung am letzten Miettag. Jede Mail nur einmal. */
export async function eventMails(): Promise<{ reminders: number; reviews: number; returns: number }> {
  const db = adminClient();
  let reminders = 0;
  let reviews = 0;
  let returns = 0;
  const soon = isoDay(2);
  const { data: upcoming } = await db
    .from("bookings")
    .select("id, customer, artist_id, day, slot, address")
    .eq("day", soon)
    .eq("status", "confirmed")
    .limit(500);
  for (const b of upcoming || []) {
    const when = `${dateDe(b.day)}${b.slot ? `, ${b.slot} Uhr` : ""}`;
    if (
      await notify(b.customer, "Erinnerung: dein Event in 2 Tagen", [
        `Am ${when} ist es so weit. Bitte sorg dafür, dass der Künstler am Ort gut ankommt (Parkplatz, Klingel, Ansprechperson).`,
        "Fragen kannst du im Chat zur Buchung stellen. Den Check-in-Code zeigst du beim Auftritt vor.",
      ], { key: `ev-remind-c:${b.id}`, path: "/dashboard" })
    )
      reminders++;
    await notify(await ownerOfArtist(b.artist_id), "Erinnerung: Auftritt in 2 Tagen", [
      `Du trittst am ${when} auf${b.address ? ` (${b.address})` : ""}. Plane eine Stunde Fahrtzeit ein und lass dir vor Ort den Check-in-Code zeigen.`,
    ], { key: `ev-remind-a:${b.id}`, path: "/portal" });
  }
  const { data: sweets } = await db
    .from("sweet_requests")
    .select("id, customer, day")
    .eq("day", soon)
    .in("status", ["confirmed", "booked"])
    .limit(500);
  for (const s of sweets || [])
    if (
      await notify(s.customer, "Erinnerung: deine Torte in 2 Tagen", [
        `Deine Bestellung für den ${dateDe(s.day)} ist eingeplant. Abholung oder Lieferung stimmst du bei Bedarf im Chat ab. Bitte gekühlt lagern, wie auf dem Angebot angegeben.`,
      ], { key: `sw-remind:${s.id}` })
    )
      reminders++;

  const yesterday = isoDay(-1);
  const { data: past } = await db
    .from("bookings")
    .select("id, customer, artist_id, day")
    .eq("day", yesterday)
    .in("status", ["confirmed", "completed"])
    .limit(500);
  for (const b of past || [])
    if (
      b.artist_id &&
      (await notify(b.customer, "Wie war dein Event?", [
        "Wir hoffen, es war ein tolles Fest! Hilf anderen bei der Wahl und bewerte den Auftritt mit ein paar Worten.",
        "Bewerten können nur Kunden mit einer echten Buchung über Showly.",
      ], { key: `review:${b.id}`, path: `/kuenstler/${b.artist_id}#bewertungen` }))
    )
      reviews++;

  /* Verleih: am letzten Miettag an die Rückgabe erinnern */
  const today = isoDay(0);
  const { data: rentals } = await db
    .from("shop_orders")
    .select("id, customer, items, status")
    .in("status", ["paid", "shipped"])
    .gte("created_at", new Date(Date.now() - 60 * 86_400_000).toISOString())
    .limit(1000);
  for (const o of rentals || []) {
    const due = (o.items || []).filter((i) => i.mode === "rent" && i.to === today);
    if (!due.length) continue;
    if (
      await notify(o.customer, "Erinnerung: Rückgabe deiner Miete", [
        "Heute ist der letzte Miettag. Bitte gib die Artikel bis spätestens zum nächsten Werktag zurück bzw. schick sie mit dem Rücksendeschein los, sauber und vollständig.",
        "Die Kaution bekommst du zurück, sobald der Anbieter die Rückgabe bestätigt hat. Bei verspäteter Rückgabe fällt je weiterem Tag der Tagesmietpreis an (AGB § 14).",
      ], { key: `return:${o.id}:${today}` })
    )
      returns++;
  }
  return { reminders, reviews, returns };
}
