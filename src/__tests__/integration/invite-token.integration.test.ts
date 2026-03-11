import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "crypto";
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

describe("InviteToken — database integration", () => {
  it("creates an invite token with all fields", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const token = randomUUID();

    const invite = await db.inviteToken.create({
      data: {
        accountId: account.id,
        email: "invitee@example.com",
        role: "member",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    expect(invite.accountId).toBe(account.id);
    expect(invite.email).toBe("invitee@example.com");
    expect(invite.role).toBe("member");
    expect(invite.usedAt).toBeNull();
  });

  it("enforces @@unique([accountId, email]) — cannot invite same email twice", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const email = "dupe@example.com";

    await db.inviteToken.create({
      data: {
        accountId: account.id,
        email,
        role: "member",
        tokenHash: hashToken(randomUUID()),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await expect(
      db.inviteToken.create({
        data: {
          accountId: account.id,
          email,
          role: "admin",
          tokenHash: hashToken(randomUUID()),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique tokenHash", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const sameHash = hashToken("same-token");

    await db.inviteToken.create({
      data: {
        accountId: account.id,
        email: "a@example.com",
        role: "member",
        tokenHash: sameHash,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    const account2 = await db.account.create({ data: createTestAccount() });

    await expect(
      db.inviteToken.create({
        data: {
          accountId: account2.id,
          email: "b@example.com",
          role: "member",
          tokenHash: sameHash,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it("can look up invite by tokenHash index", async () => {
    const account = await db.account.create({ data: createTestAccount() });
    const token = randomUUID();
    const tHash = hashToken(token);

    await db.inviteToken.create({
      data: {
        accountId: account.id,
        email: "lookup@example.com",
        role: "member",
        tokenHash: tHash,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    const found = await db.inviteToken.findUnique({ where: { tokenHash: tHash } });
    expect(found).toBeTruthy();
    expect(found!.email).toBe("lookup@example.com");
  });

  it("cascades delete from account", async () => {
    const account = await db.account.create({ data: createTestAccount() });

    await db.inviteToken.create({
      data: {
        accountId: account.id,
        email: "cascade@example.com",
        role: "member",
        tokenHash: hashToken(randomUUID()),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await db.account.delete({ where: { id: account.id } });

    const tokens = await db.inviteToken.findMany({ where: { accountId: account.id } });
    expect(tokens).toHaveLength(0);
  });
});
