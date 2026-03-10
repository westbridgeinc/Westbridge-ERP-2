/**
 * Authorization helpers. Use with session from validateSession().
 * Role hierarchy: owner > admin > member (owner and admin can manage team/billing; member is read/operate).
 */

import type { SessionRole } from "./services/session.service.js";

export type SessionWithRole = { userId: string; accountId: string; role: SessionRole };

/** Returns true if the session's role is in the allowed list. Use for route guards. */
export function requireRole(session: SessionWithRole, allowedRoles: SessionRole[]): boolean {
  return allowedRoles.includes(session.role);
}

/** Owner or admin only. Use for team invite, API key management, billing changes. */
export function requireOwnerOrAdmin(session: SessionWithRole): boolean {
  return requireRole(session, ["owner", "admin"]);
}

/** Owner only. Use for destructive account actions if needed. */
export function requireOwner(session: SessionWithRole): boolean {
  return session.role === "owner";
}
