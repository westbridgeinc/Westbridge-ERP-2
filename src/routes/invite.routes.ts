import { Router, Request, Response } from "express";
import { createInvite } from "../lib/services/invite.service.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit, auditContext } from "../lib/services/audit.service.js";
import { apiSuccess, apiError, apiMeta, getRequestId } from "../types/api.js";
import { validateCsrf, CSRF_COOKIE_NAME } from "../lib/csrf.js";
import { checkTieredRateLimit, getClientIdentifier, rateLimitHeaders } from "../lib/api/rate-limit-tiers.js";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import { prisma } from "../lib/data/prisma.js";
import { acceptInvite } from "../lib/services/invite.service.js";
import { validatePassword } from "../lib/password-policy.js";

const router = Router();

const inviteBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

const acceptBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120),
  password: z.string(),
});

// ─── POST /invite ──────────────────────────────────────────────────────────────

router.post("/invite", requireAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });
  const ctx = auditContext(req as any);

  try {
    const session = (req as any).session;

    const rateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/invite");
    if (!rateLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimit) });
      return res.status(429).json(apiError("RATE_LIMIT", "Too many invite attempts.", undefined, meta()));
    }

    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers["x-csrf-token"] as string ?? req.headers["X-CSRF-Token"] as string;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      res.set(responseHeaders());
      return res.status(403).json(apiError("FORBIDDEN", "Invalid or missing CSRF token.", undefined, meta()));
    }

    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVALID_JSON", "Invalid request body", undefined, meta()));
    }

    const parsed = inviteBodySchema.safeParse(body);
    if (!parsed.success) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid request", undefined, meta()));
    }

    const { email, role } = parsed.data;
    const { accountId, userId } = session;

    // Get inviter's name and company name
    const [inviter, account] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.account.findUnique({ where: { id: accountId } }),
    ]);

    const result = await createInvite({
      accountId,
      email,
      role,
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
      companyName: account?.companyName ?? "your team",
      baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });

    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVITE_FAILED", result.error, undefined, meta()));
    }

    void logAudit({
      accountId,
      userId,
      action: "team.invite.sent",
      metadata: { email, role },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });

    res.set(responseHeaders());
    return res.json(apiSuccess({ sent: true }, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta()));
  }
});

// ─── GET /invite ───────────────────────────────────────────────────────────────

router.get("/invite", async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });

  try {
    const getRateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "anonymous", "/api/invite:get");
    if (!getRateLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(getRateLimit) });
      return res.status(429).json(
        apiError("RATE_LIMIT", "Too many requests. Try again shortly.", undefined, meta())
      );
    }

    const raw = req.query.token as string | undefined;
    if (!raw) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("BAD_REQUEST", "token required", undefined, meta()));
    }

    const { validateInviteToken } = await import("../lib/services/invite.service.js");
    const result = await validateInviteToken(raw);
    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVALID_TOKEN", result.error, undefined, meta()));
    }

    const account = await prisma.account.findUnique({ where: { id: result.data.accountId } });
    res.set(responseHeaders());
    return res.json(
      apiSuccess({ email: result.data.email, role: result.data.role, companyName: account?.companyName ?? "" }, meta())
    );
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta()));
  }
});

// ─── POST /invite/accept ───────────────────────────────────────────────────────

router.post("/invite/accept", async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });
  const responseHeaders = () => ({ "X-Response-Time": `${Date.now() - start}ms` });
  const ctx = auditContext(req as any);

  try {
    const rateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "anonymous", "/api/invite/accept");
    if (!rateLimit.allowed) {
      res.set({ ...responseHeaders(), ...rateLimitHeaders(rateLimit) });
      return res.status(429).json(apiError("RATE_LIMIT", "Too many attempts.", undefined, meta()));
    }

    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers["x-csrf-token"] as string ?? req.headers["X-CSRF-Token"] as string;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      res.set(responseHeaders());
      return res.status(403).json(
        apiError("FORBIDDEN", "Invalid or missing CSRF token.", undefined, meta())
      );
    }

    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVALID_JSON", "Invalid request body", undefined, meta()));
    }

    const parsed = acceptBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.token?.[0] ?? parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid request";
      res.set(responseHeaders());
      return res.status(400).json(apiError("VALIDATION_ERROR", msg, undefined, meta()));
    }

    const { token, name, password } = parsed.data;

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("VALIDATION_ERROR", pwCheck.errors[0] ?? "Invalid password", undefined, meta()));
    }

    // Set password in ERPNext before activating user
    const erpUrl = process.env.ERPNEXT_URL ?? "http://localhost:8080";
    const erpApiKey = process.env.ERPNEXT_API_KEY ?? "";
    const erpApiSecret = process.env.ERPNEXT_API_SECRET ?? "";
    const { validateInviteToken } = await import("../lib/services/invite.service.js");
    const inviteCheck = await validateInviteToken(token);
    if (!inviteCheck.ok) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVALID_TOKEN", inviteCheck.error, undefined, meta()));
    }

    const erpRes = await fetch(`${erpUrl}/api/method/frappe.core.doctype.user.user.update_password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(erpApiKey && erpApiSecret
          ? { Authorization: `token ${erpApiKey}:${erpApiSecret}` }
          : {}),
      },
      body: JSON.stringify({ new_password: password, logout_all_sessions: 1, user: inviteCheck.data.email }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!erpRes?.ok) {
      res.set(responseHeaders());
      return res.status(502).json(apiError("ERP_ERROR", "Failed to set password. Please try again.", undefined, meta()));
    }

    const result = await acceptInvite({ raw: token, name });
    if (!result.ok) {
      res.set(responseHeaders());
      return res.status(400).json(apiError("INVITE_FAILED", result.error, undefined, meta()));
    }

    void logAudit({
      accountId: result.data.accountId,
      userId: result.data.userId,
      action: "team.invite.accepted",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });

    res.set(responseHeaders());
    return res.json(apiSuccess({ success: true }, meta()));
  } catch (error) {
    Sentry.captureException(error, { extra: { request_id: requestId } });
    return res.status(500).json(apiError("SERVER_ERROR", "An unexpected error occurred", undefined, meta()));
  }
});

export default router;
