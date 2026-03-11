/**
 * Auth service: ERPNext login, password hashing & verification.
 * Orchestrates data layer; returns Result.
 */

import { erpLogin } from "../data/auth.client.js";
import type { Result } from "../utils/result.js";
import { err } from "../utils/result.js";
import bcrypt from "bcrypt";

// ---------------------------------------------------------------------------
// Password hashing & verification
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with 12 rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Supports legacy SHA-256 hex hashes (64-char) for migration from older installs.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // Support legacy SHA-256 hashes (64 char hex) during migration
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(password).digest("hex");
    return sha256 === hash;
  }
  return bcrypt.compare(password, hash);
}

// RFC 5322-inspired email format check. Not exhaustive — the goal is to reject
// clearly invalid inputs (e.g. "x", "", "foo@") before sending them to ERPNext,
// which may return error messages that expose internal details.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(
  email: string,
  password: string
): Promise<Result<string, string>> {
  const trimmedEmail = email?.trim() ?? "";
  if (!trimmedEmail) return err("Email and password required");
  if (!EMAIL_REGEX.test(trimmedEmail)) return err("Invalid email address");

  // Reject whitespace-only passwords. Passwords with leading/trailing spaces
  // are intentionally preserved (some users set them deliberately), but a
  // password consisting entirely of whitespace is almost certainly a mistake.
  if (!password || !password.trim()) return err("Email and password required");

  return erpLogin(trimmedEmail, password);
}
