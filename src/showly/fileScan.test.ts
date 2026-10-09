import { describe, expect, it } from "vitest";
import { decodePdfNames, localScan, pdfRisks, pdfStreams } from "./fileScan";
import { deflateSync } from "node:zlib";
import { clamVerdict, inflatedPdfText, scanUpload } from "@/lib/scan.server";

const enc = (s: string) => new TextEncoder().encode(s);
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const pdf = (body: string) => enc(`%PDF-1.7\n1 0 obj\n<< ${body} >>\nendobj\n%%EOF`);

describe("Virenschutz", () => {
  it("normales PDF geht durch", () => {
    expect(localScan(pdf("/Type /Catalog /Pages 2 0 R"), "pdf")).toEqual({ ok: true });
  });
  it("PDF mit JavaScript, Programmstart, eingebetteter Datei oder Verschlüsselung wird abgelehnt", () => {
    expect(localScan(pdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"), "pdf").ok).toBe(false);
    expect(localScan(pdf("/OpenAction << /S /Launch /F (cmd.exe) >>"), "pdf").ok).toBe(false);
    expect(localScan(pdf("/Names << /EmbeddedFiles 3 0 R >>"), "pdf").ok).toBe(false);
    expect(localScan(pdf("/Encrypt 5 0 R"), "pdf").ok).toBe(false);
  });
  it("getarnte Namen werden erkannt (/J#61vaScript)", () => {
    expect(decodePdfNames("/J#61vaScript")).toBe("/JavaScript");
    expect(pdfRisks("/S /J#61vaScript")).toContain("enthält JavaScript");
  });
  it("Risiko in entpackten Teilen wird erkannt", () => {
    expect(localScan(pdf("/Type /Catalog"), "pdf", "/S /JavaScript /JS (x)").ok).toBe(false);
  });
  it("Streams werden gefunden", () => {
    expect(pdfStreams(enc("1 0 obj<<>>stream\nABC\nendstream endobj")).length).toBe(1);
  });
  it("EICAR-Testsignatur in jeder Datei", () => {
    expect(localScan(enc("xx" + EICAR), "image").ok).toBe(false);
    expect(localScan(enc(EICAR), "video").ok).toBe(false);
  });
  it("Bild mit verstecktem Skript", () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...enc("....<script>alert(1)</script>")]);
    expect(localScan(jpg, "image").ok).toBe(false);
    expect(localScan(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), "image").ok).toBe(true);
  });
  it("Skript in einem komprimierten Teil wird entpackt und erkannt", async () => {
    const hidden = deflateSync(Buffer.from("<< /S /JavaScript /JS (app.alert(1)) >>"));
    const head = enc("%PDF-1.7\n4 0 obj << /Filter /FlateDecode >>\nstream\n");
    const tail = enc("\nendstream\nendobj\n%%EOF");
    const file = new Uint8Array([...head, ...hidden, ...tail]);
    expect(await inflatedPdfText(file)).toContain("/JavaScript");
    expect((await scanUpload(file, "pdf")).ok).toBe(false);
    expect((await scanUpload(pdf("/Type /Catalog"), "pdf")).ok).toBe(true);
  });
  it("Antworten des ClamAV-Dienstes", () => {
    expect(clamVerdict(406, "")).toBe("infected");
    expect(clamVerdict(200, '[{"Status":"OK","Description":""}]')).toBe("clean");
    expect(clamVerdict(200, '{"success":true,"data":{"result":[{"is_infected":true}]}}')).toBe("infected");
    expect(clamVerdict(500, "")).toBe("error");
  });
});
