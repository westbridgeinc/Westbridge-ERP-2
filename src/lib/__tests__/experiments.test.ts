import { describe, it, expect } from "vitest";
import {
  EXPERIMENTS,
  assignVariant,
  chiSquaredPValue,
  isSignificant,
} from "../experiments.js";

describe("EXPERIMENTS registry", () => {
  it("has at least one experiment defined", () => {
    expect(Object.keys(EXPERIMENTS).length).toBeGreaterThanOrEqual(1);
  });

  it("each experiment has valid variant weights summing to 100", () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      const total = exp.variants.reduce((sum, v) => sum + v.weight, 0);
      expect(total).toBe(100);
    }
  });

  it("each experiment has at least 2 variants", () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      expect(exp.variants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each experiment has at least one metric", () => {
    for (const exp of Object.values(EXPERIMENTS)) {
      expect(exp.metrics.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("assignVariant", () => {
  it("returns 'control' for non-running experiments", () => {
    // All experiments in the registry are "draft" status
    expect(assignVariant("onboarding_checklist_v2", "user1")).toBe("control");
  });

  it("returns 'control' for unknown experiments", () => {
    expect(assignVariant("nonexistent", "user1")).toBe("control");
  });

  it("is deterministic: same userId + experimentId always returns same variant", () => {
    const a = assignVariant("onboarding_checklist_v2", "test-user");
    const b = assignVariant("onboarding_checklist_v2", "test-user");
    expect(a).toBe(b);
  });
});

describe("chiSquaredPValue", () => {
  it("returns 1 when there are no requests", () => {
    expect(chiSquaredPValue({ conversions: 0, exposures: 0 }, { conversions: 0, exposures: 0 })).toBe(1);
  });

  it("returns 1 when there are no conversions", () => {
    expect(chiSquaredPValue({ conversions: 0, exposures: 100 }, { conversions: 0, exposures: 100 })).toBe(1);
  });

  it("returns high p-value for equal conversion rates", () => {
    const pValue = chiSquaredPValue(
      { conversions: 50, exposures: 1000 },
      { conversions: 50, exposures: 1000 }
    );
    expect(pValue).toBeGreaterThan(0.05);
  });

  it("returns low p-value for very different conversion rates", () => {
    const pValue = chiSquaredPValue(
      { conversions: 10, exposures: 1000 },
      { conversions: 100, exposures: 1000 }
    );
    expect(pValue).toBeLessThan(0.05);
  });

  it("returns a value between 0 and 1", () => {
    const pValue = chiSquaredPValue(
      { conversions: 30, exposures: 500 },
      { conversions: 50, exposures: 500 }
    );
    expect(pValue).toBeGreaterThanOrEqual(0);
    expect(pValue).toBeLessThanOrEqual(1);
  });
});

describe("isSignificant", () => {
  it("returns true when p < 0.05", () => {
    expect(isSignificant(0.01)).toBe(true);
  });

  it("returns false when p > 0.05", () => {
    expect(isSignificant(0.10)).toBe(false);
  });

  it("returns false when p equals alpha", () => {
    expect(isSignificant(0.05)).toBe(false);
  });

  it("respects custom alpha", () => {
    expect(isSignificant(0.08, 0.10)).toBe(true);
  });
});
