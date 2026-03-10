/**
 * API versioning via Accept header.
 * Accept: application/vnd.westbridge.v1+json
 *
 * Default: v1 (latest) when no header is provided.
 * Unsupported version: 406 Not Acceptable.
 * Deprecated version: adds Deprecation + Sunset headers but still serves the response.
 *
 * Extending to v2: add "v2" to SUPPORTED_VERSIONS and handle in extractApiVersion.
 */

export type ApiVersion = "v1";

export const LATEST_API_VERSION: ApiVersion = "v1";
export const SUPPORTED_VERSIONS = ["v1"] as const;

/** Set the sunset date (ISO string) here when a version is deprecated. */
export const DEPRECATED_VERSIONS: Record<string, string> = {
  // "v0": "2026-01-01",
};

const ACCEPT_REGEX = /application\/vnd\.westbridge\.(v\d+)\+json/;

/**
 * Parse the API version from the Accept header.
 * Returns null if an explicit version was requested that is not supported.
 * Returns LATEST_API_VERSION if no version header is present.
 */
export function getApiVersion(request: Request): ApiVersion | null {
  const accept = request.headers.get("accept") ?? "";
  const match = ACCEPT_REGEX.exec(accept);
  if (!match) return LATEST_API_VERSION;
  const requested = match[1];
  if ((SUPPORTED_VERSIONS as readonly string[]).includes(requested ?? "")) {
    return requested as ApiVersion;
  }
  return null; // unsupported version — caller should return 406
}

/** @deprecated Use getApiVersion instead */
export function extractApiVersion(request: Request): ApiVersion {
  return getApiVersion(request) ?? LATEST_API_VERSION;
}

/**
 * Add versioning + deprecation headers to a response headers object.
 * Always adds X-API-Version. Adds Deprecation + Sunset for deprecated versions.
 */
export function addVersionHeaders(headers: Headers, version: ApiVersion): void {
  headers.set("X-API-Version", version);
  const sunset = DEPRECATED_VERSIONS[version];
  if (sunset) {
    headers.set("Deprecation", "true");
    headers.set("Sunset", new Date(sunset).toUTCString());
    headers.set("Link", `</api/docs/changelog>; rel="successor-version"`);
  }
}

/** @deprecated Use addVersionHeaders instead */
export function versionHeaders(version: ApiVersion): Record<string, string> {
  const h: Record<string, string> = { "X-API-Version": version };
  const sunset = DEPRECATED_VERSIONS[version];
  if (sunset) {
    h["Deprecation"] = "true";
    h["Sunset"] = new Date(sunset).toUTCString();
    h["Link"] = `</api/docs/changelog>; rel="successor-version"`;
  }
  return h;
}
