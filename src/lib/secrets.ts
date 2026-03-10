/**
 * Secret management utilities.
 * - All secrets are loaded from environment variables — never hardcoded.
 * - Rotation support: accept both old and new secret during the rotation window.
 * - Helpers for safe comparison and key derivation.
 *
 * To rotate a secret:
 *  1. Set NEW_SECRET alongside OLD_SECRET in env.
 *  2. Deploy — both keys are accepted.
 *  3. After rotation window (24h), remove OLD_SECRET.
 */
import { timingSafeEqual, createHmac } from "crypto";

// ─── Secret accessor helpers ──────────────────────────────────────────────────

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function optionalSecret(name: string): string | undefined {
  return process.env[name] ?? undefined;
}

// ─── Application secrets ──────────────────────────────────────────────────────

export const secrets = {
  get sessionSecret(): string { return requireSecret("SESSION_SECRET"); },
  get csrfSecret(): string { return requireSecret("CSRF_SECRET"); },
  get encryptionKey(): string { return requireSecret("ENCRYPTION_KEY"); },
  /** During key rotation: both keys are valid. Returns [current, previous?] */
  get encryptionKeys(): string[] {
    const current = requireSecret("ENCRYPTION_KEY");
    const prev = optionalSecret("ENCRYPTION_KEY_PREVIOUS");
    return prev ? [current, prev] : [current];
  },
  get erpApiKey(): string | undefined { return optionalSecret("ERPNEXT_API_KEY"); },
  get erpApiSecret(): string | undefined { return optionalSecret("ERPNEXT_API_SECRET"); },
  get resendApiKey(): string { return requireSecret("RESEND_API_KEY"); },
  get metricsToken(): string | undefined { return optionalSecret("METRICS_TOKEN"); },
};

// ─── Timing-safe comparison ───────────────────────────────────────────────────

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Returns false if lengths differ (after normalisation).
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/** Derive a scoped key from the master secret using HMAC. */
export function deriveKey(masterSecret: string, scope: string): string {
  return createHmac("sha256", masterSecret).update(scope).digest("hex");
}
