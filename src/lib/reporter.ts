/**
 * Error reporter — structured log + Sentry when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import * as Sentry from "@sentry/node";
import { logger } from "./logger.js";

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("Reported error", { error: message, stack, ...context });
  Sentry.captureException(error, { extra: context });
}
