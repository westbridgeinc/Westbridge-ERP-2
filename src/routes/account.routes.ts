/**
 * Account routes
 *
 * PATCH  /account/profile — update the current user's profile (name)
 * DELETE /account/delete  — GDPR right-to-deletion (owner only)
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { validateSession } from "../lib/services/session.service.js";
import { validateCsrf, CSRF_COOKIE_NAME } from "../lib/csrf.js";
import { checkTieredRateLimit, rateLimitHeaders } from "../lib/api/rate-limit-tiers.js";
import { prisma } from "../lib/data/prisma.js";
import { apiSuccess, apiError, apiMeta, getRequestId } from "../types/api.js";
import { logAudit, auditContext } from "../lib/services/audit.service.js";
import { COOKIE } from "../lib/constants.js";
import { toWebRequest } from "../middleware/auth.js";
import * as Sentry from "@sentry/node";

const router = Router();

const profileSchema = z.object({
  name: z.string().min(1).max(120).trim(),
});

// ---------------------------------------------------------------------------
// PATCH /account/profile — update the current user's profile (name)
// ---------------------------------------------------------------------------
router.patch("/account/profile", async (req: Request, res: Response) => {
  const requestId = getRequestId(toWebRequest(req));
  const meta = { request_id: requestId };

  // CSRF validation
  const headerToken = req.headers["x-csrf-token"] as string;
  const cookieToken = req.cookies?.[COOKIE.CSRF_NAME] ?? null;
  if (!validateCsrf(headerToken, cookieToken)) {
    return res.status(403).json(
      apiError("CSRF_INVALID", "Invalid or missing CSRF token", undefined, meta)
    );
  }

  // Session validation
  const token = req.cookies?.[COOKIE.SESSION_NAME];
  if (!token) {
    return res.status(401).json(apiError("UNAUTHORIZED", "Authentication required", undefined, meta));
  }
  const sessionResult = await validateSession(token, toWebRequest(req));
  if (!sessionResult.ok) {
    return res.status(401).json(apiError("UNAUTHORIZED", "Authentication required", undefined, meta));
  }
  const session = sessionResult.data;

  const rateLimit = await checkTieredRateLimit(session.userId, "authenticated", "/api/account/profile");
  if (!rateLimit.allowed) {
    return res
      .status(429)
      .set(rateLimitHeaders(rateLimit) as Record<string, string>)
      .json(
        apiError("RATE_LIMITED", "Too many requests. Please try again shortly.", undefined, meta)
      );
  }

  // Parse and validate body
  const body = req.body;
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json(
      apiError("INVALID_REQUEST", "Name is required and must be under 120 characters.", undefined, meta)
    );
  }

  const { name } = parsed.data;

  await prisma.user.update({
    where: { id: session.userId },
    data: { name },
  });

  return res.json(apiSuccess({ name }, meta));
});

// ---------------------------------------------------------------------------
// DELETE /account/delete — GDPR right-to-deletion (owner only)
// ---------------------------------------------------------------------------
router.delete("/account/delete", async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(toWebRequest(req));
  const meta = () => apiMeta({ request_id: requestId });

  try {
    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME] ?? null;
    const csrfHeader = (req.headers["x-csrf-token"] as string) ?? null;
    if (!validateCsrf(csrfHeader, csrfCookie)) {
      return res.status(403).set("X-Response-Time", `${Date.now() - start}ms`).json(
        apiError("FORBIDDEN", "Invalid CSRF token", undefined, meta())
      );
    }

    const token = req.cookies?.[COOKIE.SESSION_NAME];
    if (!token) {
      return res.status(401).set("X-Response-Time", `${Date.now() - start}ms`).json(apiError("UNAUTHORIZED", "Not authenticated", undefined, meta()));
    }
    const sessionResult = await validateSession(token, toWebRequest(req));
    if (!sessionResult.ok) {
      return res.status(401).set("X-Response-Time", `${Date.now() - start}ms`).json(apiError("UNAUTHORIZED", sessionResult.error, undefined, meta()));
    }
    const session = sessionResult.data;

    if (session.role !== "owner") {
      return res.status(403).set("X-Response-Time", `${Date.now() - start}ms`).json(
        apiError("FORBIDDEN", "Only the account owner can delete the account", undefined, meta())
      );
    }

    const rateLimit = await checkTieredRateLimit(session.userId, "authenticated", "/api/account/delete");
    if (!rateLimit.allowed) {
      return res
        .status(429)
        .set("X-Response-Time", `${Date.now() - start}ms`)
        .set(rateLimitHeaders(rateLimit) as Record<string, string>)
        .json(
          apiError("RATE_LIMIT", "Too many attempts. Please wait before trying again.", undefined, meta())
        );
    }

    const ctx = auditContext(toWebRequest(req));

    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { accountId: session.accountId },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);

      for (const u of users) {
        await tx.user.update({
          where: { id: u.id },
          data: {
            name: "Deleted User",
            email: `deleted-${u.id}@deleted.invalid`,
            status: "deleted",
          },
        });
      }

      await tx.session.deleteMany({ where: { userId: { in: userIds } } });
      await tx.inviteToken.deleteMany({ where: { accountId: session.accountId } });
      await tx.account.update({
        where: { id: session.accountId },
        data: { status: "deleted" },
      });
    });

    await logAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "account.deleted",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      severity: "info",
      outcome: "success",
    });

    return res.set("X-Response-Time", `${Date.now() - start}ms`).json(apiSuccess({ message: "Account deleted" }, meta()));
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).set("X-Response-Time", `${Date.now() - start}ms`).json(
      apiError("INTERNAL", "An unexpected error occurred", undefined, meta())
    );
  }
});

export default router;
