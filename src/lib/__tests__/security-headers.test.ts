import { describe, it, expect, vi, afterEach } from "vitest";
import { generateNonce, buildCsp, securityHeaders, pageSecurityHeaders } from "../security-headers.js";

describe("generateNonce", () => {
  it("returns a base64 string", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("generates unique values each time", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });

  it("generates a 16-byte nonce (24 base64 chars)", () => {
    const nonce = generateNonce();
    // 16 bytes → 24 base64 chars (with possible = padding)
    expect(nonce.replace(/=/g, "").length).toBeGreaterThanOrEqual(22);
  });
});

describe("buildCsp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes the nonce in script-src", () => {
    const csp = buildCsp("test-nonce");
    expect(csp).toContain("'nonce-test-nonce'");
  });

  it("sets default-src to self", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("default-src 'self'");
  });

  it("sets frame-ancestors to none", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("includes upgrade-insecure-requests", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("uses Sentry DSN host when SENTRY_DSN is set", () => {
    vi.stubEnv("SENTRY_DSN", "https://abc@o123.ingest.sentry.io/456");
    const csp = buildCsp("n");
    expect(csp).toContain("o123.ingest.sentry.io");
  });

  it("falls back to wildcard sentry host when no DSN", () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const csp = buildCsp("n");
    expect(csp).toContain("*.ingest.sentry.io");
  });
});

describe("securityHeaders", () => {
  it("returns all required security headers", () => {
    const h = securityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Cache-Control"]).toContain("no-store");
  });

  it("includes Permissions-Policy", () => {
    const h = securityHeaders();
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("pageSecurityHeaders", () => {
  it("includes CSP header", () => {
    const h = pageSecurityHeaders("test-nonce");
    expect(h["Content-Security-Policy"]).toContain("'nonce-test-nonce'");
  });

  it("includes Report-To header", () => {
    const h = pageSecurityHeaders("n");
    const reportTo = JSON.parse(h["Report-To"]);
    expect(reportTo.group).toBe("csp-endpoint");
    expect(reportTo.endpoints[0].url).toBe("/api/csp-report");
  });

  it("inherits base security headers", () => {
    const h = pageSecurityHeaders("n");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
  });
});
