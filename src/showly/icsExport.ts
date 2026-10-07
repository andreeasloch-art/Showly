/* Eigener Kalender-Link für Künstler (iCal-Feed).
 *
 * Künstler können ihre Showly-Auftritte in Google Kalender, Apple Kalender
 * oder Outlook abonnieren. Der Link enthält einen geheimen Schlüssel; der
 * Feed enthält bewusst wenig (Uhrzeit, Hinweis "Showly-Auftritt", Ort ohne
 * Kundennamen), falls der Link doch einmal weitergegeben wird. */

export interface ExportEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  url?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Text für iCal maskieren (RFC 5545, 3.3.11) */
export function icsEscape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen über 75 Byte falten (RFC 5545, 3.1) */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (curLen + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(name: string, events: ExportEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Showly//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsEscape(e.uid)}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "TRANSP:OPAQUE",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
