import { describe, it, expect } from "vitest";
import { validatePassword } from "../password-policy.js";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    const result = validatePassword("Str0ng!Pass");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a password shorter than 10 chars", () => {
    const result = validatePassword("Aa1!xxxx"); // 8 chars
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must be at least 10 characters");
  });

  it("rejects a password longer than 128 chars", () => {
    const result = validatePassword("Aa1!" + "x".repeat(126)); // 130 chars
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must be at most 128 characters");
  });

  it("rejects a password without uppercase letter", () => {
    const result = validatePassword("alllower1!xx");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must contain an uppercase letter");
  });

  it("rejects a password without lowercase letter", () => {
    const result = validatePassword("ALLUPPER1!XX");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must contain a lowercase letter");
  });

  it("rejects a password without a number", () => {
    const result = validatePassword("NoNumbers!xx");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must contain a number");
  });

  it("rejects a password without a special character", () => {
    const result = validatePassword("NoSpecial1xx");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Must contain a special character");
  });

  it("returns multiple errors for a very weak password", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("treats exactly 10 characters as valid length", () => {
    const result = validatePassword("Abcdef1!xx"); // 10 chars
    expect(result.errors).not.toContain("Must be at least 10 characters");
  });

  it("treats exactly 128 characters as valid length", () => {
    const result = validatePassword("Aa1!" + "x".repeat(124)); // 128 chars
    expect(result.errors).not.toContain("Must be at most 128 characters");
  });

  it("accepts passwords with unicode special characters", () => {
    const result = validatePassword("Str0ng€Pass");
    expect(result.valid).toBe(true);
  });
});
