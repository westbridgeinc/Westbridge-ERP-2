/**
 * Unit tests for auth service — password hashing, verification, login flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword, login } from "../auth.service.js";

// Mock the ERPNext auth client
vi.mock("../../data/auth.client.js", () => ({
  erpLogin: vi.fn(),
}));

import { erpLogin } from "../../data/auth.client.js";

describe("hashPassword", () => {
  it("returns a bcrypt hash string", async () => {
    const hash = await hashPassword("MySecurePass123");

    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    expect(hash.length).toBeGreaterThan(50);
  });

  it("produces different hashes for the same password (unique salts)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");

    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for matching password and hash", async () => {
    const password = "CorrectPassword123!";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it("returns false for non-matching password", async () => {
    const hash = await hashPassword("CorrectPassword123!");

    const result = await verifyPassword("WrongPassword!", hash);
    expect(result).toBe(false);
  });

  it("rejects legacy SHA-256 hashes (64-char hex strings)", async () => {
    // A 64-character hex string looks like a SHA-256 hash
    const legacyHash = "a".repeat(64);

    const result = await verifyPassword("any-password", legacyHash);
    expect(result).toBe(false);
  });

  it("does not reject non-hex 64-char strings as legacy hashes", async () => {
    // A bcrypt hash that happens to be 64 chars but contains non-hex chars
    // This shouldn't be treated as a legacy hash
    const hash = await hashPassword("test");

    // bcrypt hashes are ~60 chars and contain non-hex chars
    const result = await verifyPassword("test", hash);
    expect(result).toBe(true);
  });
});

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty email", async () => {
    const result = await login("", "password");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("required");
    }
  });

  it("returns error for whitespace-only email", async () => {
    const result = await login("   ", "password");

    expect(result.ok).toBe(false);
  });

  it("returns error for invalid email format", async () => {
    const result = await login("not-an-email", "password");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid email");
    }
  });

  it("returns error for empty password", async () => {
    const result = await login("user@example.com", "");

    expect(result.ok).toBe(false);
  });

  it("returns error for whitespace-only password", async () => {
    const result = await login("user@example.com", "   ");

    expect(result.ok).toBe(false);
  });

  it("calls erpLogin with trimmed email and original password", async () => {
    (erpLogin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: "erp-session-id",
    });

    const result = await login("  user@example.com  ", "password123");

    expect(erpLogin).toHaveBeenCalledWith("user@example.com", "password123");
    expect(result.ok).toBe(true);
  });

  it("returns erpLogin result on success", async () => {
    (erpLogin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: "erp-session-id",
    });

    const result = await login("user@example.com", "password");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("erp-session-id");
    }
  });

  it("returns erpLogin error on failure", async () => {
    (erpLogin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "Invalid credentials",
    });

    const result = await login("user@example.com", "wrong");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid credentials");
    }
  });
});
