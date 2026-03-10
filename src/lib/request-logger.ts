import { logger } from "./logger.js";
import { meter } from "./metering.js";

export interface RequestLogMeta {
  requestId?: string;
  userId?: string;
  accountId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export function logRequest(
  request: Request,
  response: { status: number },
  duration: number,
  meta?: RequestLogMeta
) {
  const url = new URL(request.url);
  logger.info("http_request", {
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration_ms: duration,
    user_agent: request.headers.get("user-agent") ?? "unknown",
    ...meta,
  });

  // Meter authenticated API calls — fire-and-forget, must not block response
  if (meta?.accountId && response.status < 500) {
    meter.increment(meta.accountId, "api_calls").catch(() => {});
    if (meta.userId) {
      meter.recordActiveUser(meta.accountId, meta.userId).catch(() => {});
    }
  }
}
