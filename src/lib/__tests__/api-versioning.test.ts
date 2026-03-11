import { describe, it, expect } from "vitest";
import {
  LATEST_API_VERSION,
  SUPPORTED_VERSIONS,
  getApiVersion,
  extractApiVersion,
  versionHeaders,
} from "../api/versioning.js";

// Helper: minimal Request-like object
function makeRequest(accept?: string): Request {
  return new Request("http://localhost", {
    headers: accept ? { Accept: accept } : {},
  });
}

describe("getApiVersion", () => {
  it("returns v1 as latest when no Accept header", () => {
    const version = getApiVersion(makeRequest());
    expect(version).toBe("v1");
  });

  it("returns v1 for standard JSON Accept header", () => {
    const version = getApiVersion(makeRequest("application/json"));
    expect(version).toBe("v1");
  });

  it("returns v1 for explicit v1 version header", () => {
    const version = getApiVersion(makeRequest("application/vnd.westbridge.v1+json"));
    expect(version).toBe("v1");
  });

  it("returns null for unsupported version", () => {
    const version = getApiVersion(makeRequest("application/vnd.westbridge.v99+json"));
    expect(version).toBeNull();
  });
});

describe("extractApiVersion (deprecated)", () => {
  it("returns latest version when version is null", () => {
    const version = extractApiVersion(makeRequest("application/vnd.westbridge.v99+json"));
    expect(version).toBe(LATEST_API_VERSION);
  });
});

describe("versionHeaders", () => {
  it("includes X-API-Version", () => {
    const h = versionHeaders("v1");
    expect(h["X-API-Version"]).toBe("v1");
  });

  it("does not include Deprecation for non-deprecated version", () => {
    const h = versionHeaders("v1");
    expect(h["Deprecation"]).toBeUndefined();
  });
});

describe("SUPPORTED_VERSIONS", () => {
  it("includes v1", () => {
    expect(SUPPORTED_VERSIONS).toContain("v1");
  });

  it("LATEST_API_VERSION is in supported versions", () => {
    expect((SUPPORTED_VERSIONS as readonly string[]).includes(LATEST_API_VERSION)).toBe(true);
  });
});
