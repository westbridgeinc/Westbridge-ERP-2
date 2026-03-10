import { logger } from "./logger.js";
import * as Sentry from "@sentry/node";

export interface SecurityEvent {
  type: "brute_force" | "session_hijack" | "csrf_attack" | "unauthorized_access";
  userId?: string;
  accountId?: string;
  ipAddress: string;
  details: string;
}

export function reportSecurityEvent(event: SecurityEvent): void {
  logger.error("security_event", {
    type: event.type,
    userId: event.userId,
    accountId: event.accountId,
    ipAddress: event.ipAddress,
    details: event.details,
    timestamp: new Date().toISOString(),
  });

  Sentry.captureMessage(`Security Event: ${event.type}`, {
    level: "error",
    tags: { security_event: event.type },
    extra: {
      userId: event.userId,
      accountId: event.accountId,
      ipAddress: event.ipAddress,
      details: event.details,
    },
  });
}
