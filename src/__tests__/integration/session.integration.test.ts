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

describe("Session — database integration", () => {
  it("creates a session linked to a user", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    const token = randomUUID();
    const session = await db.session.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
    });

    expect(session.userId).toBe(user.id);
    expect(session.token).toBe(hashToken(token));
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("enforces unique token constraint", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });
    const tokenHash = hashToken("duplicate-token");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.session.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    await expect(
      db.session.create({
        data: { userId: user.id, token: tokenHash, expiresAt },
      }),
    ).rejects.toThrow();
  });

  it("can query sessions by token index", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });
    const tokenHash = hashToken(randomUUID());

    await db.session.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const found = await db.session.findUnique({ where: { token: tokenHash } });
    expect(found).toBeTruthy();
    expect(found!.userId).toBe(user.id);
  });

  it("queries non-expired sessions correctly", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    // Create an expired session
    await db.session.create({
      data: {
        userId: user.id,
        token: hashToken("expired"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    // Create a valid session
    await db.session.create({
      data: {
        userId: user.id,
        token: hashToken("valid"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const activeSessions = await db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
    });

    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].token).toBe(hashToken("valid"));
  });

  it("cascades delete from user to sessions", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const user = await db.user.create({ data: createTestUser(account.id) });

    await db.session.create({
      data: {
        userId: user.id,
        token: hashToken("session1"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await db.session.create({
      data: {
        userId: user.id,
        token: hashToken("session2"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await db.user.delete({ where: { id: user.id } });

    const sessions = await db.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(0);
  });
});
