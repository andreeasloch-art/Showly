import { createServerFn } from "@tanstack/react-start";
import { TOO_MANY, allow, clientIp } from "@/lib/guard.server";
import { esc } from "@/lib/mail.server";

type MailResult = { sent: boolean; skipped?: boolean; error?: string };

/**
 * Bestätigungsmail nach erfolgreicher Zahlung.
 * Ohne RESEND_API_KEY wird nichts gesendet (kein Fehler für den Nutzer).
 */
export const sendPurchaseConfirmation = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { to: string; subject: string; lines: string[]; total: string }) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.to)) throw new Error("Invalid email");
      if (!data.subject) throw new Error("Missing subject");
      return data;
    },
  )
  .handler(async ({ data }): Promise<MailResult> => {
    const key = process.env["RESEND_API_KEY"];
    const from = process.env["SHOWLY_MAIL_FROM"] || "Showly <onboarding@resend.dev>";
    if (!key) return { sent: false, skipped: true };
    /* Ohne Grenze ließe sich diese Funktion zum Versand beliebiger Mails
       nutzen. Texte werden maskiert, damit kein fremdes HTML hineinkommt. */
    if (!(await allow("support", "mail:" + clientIp()))) return { sent: false, error: TOO_MANY };
    try {
      const html = `<h2>${esc(String(data.subject).slice(0, 200))}</h2><ul>${data.lines
        .slice(0, 30)
        .map((l) => `<li>${esc(String(l).slice(0, 300))}</li>`)
        .join("")}</ul><p><strong>Total: ${esc(String(data.total).slice(0, 40))}</strong></p>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [data.to], subject: data.subject, html }),
      });
      if (!res.ok) {
        console.error("Resend error", res.status);
        return { sent: false, error: "mail_failed" };
      }
      return { sent: true };
    } catch (e) {
      console.error("Mail error", e);
      return { sent: false, error: "mail_failed" };
    }
  });
