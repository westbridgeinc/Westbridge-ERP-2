/**
 * Auth service: ERPNext login, password hashing & verification.
 * Orchestrates data layer; returns Result.
 */

import { erpLogin } from "../data/auth.client.js";
import type { Result } from "../utils/result.js";
import { err } from "../utils/result.js";
import { logger } from "../logger.js";
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
 * Verify a password against a stored bcrypt hash.
 *
 * Legacy SHA-256 hashes are no longer accepted — all passwords must be
 * bcrypt-hashed. If a legacy hash is encountered, the function returns false
 * and logs a warning so the account can be flagged for password reset.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // Reject legacy SHA-256 hashes — they are unsalted and insecure
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    logger.warn("Legacy SHA-256 password hash encountered — rejecting login. User must reset password.");
    return false;
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
