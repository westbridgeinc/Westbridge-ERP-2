import { describe, it, expect } from "vitest";
import { getUptimeSeconds } from "../uptime.js";

describe("getUptimeSeconds", () => {
  it("returns a non-negative number", () => {
    expect(getUptimeSeconds()).toBeGreaterThanOrEqual(0);
  });

  it("returns an integer", () => {
    expect(Number.isInteger(getUptimeSeconds())).toBe(true);
  });
});
