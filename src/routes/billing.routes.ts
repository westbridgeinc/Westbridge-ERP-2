/**
 * Billing routes
 *
 * GET /billing/history — returns the account's billing/payment history
 */
import { Router, Request, Response } from "express";
import { validateSession } from "../lib/services/session.service.js";
import { prisma } from "../lib/data/prisma.js";
import { apiSuccess, apiError, apiMeta, getRequestId } from "../types/api.js";
import { COOKIE } from "../lib/constants.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /billing/history — returns the account's billing/payment history
// ---------------------------------------------------------------------------
router.get("/billing/history", async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });

  const token = req.cookies?.[COOKIE.SESSION_NAME];
  if (!token) {
    return res.status(401).set("X-Response-Time", `${Date.now() - start}ms`).json(apiError("UNAUTHORIZED", "Not authenticated", undefined, meta()));
  }
  const session = await validateSession(token, req as any);
  if (!session.ok) {
    return res.status(401).set("X-Response-Time", `${Date.now() - start}ms`).json(apiError("UNAUTHORIZED", session.error, undefined, meta()));
  }

  const account = await prisma.account.findUnique({
    where: { id: session.data.accountId },
    select: { plan: true, status: true, createdAt: true },
  });

  // We don't yet store individual invoice rows — return empty with account context
  // so the UI can render an accurate EmptyState rather than fake invoices.
  return res
    .set("X-Response-Time", `${Date.now() - start}ms`)
    .json(
      apiSuccess(
        {
          items: [],
          plan: account?.plan ?? null,
          status: account?.status ?? null,
          accountCreatedAt: account?.createdAt ?? null,
        },
        meta()
      )
    );
});

export default router;
