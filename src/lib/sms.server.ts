/* SMS-Codes zur Anmeldung, nur auf dem Server. Versand über Twilio Verify.
 *
 * Warum Twilio Verify und nicht eine einfache SMS: Verify erzeugt und prüft
 * den Code selbst, verschickt ihn in der Sprache der Person und bringt mit
 * "Fraud Guard" einen eigenen Schutz gegen SMS-Pumping mit. In der Twilio-
 * Konsole außerdem unter Verify → Geo Permissions nur die Länder erlauben,
 * die Showly braucht (siehe EINRICHTUNG.md, Abschnitt 4).
 *
 * Kostenbremsen in Showly selbst (alle schließen im Zweifel, d. h. wenn die
 * Zählung nicht klappt, geht keine SMS raus):
 *   - je Nummer:            3 Codes pro Stunde, 5 pro Tag
 *   - je Internetadresse:   5 Codes pro Stunde, 15 pro Tag
 *   - je Land und Tag:      SMS_COUNTRY_DAILY_LIMIT (Kernländer, Standard 150),
 *                           25 für zusätzlich freigeschaltete Länder
 *   - insgesamt pro Tag:    SMS_DAILY_LIMIT (Standard 300)
 *   - Prüfversuche:         5 pro Nummer und Stunde
 * Bei 300 SMS am Tag und rund 8 Cent sind das höchstens etwa 24 € pro Tag,
 * auch wenn jemand es darauf anlegt. Für mehr Spielraum die Werte in Lovable
 * unter Secrets erhöhen. */
import { createClient } from "@supabase/supabase-js";
import { adminClient } from "./supabase.server";
import { clientIp } from "./guard.server";
import { checkSmsNumber, isCoreCountry, parseCountryList, type SmsRefusal } from "@/showly/smsPolicy";

export type SmsError = SmsRefusal | "off" | "limit" | "budget" | "failed" | "wrong";

const env = (k: string) => process.env[k] || "";
const num = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};

