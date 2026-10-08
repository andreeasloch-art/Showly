import { describe, expect, it } from "vitest";
import { isImageKind, isVideoKind, sniffType, stripImageMetadata } from "./imageSafety";

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const exifGps = [..."Exif\0\0".split("").map((c) => c.charCodeAt(0)), 0x4d, 0x4d, 0x88, 0x25, 1, 2, 3, 4];

function jpeg(withExif: boolean) {
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [..."JFIF\0".split("").map((c) => c.charCodeAt(0)), 1, 1]),
    ...(withExif ? seg(0xe1, exifGps) : []),
    ...seg(0xfe, [65, 66]),
    ...seg(0xdb, [0, 1, 2]),
    0xff, 0xda, 0, 4, 9, 9, 0x12, 0x34, 0xff, 0xd9,
  ]);
}

describe("Dateiart aus den ersten Bytes", () => {
  it("erkennt Bilder und Videos", () => {
    expect(sniffType(jpeg(false))).toBe("jpeg");
    expect(sniffType(new Uint8Array([0x89, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]))).toBe("png");
    expect(sniffType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffType(new TextEncoder().encode("\0\0\0\x18ftypisom\0\0"))).toBe("mp4");
    expect(sniffType(new TextEncoder().encode("\0\0\0\x18ftypheic\0\0"))).toBe("heic");
    expect(sniffType(new TextEncoder().encode("\0\0\0\x14ftypqt  \0\0"))).toBe("mov");
    expect(isImageKind("heic")).toBe(true);
    expect(isVideoKind("webm")).toBe(true);
  });

  it("umbenanntes HTML oder Programm ist kein Bild", () => {
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("MZ\x90\0\x03\0\0\0\x04\0\0\0"))).toBeNull();
  });
});

describe("Standort und andere Metadaten entfernen", () => {
  it("JPEG: EXIF (mit GPS) und Kommentar fliegen raus, Bilddaten bleiben", () => {
    const { bytes, changed } = stripImageMetadata(jpeg(true));
    expect(changed).toBe(true);
    expect(Array.from(bytes)).toEqual(Array.from(stripImageMetadata(jpeg(false)).bytes));
    const s = String.fromCharCode(...bytes);
    expect(s).not.toContain("Exif");
    expect(s).toContain("JFIF");
    expect(Array.from(bytes.slice(-6))).toEqual([9, 9, 0x12, 0x34, 0xff, 0xd9]);
  });

  it("PNG: eXIf- und Textblöcke fliegen raus", () => {
    const chunk = (type: string, data: number[]) => [
      0, 0, 0, data.length,
      ...type.split("").map((c) => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0,
    ];
    const png = new Uint8Array([
      0x89, 80, 78, 71, 13, 10, 26, 10,
      ...chunk("IHDR", [1, 2, 3]),
      ...chunk("eXIf", [7, 7]),
      ...chunk("tEXt", [65]),
      ...chunk("IDAT", [5]),
      ...chunk("IEND", []),
    ]);
    const { bytes, changed } = stripImageMetadata(png);
    expect(changed).toBe(true);
    const s = String.fromCharCode(...bytes);
    expect(s).toContain("IHDR");
    expect(s).toContain("IDAT");
    expect(s).not.toContain("eXIf");
    expect(s).not.toContain("tEXt");
  });

  it("kaputte Dateien bleiben unverändert", () => {
    const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3, 4, 5, 6]);
    expect(stripImageMetadata(bad).changed).toBe(false);
  });
});
