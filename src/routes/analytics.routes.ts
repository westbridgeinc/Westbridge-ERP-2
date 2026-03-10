/**
 * Analytics routes
 *
 * POST /analytics/track  — receives product analytics events from the client-side tracker
 * POST /analytics/vitals — receives Core Web Vitals from reportWebVitals()
 */
import { Router, Request, Response } from "express";
import { getRedis } from "../lib/redis.js";
import { getClientIdentifier, checkTieredRateLimit } from "../lib/api/rate-limit-tiers.js";

const router = Router();

const EVENT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_EVENTS_PER_ACCOUNT = 500;
const VITALS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// POST /analytics/track — receives product analytics events
// ---------------------------------------------------------------------------
router.post("/analytics/track", async (req: Request, res: Response) => {
  // sendBeacon sends as text/plain — the body may arrive as a raw string
  let body: Record<string, unknown>;
  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body) as Record<string, unknown>;
    } else {
      body = req.body as Record<string, unknown>;
    }
  } catch {
    return res.status(204).end();
  }

  const identifier = getClientIdentifier(req as any);
  const { allowed } = await checkTieredRateLimit(identifier, "anonymous", "/api/analytics/track");
  if (!allowed) {
    return res.status(204).end(); // silently drop, don't error
  }

  const redis = getRedis();
  if (redis) {
    try {
      const accountId = typeof body.accountId === "string" ? body.accountId : "anonymous";
      const key = `analytics:events:${accountId}`;
      const event = JSON.stringify({ ...body, receivedAt: new Date().toISOString() });

      const pipeline = redis.pipeline();
      pipeline.lpush(key, event);
      pipeline.ltrim(key, 0, MAX_EVENTS_PER_ACCOUNT - 1);
      pipeline.expire(key, EVENT_TTL_SECONDS);
      await pipeline.exec();
    } catch {
      // Non-critical — analytics should never error the caller
    }
  }

  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// POST /analytics/vitals — receives Core Web Vitals
// ---------------------------------------------------------------------------
router.post("/analytics/vitals", async (req: Request, res: Response) => {
  let body: Record<string, unknown>;
  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body) as Record<string, unknown>;
    } else {
      body = req.body as Record<string, unknown>;
    }
  } catch {
    return res.status(204).end();
  }

  const identifier = getClientIdentifier(req as any);
  const { allowed } = await checkTieredRateLimit(identifier, "anonymous", "/api/analytics/vitals");
  if (!allowed) {
    return res.status(204).end();
  }

  const redis = getRedis();
  if (redis) {
    try {
      const metricName = typeof body.name === "string" ? body.name : "UNKNOWN";
      const key = `analytics:vitals:${metricName}`;
      const score = Date.now();
      const member = JSON.stringify({
        value: body.value,
        rating: body.rating,
        url: body.url,
        ts: body.timestamp ?? new Date().toISOString(),
      });

      const pipeline = redis.pipeline();
      pipeline.zadd(key, score, member);
      // Keep at most 10k entries per metric type
      pipeline.zremrangebyrank(key, 0, -10001);
      pipeline.expire(key, VITALS_TTL_SECONDS);
      await pipeline.exec();
    } catch {
      // Non-critical
    }
  }

  return res.status(204).end();
});

export default router;
