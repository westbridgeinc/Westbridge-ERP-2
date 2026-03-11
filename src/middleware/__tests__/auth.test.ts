/**
 * Unit tests for auth middleware — requireAuth and requirePermission.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requirePermission, toWebRequest } from "../auth.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../lib/services/session.service.js", () => ({
  validateSession: vi.fn(),
}));

vi.mock("../../lib/services/audit.service.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  auditContext: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("../../lib/security-monitor.js", () => ({
  reportSecurityEvent: vi.fn(),
}));

import { validateSession } from "../../lib/services/session.service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    headers: {},
    method: "GET",
    path: "/test",
    originalUrl: "/test",
    protocol: "http",
    get: vi.fn().mockReturnValue("localhost"),
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "UNAUTHORIZED" }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 and clears cookie for malformed session token", async () => {
    const req = mockReq({ cookies: { westbridge_sid: "invalid token with spaces!" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when session validation fails", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "Session expired",
    });

    const req = mockReq({ cookies: { westbridge_sid: "valid-token-format" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches session data and calls next() on valid session", async () => {
    const sessionData = { userId: "usr_1", accountId: "acc_1", role: "owner" };
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: sessionData,
    });

    const req = mockReq({ cookies: { westbridge_sid: "valid-token" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(req.session).toEqual(sessionData);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 500 when validateSession throws", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));

    const req = mockReq({ cookies: { westbridge_sid: "valid-token" } });
    const res = mockRes();
    const next = mockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when req.session is not set", async () => {
    const middleware = requirePermission("invoices:read");
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when user lacks the required permission", async () => {
    const middleware = requirePermission("billing:manage");
    const req = mockReq();
    req.session = { userId: "usr_1", accountId: "acc_1", role: "member" };
    const res = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "FORBIDDEN" }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when user has the required permission", async () => {
    const middleware = requirePermission("invoices:read");
    const req = mockReq();
    req.session = { userId: "usr_1", accountId: "acc_1", role: "owner" };
    const res = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("owner has all permissions via admin:* wildcard", async () => {
    const middleware = requirePermission("admin:*" as never);
    const req = mockReq();
    req.session = { userId: "usr_1", accountId: "acc_1", role: "owner" };
    const res = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("toWebRequest", () => {
  it("converts Express request headers to Web API Request", () => {
    const req = mockReq({
      headers: { "user-agent": "Test/1.0", "x-forwarded-for": "1.2.3.4" },
      method: "GET",
      originalUrl: "/api/test",
      protocol: "https",
    });
    (req.get as ReturnType<typeof vi.fn>).mockReturnValue("example.com");

    const webReq = toWebRequest(req);

    expect(webReq.headers.get("user-agent")).toBe("Test/1.0");
    expect(webReq.headers.get("x-forwarded-for")).toBe("1.2.3.4");
    expect(webReq.method).toBe("GET");
  });
});
