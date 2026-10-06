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
      return notify(b.customer, "Absage für deinen Termin", [
        `Der Termin am ${when} wurde von der anbietenden Person abgesagt. Du bekommst den gezahlten Betrag vollständig zurück.`,
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
      : `Es gibt eine neue Anfrage für den ${dateDe(day)}. Bitte antworte in der App mit einem Angebot oder einer Absage.`,
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
