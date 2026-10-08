/* Anmeldung per SMS-Code im Browser.
 *
 * Erst der eigene, abgesicherte Weg über den Showly-Server (Twilio Verify mit
 * Kostenbremse, lib/sms.server.ts). Ist dort kein SMS-Dienst eingerichtet,
 * der eingebaute Weg der Datenbank (Supabase Phone), falls dort einer
 * hinterlegt ist. */
import { supabase } from "@/lib/supabase";
import { captchaOptions } from "./captcha";

export type SmsVia = "server" | "db";

const MSG = {
  de: {
    invalid: "Bitte eine gültige Handynummer eingeben, etwa 0151 23456789 oder +49 151 23456789.",
    landline: "An diese Nummer können wir keine SMS schicken. Bitte eine Handynummer nehmen.",
    country:
      "In dieses Land verschicken wir noch keine SMS. Melde dich bitte mit deiner E-Mail-Adresse, Google oder Apple an.",
    limit: "Zu viele Codes in kurzer Zeit. Bitte warte etwas oder melde dich per E-Mail an.",
    budget: "SMS-Anmeldung ist gerade ausgelastet. Bitte melde dich per E-Mail, Google oder Apple an.",
    off: "SMS-Anmeldung ist noch nicht eingerichtet. Bitte nimm deine E-Mail-Adresse.",
    failed: "Die SMS konnte nicht verschickt werden. Versuch es später noch einmal oder nimm deine E-Mail-Adresse.",
    wrong: "Der Code stimmt nicht oder ist abgelaufen.",
  },
  en: {
    invalid: "Please enter a valid mobile number, e.g. +49 151 23456789.",
    landline: "We can't send a text message to this number. Please use a mobile number.",
    country: "We don't send text messages to this country yet. Please sign in with email, Google or Apple.",
    limit: "Too many codes in a short time. Please wait a little or sign in by email.",
    budget: "Text message sign-in is busy right now. Please sign in by email, Google or Apple.",
    off: "Text message sign-in isn't set up yet. Please use your email address.",
    failed: "The text message could not be sent. Try again later or use your email address.",
    wrong: "The code is wrong or has expired.",
  },
  es: {
    invalid: "Introduce un móvil válido, p. ej. 600 123 456 o +34 600 123 456.",
    landline: "No podemos enviar SMS a este número. Usa un número de móvil.",
    country: "Aún no enviamos SMS a este país. Inicia sesión con tu correo, Google o Apple.",
    limit: "Demasiados códigos en poco tiempo. Espera un poco o inicia sesión con tu correo.",
    budget: "El acceso por SMS está saturado ahora mismo. Inicia sesión con tu correo, Google o Apple.",
    off: "El acceso por SMS aún no está configurado. Usa tu correo electrónico.",
    failed: "No se pudo enviar el SMS. Inténtalo más tarde o usa tu correo.",
    wrong: "El código no es correcto o ha caducado.",
  },
} as const;

export type SmsMsgKey = keyof (typeof MSG)["de"];

export function smsMessage(key: SmsMsgKey, lang: string): string {
  const t = MSG[(lang as "de" | "en" | "es") in MSG ? (lang as "de" | "en" | "es") : "de"];
  return t[key] ?? t.failed;
}

/** Code anfordern. Gibt den Weg zurück, über den später geprüft wird. */
export async function requestSmsCode(
  phone: string,
  lang: string,
): Promise<{ via: SmsVia; phone: string } | { error: SmsMsgKey }> {
  try {
    const { sendSmsCode } = await import("@/utils/sms.functions");
    const { captchaToken } = await import("./captcha");
    const captcha = await captchaToken(lang).catch(() => undefined);
    const r = await sendSmsCode({ data: { phone, lang, ...(captcha ? { captcha } : {}) } });
    if ("ok" in r) return { via: "server", phone: r.phone };
    if (r.error !== "off") return { error: r.error };
  } catch {
    /* Server nicht erreichbar: eingebauten Weg versuchen */
  }
  const { error } = await supabase().auth.signInWithOtp({ phone, options: { shouldCreateUser: true, ...(await captchaOptions()) } });
  return error ? { error: "off" } : { via: "db", phone };
}

/** Code prüfen und anmelden */
export async function confirmSmsCode(via: SmsVia, phone: string, code: string): Promise<{ ok: true } | { error: SmsMsgKey }> {
  const token = code.replace(/\D/g, "");
  if (via === "server") {
    const { checkSmsCode } = await import("@/utils/sms.functions");
    const r = await checkSmsCode({ data: { phone, code: token } }).catch(() => ({ error: "failed" as const }));
    if ("error" in r) return { error: r.error };
    const { error } = await supabase().auth.setSession(r);
    return error ? { error: "failed" } : { ok: true };
  }
  const { error } = await supabase().auth.verifyOtp({ phone, token, type: "sms" });
  return error ? { error: "wrong" } : { ok: true };
}
