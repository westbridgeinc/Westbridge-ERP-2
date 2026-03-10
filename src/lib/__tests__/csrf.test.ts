/**
 * CSRF token unit tests — generation, verification, expiry, secret rotation, and edge cases.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateCsrfToken, verifyCsrfToken, validateCsrf } from "../csrf.js";

describe("CSRF — token generation and verification", () => {
  beforeEach(() => {
    vi.stubEnv("CSRF_SECRET", "test-csrf-secret-that-is-long-enough-for-hmac");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates a 3-part token", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]!.length).toBeGreaterThan(0); // random value
    expect(parts[1]!.length).toBeGreaterThan(0); // timestamp
    expect(parts[2]!.length).toBeGreaterThan(0); // HMAC signature
  });

  it("verifies a freshly generated token", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it("each generated token is unique", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(100);
  });

  it("rejects null token", () => {
    expect(verifyCsrfToken(null)).toBe(false);
  });

  it("rejects undefined token", () => {
    expect(verifyCsrfToken(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(verifyCsrfToken("")).toBe(false);
  });

  it("rejects token with wrong number of parts", () => {
    expect(verifyCsrfToken("just-one-part")).toBe(false);
    expect(verifyCsrfToken("two.parts")).toBe(false);
    expect(verifyCsrfToken("four.parts.here.extra")).toBe(false);
  });

  it("rejects tampered signature", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[2] = "tampered-signature";
    expect(verifyCsrfToken(parts.join("."))).toBe(false);
  });

  it("rejects tampered random value", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[0] = "tampered-value";
    expect(verifyCsrfToken(parts.join("."))).toBe(false);
  });

  it("rejects tampered timestamp", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[1] = "0"; // epoch
    expect(verifyCsrfToken(parts.join("."))).toBe(false);
  });
});

describe("CSRF — token expiry", () => {
  beforeEach(() => {
    vi.stubEnv("CSRF_SECRET", "test-csrf-secret-that-is-long-enough-for-hmac");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("rejects expired token (>1 hour old)", () => {
    vi.useFakeTimers();
    const token = generateCsrfToken();

    // Advance time 61 minutes
    vi.advanceTimersByTime(61 * 60 * 1000);

    expect(verifyCsrfToken(token)).toBe(false);
  });

  it("accepts token within the 1-hour window", () => {
    vi.useFakeTimers();
    const token = generateCsrfToken();

    // Advance time 59 minutes — still valid
    vi.advanceTimersByTime(59 * 60 * 1000);

    expect(verifyCsrfToken(token)).toBe(true);
  });
});

describe("CSRF — secret rotation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts token signed with previous secret during rotation", () => {
    // Generate token with old secret
    vi.stubEnv("CSRF_SECRET", "old-secret-for-rotation-test-hmac-key");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "");
    const token = generateCsrfToken();

    // Rotate: old secret becomes previous, new secret is current
    vi.stubEnv("CSRF_SECRET", "new-secret-after-rotation-test-hmac");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "old-secret-for-rotation-test-hmac-key");

    expect(verifyCsrfToken(token)).toBe(true);
  });

  it("rejects token signed with a completely unknown secret", () => {
    vi.stubEnv("CSRF_SECRET", "secret-a");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "");
    const token = generateCsrfToken();

    // Switch to entirely new secrets
    vi.stubEnv("CSRF_SECRET", "secret-b");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "secret-c");

    expect(verifyCsrfToken(token)).toBe(false);
  });
});

describe("CSRF — validateCsrf (double-submit)", () => {
  beforeEach(() => {
    vi.stubEnv("CSRF_SECRET", "test-csrf-secret-that-is-long-enough-for-hmac");
    vi.stubEnv("CSRF_SECRET_PREVIOUS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes when header and cookie tokens match", () => {
    const token = generateCsrfToken();
    expect(validateCsrf(token, token)).toBe(true);
  });

  it("fails when header and cookie tokens differ", () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    expect(validateCsrf(token1, token2)).toBe(false);
  });

  it("fails when header is null", () => {
    const token = generateCsrfToken();
    expect(validateCsrf(null, token)).toBe(false);
  });

  it("fails when cookie is null", () => {
    const token = generateCsrfToken();
    expect(validateCsrf(token, null)).toBe(false);
  });

  it("fails when both are null", () => {
    expect(validateCsrf(null, null)).toBe(false);
  });
});
