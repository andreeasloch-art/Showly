import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { sizedSrc } from "./imgSize";
import { ART_IMG, SHOP_IMG } from "./data";

describe("Bildgrößen", () => {
  it("führt mitgelieferte Bilder auf die kleine Fassung, alles andere bleibt", () => {
    expect(sizedSrc("/acts/5.webp", "s")).toBe("/acts/s/5.webp");
    expect(sizedSrc("./venues/3.webp", "s")).toBe("./venues/s/3.webp");
    expect(sizedSrc("/acts/5.webp")).toBe("/acts/5.webp");
    expect(sizedSrc("https://x.supabase.co/a.webp", "s")).toBe("https://x.supabase.co/a.webp");
  });

  it("hat zu jedem mitgelieferten Bild eine kleine Fassung", () => {
    const all = [...Object.values(ART_IMG), ...Object.values(SHOP_IMG)] as string[];
    for (let i = 1; i <= 14; i++) all.push(`/sweets/${i}.webp`);
    for (let i = 1; i <= 8; i++) all.push(`/venues/${i}.webp`);
    for (const src of all) expect(existsSync("public" + sizedSrc(src, "s")), src).toBe(true);
  });
});
