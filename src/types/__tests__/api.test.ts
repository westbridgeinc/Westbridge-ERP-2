import { describe, it, expect } from "vitest";
import { apiMeta, getRequestId, apiSuccess, apiError } from "../api.js";

describe("apiMeta", () => {
  it("has a timestamp", () => {
    const meta = apiMeta();
    expect(meta.timestamp).toBeDefined();
    expect(new Date(meta.timestamp).getTime()).not.toBeNaN();
  });

  it("generates a request_id when none provided", () => {
    const meta = apiMeta();
    expect(meta.request_id).toBeDefined();
    expect(meta.request_id!.length).toBeGreaterThan(0);
  });

  it("accepts overrides for request_id", () => {
    const meta = apiMeta({ request_id: "custom-id" });
    expect(meta.request_id).toBe("custom-id");
  });

  it("generates unique IDs on each call", () => {
    const a = apiMeta();
    const b = apiMeta();
    expect(a.request_id).not.toBe(b.request_id);
  });
});

describe("getRequestId", () => {
  it("returns x-request-id header when present", () => {
    const req = new Request("http://localhost", {
      headers: { "x-request-id": "from-header" },
    });
    expect(getRequestId(req)).toBe("from-header");
  });

  it("generates UUID when header is missing", () => {
    const req = new Request("http://localhost");
    const id = getRequestId(req);
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("apiSuccess", () => {
  it("wraps data in standard envelope", () => {
    const res = apiSuccess({ count: 5 });
    expect(res.data).toEqual({ count: 5 });
    expect(res.meta).toBeDefined();
    expect(res.meta.timestamp).toBeDefined();
  });

  it("accepts meta overrides", () => {
    const res = apiSuccess(null, { request_id: "test" });
    expect(res.meta.request_id).toBe("test");
  });
});

describe("apiError", () => {
  it("wraps error in standard envelope", () => {
    const res = apiError("NOT_FOUND", "Resource not found");
    expect(res.error.code).toBe("NOT_FOUND");
    expect(res.error.message).toBe("Resource not found");
    expect(res.meta).toBeDefined();
  });

  it("includes details when provided", () => {
    const res = apiError("VALIDATION_ERROR", "Bad input", { field: "email" });
    expect(res.error.details).toEqual({ field: "email" });
  });

  it("omits details when not provided", () => {
    const res = apiError("SERVER_ERROR", "Internal error");
    expect(res.error.details).toBeUndefined();
  });
});
