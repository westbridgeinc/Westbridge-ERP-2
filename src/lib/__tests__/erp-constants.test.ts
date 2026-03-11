import { describe, it, expect } from "vitest";
import { ALLOWED_DOCTYPES, ALLOWED_DOCTYPES_SET } from "../erp-constants.js";

describe("ALLOWED_DOCTYPES", () => {
  it("contains key ERP document types", () => {
    expect(ALLOWED_DOCTYPES).toContain("Sales Invoice");
    expect(ALLOWED_DOCTYPES).toContain("Customer");
    expect(ALLOWED_DOCTYPES).toContain("Item");
    expect(ALLOWED_DOCTYPES).toContain("Employee");
    expect(ALLOWED_DOCTYPES).toContain("Purchase Order");
  });

  it("has no duplicates", () => {
    const unique = new Set(ALLOWED_DOCTYPES);
    expect(unique.size).toBe(ALLOWED_DOCTYPES.length);
  });

  it("has at least 10 doctypes", () => {
    expect(ALLOWED_DOCTYPES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("ALLOWED_DOCTYPES_SET", () => {
  it("is a Set with same size as array", () => {
    expect(ALLOWED_DOCTYPES_SET.size).toBe(ALLOWED_DOCTYPES.length);
  });

  it("supports O(1) lookup", () => {
    expect(ALLOWED_DOCTYPES_SET.has("Sales Invoice")).toBe(true);
    expect(ALLOWED_DOCTYPES_SET.has("Fake Doctype")).toBe(false);
  });

  it("contains every element from the array", () => {
    for (const dt of ALLOWED_DOCTYPES) {
      expect(ALLOWED_DOCTYPES_SET.has(dt)).toBe(true);
    }
  });
});
