import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  getTestPrisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
  createTestAccount,
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

describe("WebhookEndpoint — database integration", () => {
  it("creates a webhook endpoint with events array", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    const webhook = await db.webhookEndpoint.create({
      data: {
        accountId: account.id,
        url: "https://example.com/hook",
        events: ["invoice.created", "invoice.paid"],
        secret: "encrypted-hmac-secret",
        enabled: true,
      },
    });

    expect(webhook.accountId).toBe(account.id);
    expect(webhook.events).toEqual(["invoice.created", "invoice.paid"]);
    expect(webhook.enabled).toBe(true);
    expect(webhook.consecutiveFailures).toBe(0);
    expect(webhook.disabledAt).toBeNull();
  });

  it("tracks consecutive failures for circuit breaker", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    const webhook = await db.webhookEndpoint.create({
      data: {
        accountId: account.id,
        url: "https://example.com/hook",
        events: ["test"],
        secret: "secret",
      },
    });

    const updated = await db.webhookEndpoint.update({
      where: { id: webhook.id },
      data: {
        consecutiveFailures: 5,
        enabled: false,
        disabledAt: new Date(),
      },
    });

    expect(updated.consecutiveFailures).toBe(5);
    expect(updated.enabled).toBe(false);
    expect(updated.disabledAt).toBeInstanceOf(Date);
  });

  it("cascades delete from account", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    await db.webhookEndpoint.create({
      data: {
        accountId: account.id,
        url: "https://example.com/hook",
        events: ["test"],
        secret: "secret",
      },
    });

    await db.account.delete({ where: { id: account.id } });

    const webhooks = await db.webhookEndpoint.findMany({ where: { accountId: account.id } });
    expect(webhooks).toHaveLength(0);
  });
});

describe("ApiKey — database integration", () => {
  it("creates an API key with hash and prefix", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const keyHash = hashToken("raw-api-key");

    const apiKey = await db.apiKey.create({
      data: {
        accountId: account.id,
        keyHash,
        prefix: "wb_test",
        label: "My API Key",
      },
    });

    expect(apiKey.accountId).toBe(account.id);
    expect(apiKey.keyHash).toBe(keyHash);
    expect(apiKey.prefix).toBe("wb_test");
    expect(apiKey.lastUsedAt).toBeNull();
  });

  it("can look up by keyHash index", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const keyHash = hashToken("lookup-key");

    await db.apiKey.create({
      data: { accountId: account.id, keyHash, prefix: "wb_lk" },
    });

    const keys = await db.apiKey.findMany({ where: { keyHash } });
    expect(keys).toHaveLength(1);
    expect(keys[0].prefix).toBe("wb_lk");
  });

  it("cascades delete from account", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    await db.apiKey.create({
      data: { accountId: account.id, keyHash: hashToken("key"), prefix: "wb_x" },
    });

    await db.account.delete({ where: { id: account.id } });

    const keys = await db.apiKey.findMany({ where: { accountId: account.id } });
    expect(keys).toHaveLength(0);
  });
});
