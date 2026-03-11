import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "crypto";
import {
  getTestPrisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
  createTestAccount,
  createTestUser,
  hashToken,
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

describe("Multi-tenant data isolation", () => {
  it("users scoped by accountId only return that account's users", async () => {
    const accountA = await db.account.create({
      data: createTestAccount({ companyName: "Company A" }),
    });
    const accountB = await db.account.create({
      data: createTestAccount({ companyName: "Company B" }),
    });

    await db.user.create({ data: createTestUser(accountA.id, { name: "Alice" }) });
    await db.user.create({ data: createTestUser(accountA.id, { name: "Alice2" }) });
    await db.user.create({ data: createTestUser(accountB.id, { name: "Bob" }) });

    const usersA = await db.user.findMany({ where: { accountId: accountA.id } });
    const usersB = await db.user.findMany({ where: { accountId: accountB.id } });

    expect(usersA).toHaveLength(2);
    expect(usersA.every((u) => u.accountId === accountA.id)).toBe(true);
    expect(usersB).toHaveLength(1);
    expect(usersB[0].accountId).toBe(accountB.id);
  });

  it("audit logs are isolated per account", async () => {
    const accountA = await db.account.create({ data: createTestAccount() });
    const accountB = await db.account.create({ data: createTestAccount() });

    await db.auditLog.create({
      data: { accountId: accountA.id, action: "a.action", severity: "info", outcome: "success" },
    });
    await db.auditLog.create({
      data: { accountId: accountA.id, action: "a.action2", severity: "info", outcome: "success" },
    });
    await db.auditLog.create({
      data: { accountId: accountB.id, action: "b.action", severity: "info", outcome: "success" },
    });

    const logsA = await db.auditLog.findMany({ where: { accountId: accountA.id } });
    const logsB = await db.auditLog.findMany({ where: { accountId: accountB.id } });

    expect(logsA).toHaveLength(2);
    expect(logsB).toHaveLength(1);
  });

  it("deleting account A does not affect account B's data", async () => {
    const accountA = await db.account.create({ data: createTestAccount() });
    const accountB = await db.account.create({ data: createTestAccount() });

    await db.user.create({ data: createTestUser(accountA.id) });
    const userB = await db.user.create({ data: createTestUser(accountB.id) });

    await db.session.create({
      data: {
        userId: userB.id,
        token: hashToken(randomUUID()),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await db.auditLog.create({
      data: { accountId: accountB.id, action: "b.preserved", severity: "info", outcome: "success" },
    });

    // Delete account A
    await db.account.delete({ where: { id: accountA.id } });

    // Account B data should be untouched
    const bAccount = await db.account.findUnique({ where: { id: accountB.id } });
    expect(bAccount).toBeTruthy();

    const bUsers = await db.user.findMany({ where: { accountId: accountB.id } });
    expect(bUsers).toHaveLength(1);

    const bSessions = await db.session.findMany({ where: { userId: userB.id } });
    expect(bSessions).toHaveLength(1);

    const bLogs = await db.auditLog.findMany({ where: { accountId: accountB.id } });
    expect(bLogs).toHaveLength(1);
  });

  it("webhook endpoints are isolated per account", async () => {
    const accountA = await db.account.create({ data: createTestAccount() });
    const accountB = await db.account.create({ data: createTestAccount() });

    await db.webhookEndpoint.create({
      data: {
        accountId: accountA.id,
        url: "https://a.example.com/hook",
        events: ["invoice.created"],
        secret: "secret-a",
      },
    });
    await db.webhookEndpoint.create({
      data: {
        accountId: accountB.id,
        url: "https://b.example.com/hook",
        events: ["invoice.created"],
        secret: "secret-b",
      },
    });

    const webhooksA = await db.webhookEndpoint.findMany({ where: { accountId: accountA.id } });
    const webhooksB = await db.webhookEndpoint.findMany({ where: { accountId: accountB.id } });

    expect(webhooksA).toHaveLength(1);
    expect(webhooksA[0].url).toBe("https://a.example.com/hook");
    expect(webhooksB).toHaveLength(1);
    expect(webhooksB[0].url).toBe("https://b.example.com/hook");
  });

  it("api keys are isolated per account", async () => {
    const accountA = await db.account.create({ data: createTestAccount() });
    const accountB = await db.account.create({ data: createTestAccount() });

    await db.apiKey.create({
      data: { accountId: accountA.id, keyHash: hashToken("key-a"), prefix: "wb_a" },
    });
    await db.apiKey.create({
      data: { accountId: accountB.id, keyHash: hashToken("key-b"), prefix: "wb_b" },
    });

    const keysA = await db.apiKey.findMany({ where: { accountId: accountA.id } });
    const keysB = await db.apiKey.findMany({ where: { accountId: accountB.id } });

    expect(keysA).toHaveLength(1);
    expect(keysA[0].prefix).toBe("wb_a");
    expect(keysB).toHaveLength(1);
    expect(keysB[0].prefix).toBe("wb_b");
  });
});
