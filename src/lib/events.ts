/**
 * Domain event bus — in-process EventEmitter structured for future migration to Redis Streams / SQS.
 * Every domain event is typed; handlers receive strongly-typed payloads.
 *
 * @example
 * events.on('user.login', async ({ payload }) => {
 *   await cache.invalidate([`account:${payload.accountId}`]);
 * });
 *
 * events.emit({ type: 'user.login', payload: { userId, accountId, ip } });
 */
import { EventEmitter } from "events";
import { logger } from "./logger.js";

// ─── Event union type ─────────────────────────────────────────────────────────

export type DomainEvent =
  | { type: "user.created";       payload: { userId: string; accountId: string; email: string } }
  | { type: "user.login";         payload: { userId: string; accountId: string; ip: string } }
  | { type: "user.login_failed";  payload: { email: string; ip: string; reason: string } }
  | { type: "user.invited";       payload: { inviteeEmail: string; accountId: string; role: string } }
  | { type: "user.invite_accepted"; payload: { userId: string; accountId: string } }
  | { type: "session.created";    payload: { sessionId: string; userId: string; accountId: string } }
  | { type: "session.revoked";    payload: { sessionId: string; reason: string } }
  | { type: "invoice.created";    payload: { invoiceId: string; accountId: string; amount: number } }
  | { type: "invoice.paid";       payload: { invoiceId: string; accountId: string; amount: number } }
  | { type: "subscription.activated"; payload: { accountId: string; plan: string } }
  | { type: "subscription.upgraded";  payload: { accountId: string; plan: string } }
  | { type: "erp.doc_updated";    payload: { doctype: string; name: string; accountId: string } }
  | { type: "erp.sync_completed"; payload: { accountId: string; doctype: string; count: number } }
  | { type: "erp.sync_failed";    payload: { accountId: string; doctype: string; error: string } };

export type DomainEventType = DomainEvent["type"];

type ExtractPayload<T extends DomainEventType> = Extract<DomainEvent, { type: T }>["payload"];

// ─── Bus implementation ───────────────────────────────────────────────────────

class DomainEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: DomainEvent): void {
    logger.debug("event.emit", { type: event.type });
    // Fire-and-forget: errors in handlers must not propagate to callers
    setImmediate(() => {
      this.emitter.emit(event.type, event);
    });
  }

  on<T extends DomainEventType>(
    type: T,
    handler: (event: { type: T; payload: ExtractPayload<T> }) => Promise<void>
  ): void {
    this.emitter.on(type, (event: DomainEvent) => {
      handler(event as { type: T; payload: ExtractPayload<T> }).catch((err) => {
        logger.error("Event handler error", { type, error: err instanceof Error ? err.message : String(err) });
      });
    });
  }

  off<T extends DomainEventType>(type: T, handler: (...args: unknown[]) => void): void {
    this.emitter.off(type, handler);
  }
}

export const events = new DomainEventBus();

// ─── Built-in event handlers ──────────────────────────────────────────────────

/** Log every domain event to the structured audit trail. */
events.on("user.login", async ({ payload }) => {
  const { logAudit } = await import("./services/audit.service.js");
  void logAudit({
    accountId: payload.accountId,
    userId: payload.userId,
    action: "user.login",
    ipAddress: payload.ip,
    severity: "info",
    outcome: "success",
  });
});

events.on("user.login_failed", async ({ payload }) => {
  const { logAudit } = await import("./services/audit.service.js");
  void logAudit({
    accountId: null,
    action: "user.login_failed",
    ipAddress: payload.ip,
    severity: "warn",
    outcome: "failure",
    meta: { email: payload.email, reason: payload.reason },
  });
});

events.on("subscription.activated", async ({ payload }) => {
  const { cache } = await import("./cache.js");
  await cache.invalidate([`account:${payload.accountId}`]);
});
