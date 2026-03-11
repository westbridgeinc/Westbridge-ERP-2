import { describe, it, expect } from "vitest";
import { requireRole, requireOwnerOrAdmin, requireOwner } from "../auth.js";
import type { SessionWithRole } from "../auth.js";

function makeSession(role: string): SessionWithRole {
  return { userId: "u1", accountId: "a1", role: role as SessionWithRole["role"] };
}

describe("requireRole", () => {
  it("returns true when role is in the allowed list", () => {
    expect(requireRole(makeSession("admin"), ["admin", "owner"])).toBe(true);
  });

  it("returns false when role is not in the allowed list", () => {
    expect(requireRole(makeSession("member"), ["admin", "owner"])).toBe(false);
  });

  it("works for single-role allow lists", () => {
    expect(requireRole(makeSession("owner"), ["owner"])).toBe(true);
    expect(requireRole(makeSession("admin"), ["owner"])).toBe(false);
  });
});

describe("requireOwnerOrAdmin", () => {
  it("allows owner", () => {
    expect(requireOwnerOrAdmin(makeSession("owner"))).toBe(true);
  });

  it("allows admin", () => {
    expect(requireOwnerOrAdmin(makeSession("admin"))).toBe(true);
  });

  it("rejects member", () => {
    expect(requireOwnerOrAdmin(makeSession("member"))).toBe(false);
  });

  it("rejects viewer", () => {
    expect(requireOwnerOrAdmin(makeSession("viewer"))).toBe(false);
  });
});

describe("requireOwner", () => {
  it("allows owner", () => {
    expect(requireOwner(makeSession("owner"))).toBe(true);
  });

  it("rejects admin", () => {
    expect(requireOwner(makeSession("admin"))).toBe(false);
  });

  it("rejects member", () => {
    expect(requireOwner(makeSession("member"))).toBe(false);
  });
});
