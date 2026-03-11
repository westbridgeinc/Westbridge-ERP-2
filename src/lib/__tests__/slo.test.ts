import { describe, it, expect } from "vitest";
import { SLOs, remainingErrorBudget, formatErrorBudget } from "../slo.js";

describe("SLO definitions", () => {
  it("defines api_availability", () => {
    expect(SLOs.api_availability).toBeDefined();
    expect(SLOs.api_availability.target).toBe(0.9995);
  });

  it("all SLOs have targets between 0 and 1", () => {
    for (const slo of Object.values(SLOs)) {
      expect(slo.target).toBeGreaterThan(0);
      expect(slo.target).toBeLessThanOrEqual(1);
    }
  });

  it("all SLOs have 30-day windows", () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    for (const slo of Object.values(SLOs)) {
      expect(slo.windowMs).toBe(thirtyDaysMs);
    }
  });

  it("all SLOs have name and description", () => {
    for (const slo of Object.values(SLOs)) {
      expect(slo.name.length).toBeGreaterThan(0);
      expect(slo.description.length).toBeGreaterThan(0);
    }
  });
});

describe("remainingErrorBudget", () => {
  const slo = SLOs.api_availability; // 99.95% target

  it("returns 1 when no requests have been made", () => {
    expect(remainingErrorBudget(slo, 0, 0)).toBe(1);
  });

  it("returns 1 when there are zero errors", () => {
    expect(remainingErrorBudget(slo, 10000, 0)).toBe(1);
  });

  it("returns 0 when error budget is fully consumed", () => {
    // 99.95% target → 0.05% allowed → 5 errors per 10000
    const result = remainingErrorBudget(slo, 10000, 5);
    expect(result).toBe(0);
  });

  it("returns ~0.5 when half the budget is consumed", () => {
    // 10000 requests * 0.0005 = 5 allowed errors. 2.5 errors = 50% remaining
    const result = remainingErrorBudget(slo, 10000, 2.5);
    expect(result).toBeCloseTo(0.5, 2);
  });

  it("never returns negative", () => {
    const result = remainingErrorBudget(slo, 10000, 100); // way over budget
    expect(result).toBe(0);
  });
});

describe("formatErrorBudget", () => {
  it("formats remaining budget as percentage", () => {
    const result = formatErrorBudget(SLOs.api_availability, 10000, 0);
    expect(result).toBe("100.0% remaining");
  });

  it("formats zero budget", () => {
    const result = formatErrorBudget(SLOs.api_availability, 10000, 5);
    expect(result).toBe("0.0% remaining");
  });
});
