/* Anmeldung per SMS-Code (Server-Funktionen). Regeln und Kostenbremsen in
 * lib/sms.server.ts und showly/smsPolicy.ts. Ist kein SMS-Dienst
 * eingerichtet, antwortet der Server mit "off"; die App nimmt dann den
 * eingebauten Weg der Datenbank (falls dort ein SMS-Dienst hinterlegt ist)
 * oder bietet E-Mail an. */
import { createServerFn } from "@tanstack/react-start";
import type { SmsError } from "@/lib/sms.server";

const phoneIn = (d: { phone?: unknown }) => String(d?.phone ?? "").slice(0, 32);

export const sendSmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; lang?: string; captcha?: string }) => ({
    phone: phoneIn(d),
    lang: d?.lang === "en" || d?.lang === "es" ? d.lang : "de",
    captcha: typeof d?.captcha === "string" ? d.captcha.slice(0, 4096) : undefined,
  }))
  .handler(async ({ data }): Promise<{ ok: true; phone: string } | { error: SmsError }> => {
    /* SMS kosten Geld: gegen Bots zusätzlich Captcha, wenn eingerichtet */
    const { verifyCaptcha } = await import("@/lib/captcha.server");
    if (!(await verifyCaptcha(data.captcha))) return { error: "limit" };
    const { sendCode } = await import("@/lib/sms.server");
    return sendCode(data.phone, data.lang);
  });

export const checkSmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string }) => ({
    phone: phoneIn(d),
    code: String(d?.code ?? "").slice(0, 12),
  }))
  .handler(async ({ data }): Promise<{ access_token: string; refresh_token: string } | { error: SmsError }> => {
    const { checkCode } = await import("@/lib/sms.server");
    return checkCode(data.phone, data.code);
  });
