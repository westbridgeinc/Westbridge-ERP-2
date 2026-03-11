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

describe("Account — database integration", () => {
  it("creates an account with all required fields", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    expect(account.id).toBeTruthy();
    expect(account.companyName).toBe("Test Corp");
    expect(account.plan).toBe("Starter");
    expect(account.status).toBe("active");
    expect(account.createdAt).toBeInstanceOf(Date);
  });

  it("enforces unique email constraint on accounts", async () => {
    const email = "unique@example.com";
    await db.account.create({ data: createTestAccount({ email }) });

    await expect(
      db.account.create({ data: createTestAccount({ email }) }),
    ).rejects.toThrow();
  });

  it("stores modulesSelected as string array", async () => {
    const modules = ["invoicing", "crm", "hr"];
    const account = await db.account.create({
      data: createTestAccount({ modulesSelected: modules }),
    });

    expect(account.modulesSelected).toEqual(modules);
  });
});

describe("User — database integration", () => {
  it("creates a user linked to an account", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    expect(user.accountId).toBe(account.id);
    expect(user.role).toBe("owner");
    expect(user.failedLoginAttempts).toBe(0);
  });

  it("enforces @@unique([accountId, email]) composite constraint", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const email = "dupe@example.com";

    await db.user.create({ data: createTestUser(account.id, { email }) });

    await expect(
      db.user.create({ data: createTestUser(account.id, { email }) }),
    ).rejects.toThrow();
  });

  it("allows same email in different accounts", async () => {
    const email = "shared@example.com";
    const account1 = await db.account.create({ data: createTestAccount() });
    const account2 = await db.account.create({ data: createTestAccount() });

    await db.user.create({ data: createTestUser(account1.id, { email }) });
    const user2 = await db.user.create({ data: createTestUser(account2.id, { email }) });

    expect(user2.email).toBe(email);
    expect(user2.accountId).toBe(account2.id);
  });

  it("rejects user creation with non-existent accountId", async () => {
    await expect(
      db.user.create({ data: createTestUser("non-existent-account-id") }),
    ).rejects.toThrow();
  });
});

describe("Cascade deletes", () => {
  it("deleting an account cascades to users", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    await db.user.create({ data: createTestUser(account.id) });
    await db.user.create({ data: createTestUser(account.id) });

    await db.account.delete({ where: { id: account.id } });

    const users = await db.user.findMany({ where: { accountId: account.id } });
    expect(users).toHaveLength(0);
  });

  it("deleting an account cascades to all related entities", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    // Create related entities
    await db.subscription.create({
      data: {
        accountId: account.id,
        planId: "Starter",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await db.auditLog.create({
      data: {
        accountId: account.id,
        userId: user.id,
        action: "test.action",
        severity: "info",
        outcome: "success",
      },
    });
    await db.apiKey.create({
      data: {
        accountId: account.id,
        keyHash: "test-hash-key",
        prefix: "wb_test",
      },
    });
    await db.webhookEndpoint.create({
      data: {
        accountId: account.id,
        url: "https://example.com/webhook",
        events: ["invoice.created"],
        secret: "encrypted-secret",
      },
    });

    await db.account.delete({ where: { id: account.id } });

    // All related records should be gone
    expect(await db.subscription.findMany({ where: { accountId: account.id } })).toHaveLength(0);
    expect(await db.auditLog.findMany({ where: { accountId: account.id } })).toHaveLength(0);
    expect(await db.apiKey.findMany({ where: { accountId: account.id } })).toHaveLength(0);
    expect(await db.webhookEndpoint.findMany({ where: { accountId: account.id } })).toHaveLength(0);
  });
});
