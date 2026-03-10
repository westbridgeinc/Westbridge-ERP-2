/**
 * Events routes (SSE)
 *
 * GET /events/stream — Server-Sent Events stream for real-time account events
 */
import { Router, Request, Response } from "express";
import { validateSession } from "../lib/services/session.service.js";
import { subscribe } from "../lib/realtime.js";
import { COOKIE } from "../lib/constants.js";

const router = Router();

const KEEPALIVE_INTERVAL_MS = 25_000;

// ---------------------------------------------------------------------------
// GET /events/stream — Server-Sent Events stream
// ---------------------------------------------------------------------------
router.get("/events/stream", async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE.SESSION_NAME];
  const result = token ? await validateSession(token, req as any) : null;
  if (!result?.ok) {
    return res.status(401).send("Unauthorized");
  }

  const { accountId } = result.data;
  let lastEventId = (req.headers["last-event-id"] as string) ?? "0";

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event: { type: string; payload: unknown; id?: string }) => {
    const id = event.id ?? String(Date.now());
    lastEventId = id;
    res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  };

  // Initial connection confirmation
  send({ type: "connected", payload: { accountId, lastEventId } });

  // Subscribe to Redis Pub/Sub
  const unsubscribe = await subscribe(accountId, (event) => {
    send({ type: event.type, payload: event.payload });
  });

  // Keepalive comments to prevent connection timeout
  const keepalive = setInterval(() => {
    try {
      res.write(`: keepalive\n\n`);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    } catch {
      clearInterval(keepalive);
    }
  }, KEEPALIVE_INTERVAL_MS);

  // Clean up when the client disconnects
  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe?.();
  });
});

export default router;
