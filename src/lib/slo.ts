/**
 * SLO definitions and error budget tracking.
 * Rolling 30-day window — error budget consumed = (1 - availability) * window_ms.
 */

export interface SLO {
  name: string;
  description: string;
  /** Target as a fraction, e.g. 0.9995 for 99.95% */
  target: number;
  /** Rolling window in milliseconds */
  windowMs: number;
}

export const SLOs: Record<string, SLO> = {
  api_availability: {
    name: "API Availability",
    description: "Error rate < 0.05% across all endpoints",
    target: 0.9995,
    windowMs: 30 * 24 * 60 * 60 * 1000,
  },
  auth_latency_p99: {
    name: "Auth Latency p99",
    description: "p99 latency for /api/auth/* < 500ms",
    target: 0.99,
    windowMs: 30 * 24 * 60 * 60 * 1000,
  },
  erp_proxy_latency_p99: {
    name: "ERP Proxy Latency p99",
    description: "p99 latency for /api/erp/* < 2000ms",
    target: 0.99,
    windowMs: 30 * 24 * 60 * 60 * 1000,
  },
  dashboard_load_p95: {
    name: "Dashboard Load p95",
    description: "p95 latency for dashboard routes < 1500ms",
    target: 0.95,
    windowMs: 30 * 24 * 60 * 60 * 1000,
  },
};

/** Calculate remaining error budget as a fraction (0–1). */
export function remainingErrorBudget(
  slo: SLO,
  totalRequests: number,
  errorRequests: number
): number {
  if (totalRequests === 0) return 1;
  const allowedErrors = totalRequests * (1 - slo.target);
  const remaining = Math.max(0, allowedErrors - errorRequests) / allowedErrors;
  return remaining;
}

/** Format error budget as a human-readable percentage. */
export function formatErrorBudget(slo: SLO, totalRequests: number, errorRequests: number): string {
  const remaining = remainingErrorBudget(slo, totalRequests, errorRequests);
  return `${(remaining * 100).toFixed(1)}% remaining`;
}
