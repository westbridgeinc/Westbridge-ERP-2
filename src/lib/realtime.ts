/**
 * Real-time event system via Redis Pub/Sub.
 * SSE streams at /api/events/stream subscribe to per-tenant channels.
 * Any server process can publish; all connected clients receive it instantly.
 */
import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

export type RealtimeEventType =
  | "erp.doc_updated"
  | "report.ready"
  | "notification.new"
  | "feature_flag.updated"
  | string; // allow extension without breaking existing consumers

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

const CHANNEL_PREFIX = "realtime:";

/** Global channel for events that all connected clients should receive (e.g. flag.updated). */
export const GLOBAL_CHANNEL = `${CHANNEL_PREFIX}*`;

function channelForAccount(accountId: string): string {
  return `${CHANNEL_PREFIX}${accountId}`;
}

/**
 * Publish a real-time event. Use accountId for tenant-scoped events, or "*" for global (all clients).
 */
export async function publish(accountId: string, event: RealtimeEvent): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const channel = accountId === "*" ? GLOBAL_CHANNEL : channelForAccount(accountId);
  try {
    await redis.publish(channel, JSON.stringify(event));
    logger.debug("realtime.published", { accountId, type: event.type });
  } catch (e) {
    logger.warn("realtime.publish_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Subscribe to real-time events for an account and the global channel (e.g. flag.updated).
 * Returns an unsubscribe function. Used by the SSE route handler.
 */
export async function subscribe(
  accountId: string,
  handler: (event: RealtimeEvent) => void
): Promise<() => Promise<void>> {
  const redis = getRedis();
  if (!redis) return async () => {};

  const subscriber = redis.duplicate();
  const accountChannel = channelForAccount(accountId);

  subscriber.on("message", (ch: string, message: string) => {
    if (ch !== accountChannel && ch !== GLOBAL_CHANNEL) return;
    try {
      handler(JSON.parse(message) as RealtimeEvent);
    } catch (e) {
      logger.warn("realtime.parse_error", { error: e instanceof Error ? e.message : String(e) });
    }
  });

  await subscriber.subscribe(accountChannel, GLOBAL_CHANNEL);
  logger.debug("realtime.subscribed", { accountId });

  const unsubscribe = async (): Promise<void> => {
    await subscriber.unsubscribe(accountChannel, GLOBAL_CHANNEL);
    subscriber.disconnect();
  };

  return unsubscribe;
}
