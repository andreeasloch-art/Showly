/* Eine Person, ein Profil: Prüfwert aus der Ausweisprüfung, nur auf dem Server.
 *
 * Gespeichert wird ausschließlich ein HMAC-SHA256 über Name und Geburtsdatum
 * (siehe showly/identityKey.ts). Ohne den geheimen Schlüssel lässt sich
 * daraus weder der Name zurückrechnen noch durch Ausprobieren erraten. */
import { createHmac } from "node:crypto";
import { adminClient } from "./supabase.server";
import { identityKeyInput, type IdentityParts } from "@/showly/identityKey";

function secret(): string {
  /* Eigener Schlüssel empfohlen. Ersatzweise der Dienstschlüssel; wer den
     später austauscht, muss IDENTITY_FINGERPRINT_SECRET auf den alten Wert
     setzen, sonst passen die gespeicherten Prüfwerte nicht mehr. */
  const s =
    process.env["IDENTITY_FINGERPRINT_SECRET"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Kein Schlüssel für den Identitätsabgleich");
  return s;
}

export function identityFingerprint(p: IdentityParts): string | null {
  const input = identityKeyInput(p);
  return input
    ? createHmac("sha256", secret()).update(input).digest("hex")
    : null;
}

/** "ok": Person ist neu oder gehört schon zu diesem Konto.
 *  "duplicate": Dieselbe Person hat bereits ein anderes Konto mit Profil,
 *  oder sie wurde gesperrt. */
export async function claimIdentity(
  uid: string,
  hash: string,
): Promise<"ok" | "duplicate"> {
  const db = adminClient();
  const read = () =>
    db
      .from("identity_fingerprints")
      .select("owner, blocked")
      .eq("hash", hash)
      .maybeSingle();

  let { data: row } = await read();
  if (!row) {
    const { error } = await db
      .from("identity_fingerprints")
      .insert({ hash, owner: uid });
    if (!error) return "ok";
    /* Gleichzeitig von einem zweiten Konto eingetragen: neu lesen. Hat dieses
       Konto schon einen anderen Prüfwert, bleibt der erste gültig. */
    ({ data: row } = await read());
    if (!row) return "ok";
  }
  if (row.blocked) return "duplicate";
  if (row.owner && row.owner !== uid) return "duplicate";
  if (!row.owner) {
    /* Früheres Konto dieser Person wurde gelöscht: neu zuordnen */
    await db
      .from("identity_fingerprints")
      .update({ owner: uid })
      .eq("hash", hash)
      .is("owner", null);
    const { data: now } = await read();
    return now?.owner === uid ? "ok" : "duplicate";
  }
  return "ok";
}
