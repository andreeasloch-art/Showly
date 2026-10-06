import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMp4 } from "./splashPlayer";

describe("Startvideo für den eigenen Abspieler", () => {
  const file = readFileSync("public/splash.mp4");
  const vid = parseMp4(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

  it("hat volle Größe und 24 Bilder pro Sekunde", () => {
    expect([vid.width, vid.height, vid.fps]).toEqual([720, 1264, 24]);
    expect(vid.frames.length / vid.fps).toBeGreaterThan(3.9);
  });

  it("beginnt mit einem Schlüsselbild und hat H.264-Angaben", () => {
    expect(vid.frames[0]!.key).toBe(true);
    expect(vid.codec).toMatch(/^avc1\.[0-9a-f]{6}$/);
    expect(vid.description[0]).toBe(1);
  });

  it("liest jedes Bild als H.264 mit Längenangabe", () => {
    for (const f of vid.frames) {
      const len = (f.data[0]! << 24) | (f.data[1]! << 16) | (f.data[2]! << 8) | f.data[3]!;
      expect(len).toBeGreaterThan(0);
      expect(len).toBeLessThanOrEqual(f.data.length - 4);
      expect([1, 5, 6]).toContain(f.data[4]! & 0x1f);
    }
    expect(vid.frames.filter((f) => f.key).length).toBeGreaterThanOrEqual(2);
  });

  it("lehnt fremde Dateien ab", () => {
    expect(() => parseMp4(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]).buffer)).toThrow();
  });
});
