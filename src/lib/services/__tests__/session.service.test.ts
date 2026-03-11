/**
 * Unit tests for session service — create, validate, revoke with mocked DB and Redis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be defined before importing the service
// ---------------------------------------------------------------------------

vi.mock("../../data/prisma.js", () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../redis.js", () => ({
  getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("../../services/audit.service.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  auditContext: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("../../security-monitor.js", () => ({
  reportSecurityEvent: vi.fn(),
}));

vi.mock("../../encryption.js", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
}));

import { validateSession, revokeSession, revokeAllUserSessions, deleteExpiredSessions } from "../session.service.js";
import { prisma } from "../../data/prisma.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty token", async () => {
    const result = await validateSession("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Missing token");
  });

  it("returns error for whitespace-only token", async () => {
    const result = await validateSession("   ");
    expect(result.ok).toBe(false);
  });

  it("returns error when session not found in DB", async () => {
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateSession("some-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid session");
  });

  it("returns error when session is expired", async () => {
    const expiredDate = new Date(Date.now() - 1000);
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess_1",
      userId: "usr_1",
      token: "hash",
      expiresAt: expiredDate,
      lastActiveAt: new Date(Date.now() - 60000),
      createdAt: new Date(Date.now() - 120000),
      fingerprint: null,
      erpnextSid: null,
      user: { id: "usr_1", accountId: "acc_1", role: "owner", account: { id: "acc_1" } },
    });
    (prisma.session.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await validateSession("some-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Session expired");
  });

  it("returns session data for valid, non-expired session", async () => {
    const validSession = {
      id: "sess_1",
      userId: "usr_1",
      token: "hash",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
      createdAt: new Date(),
      fingerprint: null,
      erpnextSid: null,
      user: { id: "usr_1", accountId: "acc_1", role: "owner", account: { id: "acc_1" } },
    };
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(validSession);
    (prisma.session.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await validateSession("valid-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("usr_1");
      expect(result.data.accountId).toBe("acc_1");
      expect(result.data.role).toBe("owner");
    }
  });

  it("defaults unknown roles to member", async () => {
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess_1",
      userId: "usr_1",
      token: "hash",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
      createdAt: new Date(),
      fingerprint: null,
      erpnextSid: null,
      user: { id: "usr_1", accountId: "acc_1", role: "unknown_role", account: { id: "acc_1" } },
    });
    (prisma.session.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await validateSession("token");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.role).toBe("member");
  });
});

describe("revokeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns revoked: false for empty token", async () => {
    const result = await revokeSession("");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.revoked).toBe(false);
  });

  it("deletes session from DB and returns revoked: true", async () => {
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await revokeSession("valid-token");

    expect(prisma.session.deleteMany).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.revoked).toBe(true);
  });

  it("returns revoked: false when no session found", async () => {
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const result = await revokeSession("nonexistent-token");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.revoked).toBe(false);
  });
});

describe("revokeAllUserSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all sessions for a user", async () => {
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

    const result = await revokeAllUserSessions("usr_1");

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "usr_1" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(3);
  });

  it("returns error on DB failure", async () => {
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));

    const result = await revokeAllUserSessions("usr_1");
    expect(result.ok).toBe(false);
  });
});

describe("deleteExpiredSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteMany with expiry filter", async () => {
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

    await deleteExpiredSessions();

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
