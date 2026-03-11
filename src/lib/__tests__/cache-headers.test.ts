import { describe, it, expect } from "vitest";
import { cacheControl, VARY_API } from "../api/cache-headers.js";

describe("cacheControl.private", () => {
  it("returns no-cache no-store directive", () => {
    const header = cacheControl.private();
    expect(header).toContain("private");
    expect(header).toContain("no-cache");
    expect(header).toContain("no-store");
    expect(header).toContain("must-revalidate");
  });
});

describe("cacheControl.public", () => {
  it("includes max-age", () => {
    const header = cacheControl.public(60);
    expect(header).toContain("max-age=60");
  });

  it("includes stale-while-revalidate at 2x max-age", () => {
    const header = cacheControl.public(60);
    expect(header).toContain("stale-while-revalidate=120");
  });

  it("starts with 'public'", () => {
    expect(cacheControl.public(30).startsWith("public")).toBe(true);
  });
});

describe("cacheControl.cdn", () => {
  it("includes s-maxage at 2x max-age", () => {
    const header = cacheControl.cdn(30);
    expect(header).toContain("s-maxage=60");
  });

  it("includes browser max-age", () => {
    expect(cacheControl.cdn(30)).toContain("max-age=30");
  });
});

describe("cacheControl.immutable", () => {
  it("includes 1 year max-age", () => {
    const header = cacheControl.immutable();
    expect(header).toContain("max-age=31536000");
  });

  it("includes immutable directive", () => {
    expect(cacheControl.immutable()).toContain("immutable");
  });
});

describe("cacheControl.noStore", () => {
  it("returns no-store", () => {
    expect(cacheControl.noStore()).toBe("no-store");
  });
});

describe("VARY_API", () => {
  it("includes Accept-Encoding and Accept", () => {
    expect(VARY_API).toContain("Accept-Encoding");
    expect(VARY_API).toContain("Accept");
  });
});
