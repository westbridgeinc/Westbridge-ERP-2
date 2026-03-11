import { describe, it, expect } from "vitest";
import { ok, err } from "../utils/result.js";
import type { Result, AppError } from "../utils/result.js";

describe("Result type helpers", () => {
  it("ok() creates a success result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(42);
  });

  it("err() creates an error result", () => {
    const result = err("something failed");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("something failed");
  });

  it("ok works with objects", () => {
    const result = ok({ id: "1", name: "test" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("1");
  });

  it("err works with AppError", () => {
    const error: AppError = { code: "NOT_FOUND", message: "Resource not found" };
    const result: Result<never, AppError> = err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("Resource not found");
    }
  });

  it("ok with null data is valid", () => {
    const result = ok(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("ok with undefined data is valid", () => {
    const result = ok(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeUndefined();
  });
});
