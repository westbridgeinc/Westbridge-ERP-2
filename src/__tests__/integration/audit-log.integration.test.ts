import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  getTestPrisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
  createTestAccount,
  createTestUser,
} from "./setup.js";

const db = getTestPrisma();

beforeAll(async () => {
  await setupTestDatabase();
});

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe("AuditLog — database integration", () => {
  it("creates an audit log entry with all fields", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    const log = await db.auditLog.create({
      data: {
        accountId: account.id,
        userId: user.id,
        action: "auth.login",
        resource: "session",
        resourceId: "sess_123",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { browser: "Chrome" },
        severity: "info",
        outcome: "success",
      },
    });

    expect(log.id).toBeTruthy();
    expect(log.accountId).toBe(account.id);
    expect(log.action).toBe("auth.login");
    expect(log.severity).toBe("info");
    expect(log.outcome).toBe("success");
    expect(log.metadata).toEqual({ browser: "Chrome" });
  });

  it("queries by accountId + timestamp index", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await db.auditLog.create({
      data: { accountId: account.id, action: "old.action", timestamp: twoDaysAgo, severity: "info", outcome: "success" },
    });
    await db.auditLog.create({
      data: { accountId: account.id, action: "recent.action", timestamp: now, severity: "info", outcome: "success" },
    });

    const recent = await db.auditLog.findMany({
      where: { accountId: account.id, timestamp: { gte: yesterday } },
    });

    expect(recent).toHaveLength(1);
    expect(recent[0].action).toBe("recent.action");
  });

  it("queries by severity + timestamp index", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    await db.auditLog.create({
      data: { accountId: account.id, action: "normal", severity: "info", outcome: "success" },
    });
    await db.auditLog.create({
      data: { accountId: account.id, action: "security.breach", severity: "critical", outcome: "failure" },
    });

    const critical = await db.auditLog.findMany({
      where: { severity: "critical" },
    });

    expect(critical).toHaveLength(1);
    expect(critical[0].action).toBe("security.breach");
  });

  it("allows nullable userId (system-generated logs)", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    const log = await db.auditLog.create({
      data: {
        accountId: account.id,
        userId: null,
        action: "system.cleanup",
        severity: "info",
        outcome: "success",
      },
    });

    expect(log.userId).toBeNull();
  });

  it("cascades on account deletion", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    await db.auditLog.create({
      data: { accountId: account.id, action: "test", severity: "info", outcome: "success" },
    });

    await db.account.delete({ where: { id: account.id } });

    const logs = await db.auditLog.findMany({ where: { accountId: account.id } });
    expect(logs).toHaveLength(0);
  });
});
