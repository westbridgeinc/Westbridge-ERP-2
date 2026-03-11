/**
 * Team routes
 *
 * GET /team — returns all users belonging to the current account
 */
import { Router, Request, Response } from "express";
import { prisma } from "../lib/data/prisma.js";
import { apiSuccess, apiError, apiMeta, getRequestId } from "../types/api.js";
import { checkTieredRateLimit, getClientIdentifier, rateLimitHeaders } from "../lib/api/rate-limit-tiers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// GET /team — returns all users belonging to the current account
// ---------------------------------------------------------------------------
router.get("/team", requireAuth, requirePermission("users:read"), async (req: Request, res: Response) => {
  const start = Date.now();
  const requestId = getRequestId(req as any);
  const meta = () => apiMeta({ request_id: requestId });

  const session = (req as any).session;

  const rateLimit = await checkTieredRateLimit(getClientIdentifier(req as any), "authenticated", "/api/team");
  if (!rateLimit.allowed) {
    return res
      .status(429)
      .set("X-Response-Time", `${Date.now() - start}ms`)
      .set(rateLimitHeaders(rateLimit) as Record<string, string>)
      .json(apiError("RATE_LIMIT", "Too many requests", undefined, meta()));
  }

  const users = await prisma.user.findMany({
    where: { accountId: session.accountId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const currentUserId = session.userId;

  const members = users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email.split("@")[0],
    email: u.email,
    role: u.role,
    status: u.status,
    lastActive: u.createdAt ? formatRelative(u.createdAt) : "Never",
    isYou: u.id === currentUserId,
  }));

  return res.set("X-Response-Time", `${Date.now() - start}ms`).json(apiSuccess({ members }, meta()));
});

export default router;
