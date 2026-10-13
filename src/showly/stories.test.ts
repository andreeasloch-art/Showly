import { describe, expect, it } from "vitest";
import { captionText, demoGroups, profileLink } from "./stories";

describe("Stories", () => {
  it("Beispiele mischen Künstler, Locations, Torten und Deko", () => {
    const g = demoGroups();
    const kinds = new Set(g.map((x) => x.kind));
    expect(kinds).toEqual(new Set(["artist", "location", "baker", "deco"]));
    expect(g.every((x) => x.demo && x.stories.length > 0)).toBe(true);
    /* bunt gemischt: unter den ersten acht mindestens eine Location */
    expect(g.slice(0, 8).some((x) => x.kind === "location")).toBe(true);
    /* Kennungen eindeutig */
    const ids = g.flatMap((x) => x.stories.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Text der Beispiele in der gewählten Sprache, eigener Text unverändert", () => {
    expect(captionText(JSON.stringify({ de: "Hallo", en: "Hi" }), "en")).toBe("Hi");
    expect(captionText(JSON.stringify({ de: "Hallo" }), "es")).toBe("Hallo");
    expect(captionText("{ kein JSON", "de")).toBe("{ kein JSON");
    expect(captionText("Heute in Köln", "en")).toBe("Heute in Köln");
  });

  it("Profil ansehen führt zur passenden Seite", () => {
    expect(profileLink({ kind: "artist", providerId: 7 })).toEqual({ to: "/kuenstler/$id", params: { id: "7" } });
    expect(profileLink({ kind: "location", providerId: 3 })).toEqual({ to: "/locations/$id", params: { id: "3" } });
    expect(profileLink({ kind: "baker", providerId: 2 })).toEqual({ to: "/torten/$id", params: { id: "2" } });
    expect(profileLink({ kind: "deco", providerId: 0 })).toEqual({ to: "/shop", search: { bereich: "deko" } });
  });
});
