import { describe, it, expect } from "vitest";
import { assertTenant, createTenantAuditMiddleware } from "../tenant.js";

describe("assertTenant", () => {
  it("does not throw when accountIds match", () => {
    expect(() => assertTenant("acc_123", "acc_123", "Invoice")).not.toThrow();
  });

  it("throws when accountIds do not match", () => {
    expect(() => assertTenant("acc_123", "acc_456", "Invoice")).toThrow("TENANT_VIOLATION");
  });

  it("throws when resource accountId is null", () => {
    expect(() => assertTenant(null, "acc_123", "Invoice")).toThrow("TENANT_VIOLATION");
  });

  it("throws when resource accountId is undefined", () => {
    expect(() => assertTenant(undefined, "acc_123", "Invoice")).toThrow("TENANT_VIOLATION");
  });

  it("includes resource type in error message", () => {
    expect(() => assertTenant("acc_1", "acc_2", "SalesOrder")).toThrow("SalesOrder");
  });
});

describe("createTenantAuditMiddleware", () => {
  it("returns a function", () => {
    const middleware = createTenantAuditMiddleware();
    expect(typeof middleware).toBe("function");
  });

  it("calls next() and passes through result", async () => {
    const middleware = createTenantAuditMiddleware();
    const result = await middleware(
      { model: "Session", action: "findMany", args: { where: { accountId: "acc_1" } }, runInTransaction: false },
      async () => "pass"
    );
    expect(result).toBe("pass");
  });

  it("calls next even for non-tenant models", async () => {
    const middleware = createTenantAuditMiddleware();
    const result = await middleware(
      { model: "Subscription", action: "findMany", args: { where: {} }, runInTransaction: false },
      async () => "ok"
    );
    expect(result).toBe("ok");
  });

  it("calls next even when accountId is missing (logs warning)", async () => {
    const middleware = createTenantAuditMiddleware();
    // Should not throw, just log a warning
    const result = await middleware(
      { model: "Session", action: "findMany", args: { where: {} }, runInTransaction: false },
      async () => "proceed"
    );
    expect(result).toBe("proceed");
  });
});
