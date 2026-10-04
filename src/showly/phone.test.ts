import { describe, expect, it } from "vitest";
import { normalizePhone, prettyPhone } from "./phone";

describe("normalizePhone", () => {
  it("macht deutsche Nummern international", () => {
    expect(normalizePhone("0151 234 567 89")).toBe("+4915123456789");
    expect(normalizePhone("0049 151/23456789")).toBe("+4915123456789");
    expect(normalizePhone("+49 (0) 151-2345 6789")).toBe("+4915123456789");
    expect(normalizePhone("+49 151 23456789")).toBe("+4915123456789");
  });
  it("nimmt bei Spanisch +34", () => {
    expect(normalizePhone("600 123 456", "es")).toBe("+34600123456");
  });
  it("lehnt Unsinn ab", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
  it("zeigt Nummern lesbar", () => {
    expect(prettyPhone("+4915123456789")).toBe("+49 151 23456789");
  });
});