export function smsConfigured(): boolean {
  return !!(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_VERIFY_SERVICE_SID"));
}

async function hash(v: string): Promise<string> {
  const salt = env("RATE_LIMIT_SALT") || "showly-sms";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${v}`));
  return Array.from(new Uint8Array(buf).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

const since = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Anzahl Einträge; bei einem Fehler "unendlich", damit keine SMS rausgeht */
async function count(filter: { kind: "send" | "check"; col?: "phone_hash" | "ip_hash" | "country"; val?: string; ms: number }) {
  let q = adminClient()
    .from("sms_log")
    .select("id", { count: "exact", head: true })
    .eq("kind", filter.kind)
    .gte("created_at", since(filter.ms));
  if (filter.col && filter.val) q = q.eq(filter.col, filter.val);
  const { count: n, error } = await q;
  return error ? Number.POSITIVE_INFINITY : n || 0;
}

async function log(kind: "send" | "check", phoneHash: string, ipHash: string, country: string, ok: boolean) {
  await adminClient().from("sms_log").insert({ kind, phone_hash: phoneHash, ip_hash: ipHash, country, ok });
}

async function twilio(path: string, body: Record<string, string>) {
  const auth = btoa(`${env("TWILIO_ACCOUNT_SID")}:${env("TWILIO_AUTH_TOKEN")}`);
  const res = await fetch(`https://verify.twilio.com/v2/Services/${env("TWILIO_VERIFY_SERVICE_SID")}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string };
  return { ok: res.ok, status: json.status };
}

/** Code verschicken, wenn alle Bremsen es erlauben */
export async function sendCode(raw: string, lang: string): Promise<{ ok: true; phone: string } | { error: SmsError }> {
  if (!smsConfigured()) return { error: "off" };
  const target = checkSmsNumber(raw, parseCountryList(env("SMS_EXTRA_COUNTRIES")));
  if ("refused" in target) return { error: target.refused };

  const ph = await hash(target.e164);
  const ip = await hash(clientIp());
  const core = isCoreCountry(target.country);
  const checks: [number, number][] = [
    [await count({ kind: "send", col: "phone_hash", val: ph, ms: HOUR }), 3],
    [await count({ kind: "send", col: "phone_hash", val: ph, ms: DAY }), 5],
    [await count({ kind: "send", col: "ip_hash", val: ip, ms: HOUR }), 5],
    [await count({ kind: "send", col: "ip_hash", val: ip, ms: DAY }), 15],
  ];
  if (checks.some(([n, max]) => n >= max)) return { error: "limit" };
  const perCountry = core ? num("SMS_COUNTRY_DAILY_LIMIT", 150) : 25;
  if ((await count({ kind: "send", col: "country", val: target.country, ms: DAY })) >= perCountry) return { error: "budget" };
  if ((await count({ kind: "send", ms: DAY })) >= num("SMS_DAILY_LIMIT", 300)) return { error: "budget" };

  /* Erst zählen, dann senden: Auch ein Fehlversuch bei Twilio verbraucht ein Kontingent */
  await log("send", ph, ip, target.country, true);
  const r = await twilio("Verifications", {
    To: target.e164,
    Channel: "sms",
    Locale: lang === "es" ? "es" : lang === "en" ? "en" : "de",
  }).catch(() => ({ ok: false, status: undefined }));
  if (!r.ok) return { error: "failed" };
  return { ok: true, phone: target.e164 };
}

/** Code prüfen; bei Erfolg Konto finden oder anlegen und eine Sitzung ausstellen */
export async function checkCode(
  raw: string,
  code: string,
): Promise<{ access_token: string; refresh_token: string } | { error: SmsError }> {
  if (!smsConfigured()) return { error: "off" };
  const target = checkSmsNumber(raw, parseCountryList(env("SMS_EXTRA_COUNTRIES")));
  if ("refused" in target) return { error: target.refused };
  const token = String(code || "").replace(/\D/g, "");
  if (token.length < 4 || token.length > 10) return { error: "wrong" };

  const ph = await hash(target.e164);
  const ip = await hash(clientIp());
  if ((await count({ kind: "check", col: "phone_hash", val: ph, ms: HOUR })) >= 5) return { error: "limit" };
  const r = await twilio("VerificationCheck", { To: target.e164, Code: token }).catch(() => ({
    ok: false,
    status: undefined,
  }));
  const approved = r.ok && r.status === "approved";
  await log("check", ph, ip, target.country, approved);
  if (!approved) return { error: "wrong" };

  const session = await sessionForPhone(target.e164);
  return session ?? { error: "failed" };
}

/* Konten, die sich nur per Handynummer anmelden, bekommen intern eine
   Ersatzadresse unter dieser Domain. An sie geht nie eine Mail
   (notify.server.ts filtert sie heraus). Eine Nummer = ein Konto. */
export const PHONE_MAIL_DOMAIN = "sms.showly.eu";
const phoneMail = (e164: string) => `p${e164.replace(/\D/g, "")}@${PHONE_MAIL_DOMAIN}`;

function randomPassword(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

async function sessionForPhone(e164: string) {
  const admin = adminClient();
  const email = phoneMail(e164);

  /* Vorhandenes Konto zu dieser Nummer? */
  const { data: prof } = await admin.from("profiles").select("id, email").eq("phone", e164).maybeSingle();
  let uid = prof?.id ?? null;
  if (!uid) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { phone: e164 },
    });
    if (error || !created.user) {
      /* Schon da (etwa gleichzeitig angelegt): über die Ersatzadresse finden */
      const { data: byMail } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      uid = byMail?.id ?? null;
    } else uid = created.user.id;
    if (!uid) return null;
    await admin.from("profiles").update({ phone: e164 }).eq("id", uid);
  }

  /* Einmal-Passwort setzen, damit anmelden, sofort wieder ändern: So
     entsteht eine normale Sitzung, ohne dass ein Passwort übrig bleibt */
  const { data: user } = await admin.auth.admin.getUserById(uid);
  const loginMail = user.user?.email || email;
  const once = randomPassword();
  const upd = await admin.auth.admin.updateUserById(uid, {
    password: once,
    ...(user.user?.email ? {} : { email, email_confirm: true }),
  });
  if (upd.error) return null;
  const anon = createClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signed } = await anon.auth.signInWithPassword({ email: loginMail, password: once });
  await admin.auth.admin.updateUserById(uid, { password: randomPassword() });
  if (!signed.session) return null;
  return { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token };
}
