/**
 * Security headers for all API responses and page responses.
 * CSP uses a per-request nonce for scripts (generated in middleware).
 */
import { randomBytes } from "crypto";

/** Generate a cryptographically random nonce for CSP. */
export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/** Build a strict Content-Security-Policy header value. */
export function buildCsp(nonce: string): string {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryHost = dsn
    ? `https://${new URL(dsn).host}`
    : "https://*.ingest.sentry.io";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src 'self' ${sentryHost}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Standard security headers for API route responses (no CSP needed for JSON). */
export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options":       "nosniff",
    "X-Frame-Options":              "DENY",
    "X-XSS-Protection":             "1; mode=block",
    "Referrer-Policy":              "strict-origin-when-cross-origin",
    "Permissions-Policy":           "camera=(), microphone=(), geolocation=()",
    "Cache-Control":                "no-store, no-cache, must-revalidate",
    "Pragma":                       "no-cache",
    "Strict-Transport-Security":    "max-age=63072000; includeSubDomains; preload",
  };
}

/** Full security headers for HTML page responses (includes CSP). */
export function pageSecurityHeaders(nonce: string): Record<string, string> {
  return {
    ...securityHeaders(),
    "Content-Security-Policy": buildCsp(nonce),
    "Report-To": JSON.stringify({
      group: "csp-endpoint",
      max_age: 86400,
      endpoints: [{ url: "/api/csp-report" }],
    }),
  };
}
