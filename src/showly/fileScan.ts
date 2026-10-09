/* Schadsoftware-Prüfung für hochgeladene Dateien, ohne Netzwerk (rein,
 * getestet in fileScan.test.ts). Läuft immer, auch ohne Virenscanner.
 *
 *  - PDF: Abgelehnt wird, was in einem Dokument nichts zu suchen hat und mit
 *    dem Schadsoftware verbreitet wird: eingebettetes JavaScript, Aktionen
 *    beim Öffnen, Programmstart, eingebettete Dateien, Flash/Multimedia,
 *    XFA-Formulare, Verschlüsselung (Inhalt nicht prüfbar). Namen in PDFs
 *    lassen sich mit #xx tarnen (/J#61vaScript); das wird vorher aufgelöst.
 *    Komprimierte Teile entpackt der Server (lib/scan.server.ts) und prüft
 *    sie hier mit.
 *  - Alle Dateien: EICAR-Testsignatur (Standard-Prüfmuster von Virenscannern)
 *    und versteckter Web-/Skriptcode in Bildern (Polyglott-Dateien).
 *
 * Ein echter Virenscanner (ClamAV) kommt dazu, wenn VIRUS_SCAN_URL gesetzt
 * ist (lib/scan.server.ts). */

export type ScanResult = { ok: true } | { ok: false; reason: string };

/** Standard-Prüfmuster für Virenscanner (harmlos), aufgeteilt, damit diese
 *  Quelldatei selbst nicht als Fund gilt */
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Bytes als Text (latin1), damit Byte-Muster 1:1 erhalten bleiben */
export function latin1(b: Uint8Array, max = b.length): string {
  let s = "";
  const n = Math.min(b.length, max);
  for (let i = 0; i < n; i += 8192) s += String.fromCharCode(...b.subarray(i, Math.min(n, i + 8192)));
  return s;
}

/** PDF-Namen mit #xx-Tarnung auflösen: /J#61vaScript -> /JavaScript */
export function decodePdfNames(text: string): string {
  return text.replace(/\/[^\s/<>[\]()]+/g, (name) => name.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))));
}

const PDF_RISKS: [RegExp, string][] = [
  [/\/JavaScript\b|\/JS\b/, "enthält JavaScript"],
  [/\/Launch\b/, "startet Programme"],
  [/\/EmbeddedFiles?\b/, "enthält eingebettete Dateien"],
  [/\/RichMedia\b|\/Flash\b/, "enthält Flash oder Multimedia"],
  [/\/XFA\b/, "enthält ein XFA-Formular"],
  [/\/Encrypt\b/, "ist verschlüsselt und lässt sich nicht prüfen"],
  [/\/SubmitForm\b|\/ImportData\b/, "sendet oder lädt Daten"],
  [/\/GoToE\b|\/GoToR\b/, "öffnet andere Dateien"],
];

/** Gefundene Risiken in einem PDF (Text inkl. entpackter Teile) */
export function pdfRisks(text: string): string[] {
  const t = decodePdfNames(text);
  const out: string[] = [];
  for (const [re, why] of PDF_RISKS) if (re.test(t) && !out.includes(why)) out.push(why);
  /* Automatische Aktion beim Öffnen ist nur zusammen mit Skript gefährlich;
     /AA (Zusatzaktionen) an Feldern und Seiten führt ebenfalls Code aus */
  if (/\/AA\b/.test(t) && /\/S\s*\/(JavaScript|Launch)/.test(t) && !out.includes("enthält JavaScript"))
    out.push("führt beim Öffnen Aktionen aus");
  return out;
}

/** Bereiche zwischen "stream" und "endstream" (für das Entpacken) */
export function pdfStreams(b: Uint8Array, maxStreams = 400): Uint8Array[] {
  const text = latin1(b);
  const out: Uint8Array[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < maxStreams) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endstream", start);
    if (end < 0) break;
    out.push(b.subarray(start, end));
    re.lastIndex = end + 9;
  }
  return out;
}

/** Prüfung ohne Virenscanner. `extra` = entpackte PDF-Teile als Text */
export function localScan(b: Uint8Array, kind: "pdf" | "image" | "video", extra = ""): ScanResult {
  const head = latin1(b, 4 * 1024 * 1024);
  if (head.includes(EICAR) || extra.includes(EICAR)) return { ok: false, reason: "Die Datei enthält eine Virensignatur." };
  if (kind === "pdf") {
    const risks = pdfRisks(latin1(b) + "\n" + extra);
    if (risks.length) return { ok: false, reason: `Das PDF ${risks.join(", ")}. Aus Sicherheitsgründen nehmen wir es nicht an.` };
    return { ok: true };
  }
  if (kind === "image") {
    /* Web- oder Skriptcode in einem Bild: so versteckt man Schadcode in "Fotos" */
    if (/<script[\s>]|<\?php|<iframe[\s>]|javascript:/i.test(head) || /%PDF-\d/.test(head.slice(16)))
      return { ok: false, reason: "Das Bild enthält versteckten Code und wurde nicht angenommen." };
  }
  return { ok: true };
}
