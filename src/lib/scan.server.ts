/* Virenschutz für Uploads (Chat-Anhänge, Nachweise, Fotos und Videos).
 *
 *  1. Immer: eigene Prüfung (showly/fileScan.ts). Bei PDFs werden dafür auch
 *     die komprimierten Teile entpackt, damit sich Skripte nicht darin
 *     verstecken können.
 *  2. Optional: echter Virenscanner ClamAV über einen eigenen Scan-Dienst
 *     (clamav-rest, z. B. als Docker-Container bei einem EU-Hoster).
 *     Secrets:
 *       VIRUS_SCAN_URL    z. B. https://scan.showly.eu/v2/scan
 *       VIRUS_SCAN_TOKEN  optional, wird als "Authorization: Bearer" gesendet
 *     Ist der Scanner eingerichtet, aber nicht erreichbar, werden PDFs
 *     abgelehnt (lieber kein Dokument als ein ungeprüftes); Fotos und Videos
 *     gehen nach der eigenen Prüfung durch.
 *
 * Abgelehnte Dateien löscht der Aufrufer sofort wieder. */
import { latin1, localScan, pdfStreams, type ScanResult } from "@/showly/fileScan";

const MAX_INFLATE = 30 * 1024 * 1024;

/** Einen Teil entpacken (FlateDecode = zlib), Web-Standard, auch auf Cloudflare */
async function inflate(part: Uint8Array, limit: number): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const reader = new Blob([new Uint8Array(part)]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } catch {
    /* Zeilenende nach den Daten oder kaputter Rest: das Entpackte zählt trotzdem */
    if (!chunks.length) return null;
  }
  const out = new Uint8Array(Math.min(size, limit));
  let at = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - at);
    out.set(c.subarray(0, take), at);
    at += take;
    if (at >= out.length) break;
  }
  return out;
}

/** Komprimierte PDF-Teile entpacken, mit Obergrenze (Schutz vor "Zip-Bomben") */
export async function inflatedPdfText(bytes: Uint8Array): Promise<string> {
  let total = 0;
  let out = "";
  for (const s of pdfStreams(bytes)) {
    if (total >= MAX_INFLATE) break;
    const raw = await inflate(s, MAX_INFLATE - total);
    if (!raw) continue; // nicht komprimiert oder anderes Verfahren: Rohtext ist schon geprüft
    total += raw.length;
    out += latin1(raw) + "\n";
  }
  return out;
}

/** Antwort eines clamav-rest-Dienstes auswerten (mehrere gängige Formate) */
export function clamVerdict(status: number, body: string): "clean" | "infected" | "error" {
  if (status === 406) return "infected"; // ajilach/clamav-rest: FOUND
  if (status >= 400) return "error";
  const t = body.toLowerCase();
  if (/"status"\s*:\s*"found"|"is_infected"\s*:\s*true|"infected"\s*:\s*true|\bfound\b/.test(t)) return "infected";
  if (/"status"\s*:\s*"ok"|"is_infected"\s*:\s*false|"infected"\s*:\s*false|"clean"|\bok\b/.test(t)) return "clean";
  return "error";
}

async function clamScan(bytes: Uint8Array, name: string): Promise<"clean" | "infected" | "error" | "off"> {
  const url = process.env["VIRUS_SCAN_URL"];
  if (!url) return "off";
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), name);
    const token = process.env["VIRUS_SCAN_TOKEN"];
    const r = await fetch(url, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    return clamVerdict(r.status, await r.text().catch(() => ""));
  } catch {
    return "error";
  }
}

export async function scanUpload(bytes: Uint8Array, kind: "pdf" | "image" | "video", name = "datei"): Promise<ScanResult> {
  const local = localScan(bytes, kind, kind === "pdf" ? await inflatedPdfText(bytes) : "");
  if (!local.ok) return local;
  const clam = await clamScan(bytes, name);
  if (clam === "infected") return { ok: false, reason: "Der Virenscanner hat Schadsoftware gefunden. Die Datei wurde gelöscht." };
  if (clam === "error" && kind === "pdf")
    return { ok: false, reason: "Das Dokument konnte gerade nicht auf Viren geprüft werden. Bitte versuch es später noch einmal." };
  return { ok: true };
}
