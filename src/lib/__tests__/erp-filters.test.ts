import { describe, it, expect } from "vitest";
import { validateErpFilters } from "../validation/erp-filters.js";

describe("validateErpFilters", () => {
  it("returns ok with empty filters when input is undefined", () => {
    const result = validateErpFilters(undefined);
    expect(result.ok).toBe(true);
    expect(result.filters).toEqual([]);
  });

  it("returns ok with empty filters when input is empty string", () => {
    const result = validateErpFilters("");
    expect(result.ok).toBe(true);
    expect(result.filters).toEqual([]);
  });

  it("parses a valid JSON array", () => {
    const result = validateErpFilters('[["status","=","Paid"]]');
    expect(result.ok).toBe(true);
    expect(result.filters).toEqual([["status", "=", "Paid"]]);
  });

  it("rejects non-array JSON", () => {
    const result = validateErpFilters('{"key":"value"}');
    expect(result.ok).toBe(false);
    expect(result.error).toContain("must be an array");
  });

  it("rejects invalid JSON", () => {
    const result = validateErpFilters("not json");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("accepts an empty array", () => {
    const result = validateErpFilters("[]");
    expect(result.ok).toBe(true);
    expect(result.filters).toEqual([]);
  });

  it("accepts nested arrays", () => {
    const result = validateErpFilters('[["a","=","1"],["b",">","2"]]');
    expect(result.ok).toBe(true);
    expect(result.filters).toHaveLength(2);
  });
});
