import { describe, expect, it } from "vitest";
import { identityKeyInput } from "./identityKey";

const dob = { day: 3, month: 7, year: 1994 };

describe("identityKeyInput", () => {
  it("gleicht Schreibweisen an", () => {
    const a = identityKeyInput({ first: "Jürgen Maria", last: "Groß", dob });
    const b = identityKeyInput({ first: "JURGEN", last: "GROSS MARIA", dob });
    const c = identityKeyInput({ first: "Jurgen-Maria", last: "Gross", dob });
    expect(a).toBe("gross jurgen maria|1994-07-03");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("unterscheidet Geburtsdaten", () => {
    expect(identityKeyInput({ first: "Ana", last: "López", dob })).not.toBe(
      identityKeyInput({ first: "Ana", last: "López", dob: { ...dob, day: 4 } }),
    );
  });

  it("gibt null bei fehlenden Angaben", () => {
    expect(identityKeyInput({ first: "Ana", last: "", dob })).toBeNull();
    expect(identityKeyInput({ first: "Ana", last: "Lopez", dob: null })).toBeNull();
    expect(identityKeyInput({ first: "Ana", last: "Lopez", dob: { day: 1, month: 2 } })).toBeNull();
  });
});
