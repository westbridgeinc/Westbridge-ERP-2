/**
 * Auth service: ERPNext login. Orchestrates data layer; returns Result.
 */

import { erpLogin } from "../data/auth.client.js";
import type { Result } from "../utils/result.js";
import { err } from "../utils/result.js";

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
