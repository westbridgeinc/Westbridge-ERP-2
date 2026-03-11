/**
 * Billing routes
 *
 * GET /billing/history — returns the account's billing/payment history
 */
import { Router, Request, Response } from "express";
import { prisma } from "../lib/data/prisma.js";
import { apiSuccess, apiMeta, getRequestId } from "../types/api.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /billing/history — returns the account's billing/payment history
// ---------------------------------------------------------------------------
router.get("/billing/history", requireAuth, requirePermission("billing:read"), async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });

  const session = (req as any).session;

  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
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
