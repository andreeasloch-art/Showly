/* E-Mails verschicken, nur auf dem Server (über Resend).
 *
 * Ohne RESEND_API_KEY wird nichts gesendet und nichts bricht ab. Alle Texte
 * werden als Text eingesetzt (HTML-Zeichen maskiert), damit niemand fremdes
 * HTML oder Links in eine Showly-Mail schmuggeln kann. */

export function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendMail(to: string, subject: string, paragraphs: string[]): Promise<boolean> {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["SHOWLY_MAIL_FROM"] || "Showly <onboarding@resend.dev>";
  if (!key || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1530">` +
    `<h2 style="font-size:18px">${esc(subject)}</h2>` +
    paragraphs.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") +
    `<p style="color:#6b6480;font-size:13px">Showly · Diese Nachricht wurde automatisch versendet.</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: subject.slice(0, 200), html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
