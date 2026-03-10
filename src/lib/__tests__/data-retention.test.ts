/**
 * Data retention constants test — ensures retention periods match SOC 2 requirements.
 */
import { describe, it, expect } from "vitest";
import { DATA_RETENTION } from "../data-retention.js";

describe("Data retention constants", () => {
  it("audit logs are retained for at least 365 days (SOC 2 requirement)", () => {
    expect(DATA_RETENTION.AUDIT_LOGS_DAYS).toBeGreaterThanOrEqual(365);
  });

  it("expired sessions are cleaned up after 30 days", () => {
    expect(DATA_RETENTION.SESSIONS_EXPIRED_DAYS).toBe(30);
  });

  it("soft-deleted records are purged after 90 days", () => {
    expect(DATA_RETENTION.SOFT_DELETED_DAYS).toBe(90);
  });

  it("all retention periods are positive numbers", () => {
    for (const [key, value] of Object.entries(DATA_RETENTION)) {
      expect(value, `${key} should be a positive number`).toBeGreaterThan(0);
    }
  });
});
