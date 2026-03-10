/**
 * A/B experimentation infrastructure.
 * - Deterministic variant assignment: HMAC(userId + experimentId) → bucket
 * - Exposure and conversion event tracking
 * - Statistical significance helpers (Chi-squared for binary outcomes)
 */
import { createHmac } from "crypto";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Variant {
  id: string;
  /** Relative weight (e.g. 50 = 50%). All weights must sum to 100. */
  weight: number;
}

export interface Experiment {
  id: string;
  name: string;
  variants: Variant[];
  metrics: string[];
  status: "draft" | "running" | "paused" | "completed";
  startDate: Date;
  endDate?: Date;
}

export interface ExposureEvent {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: string;
}

export interface ConversionEvent {
  experimentId: string;
  variantId: string;
  userId: string;
  eventName: string;
  value?: number;
  timestamp: string;
}

// ─── In-code experiment registry ─────────────────────────────────────────────

export const EXPERIMENTS: Record<string, Experiment> = {
  onboarding_checklist_v2: {
    id: "onboarding_checklist_v2",
    name: "Onboarding Checklist V2",
    variants: [
      { id: "control", weight: 50 },
      { id: "guided_tour", weight: 50 },
    ],
    metrics: ["onboarding.completed", "first_invoice.created"],
    status: "draft",
    startDate: new Date("2025-01-01"),
  },
  pricing_cta_copy: {
    id: "pricing_cta_copy",
    name: "Pricing CTA Copy Test",
    variants: [
      { id: "control", weight: 50 },
      { id: "start_free", weight: 50 },
    ],
    metrics: ["signup.started", "signup.completed"],
    status: "draft",
    startDate: new Date("2025-01-01"),
  },
};

// ─── Assignment ───────────────────────────────────────────────────────────────

/**
 * Deterministically assign a user to a variant.
 * The same userId + experimentId always returns the same variant.
 */
export function assignVariant(experimentId: string, userId: string): string {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment || experiment.status !== "running") return "control";

  // Hash into a 0–99 bucket
  const hmac = createHmac("sha256", experimentId).update(userId).digest("hex");
  const bucket = parseInt(hmac.slice(0, 8), 16) % 100;

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) return variant.id;
  }
  return experiment.variants[0]?.id ?? "control";
}

// ─── Event tracking ──────────────────────────────────────────────────────────

export function trackExposure(event: ExposureEvent): void {
  logger.info("experiment.exposure", {
    experimentId: event.experimentId,
    variantId: event.variantId,
    userId: event.userId,
  });
}

export function trackConversion(event: ConversionEvent): void {
  logger.info("experiment.conversion", {
    experimentId: event.experimentId,
    variantId: event.variantId,
    userId: event.userId,
    eventName: event.eventName,
    value: event.value,
  });
}

// ─── Statistical significance (Chi-squared) ──────────────────────────────────

export interface BinaryMetrics {
  conversions: number;
  exposures: number;
}

/**
 * Chi-squared test for 2 variants with binary outcome.
 * Returns p-value. Common threshold: p < 0.05 for significance.
 */
export function chiSquaredPValue(control: BinaryMetrics, variant: BinaryMetrics): number {
  const n = control.exposures + variant.exposures;
  const k = control.conversions + variant.conversions;
  if (n === 0 || k === 0) return 1;

  const e11 = (control.exposures * k) / n;
  const e12 = (control.exposures * (n - k)) / n;
  const e21 = (variant.exposures * k) / n;
  const e22 = (variant.exposures * (n - k)) / n;

  const observed = [
    [control.conversions, control.exposures - control.conversions],
    [variant.conversions, variant.exposures - variant.conversions],
  ];
  const expected = [[e11, e12], [e21, e22]];

  let chi2 = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const o = observed[i][j];
      const e = expected[i][j];
      if (e > 0) chi2 += ((o - e) ** 2) / e;
    }
  }

  // Approximate p-value for chi2 with df=1 using the incomplete gamma function approximation
  // p ≈ e^(-chi2/2) for df=1 (accurate for chi2 > 3.84 which is the 95% threshold)
  return Math.exp(-chi2 / 2);
}

export function isSignificant(pValue: number, alpha = 0.05): boolean {
  return pValue < alpha;
}
