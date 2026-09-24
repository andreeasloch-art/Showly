import { createServerFn } from "@tanstack/react-start";

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
    try {
      const html = `<h2>${data.subject}</h2><ul>${data.lines
        .map((l) => `<li>${l}</li>`)
        .join("")}</ul><p><strong>Total: ${data.total}</strong></p>`;
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
