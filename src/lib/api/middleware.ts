/**
 * Route-level middleware helpers for API routes (Express).
 * Most routes now use requireAuth from src/middleware/auth.ts directly.
 * This module is kept for utility functions.
 */

import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../services/session.service.js";
import { hasPermission, type Permission } from "../rbac.js";
import { apiError, apiMeta, getRequestId } from "../../types/api.js";
import { COOKIE } from "../constants.js";
import { logAudit } from "../services/audit.service.js";
import type { SessionRole } from "../services/session.service.js";
import { toWebRequest } from "../../middleware/auth.js";

type SessionData = { userId: string; accountId: string; role: SessionRole; erpnextSid?: string | null };

type PermissionCheckOk = {
  ok: true;
  session: SessionData;
};

type PermissionCheckFail = {
  ok: false;
  response: { status: number; body: unknown };
};

type PermissionCheck = PermissionCheckOk | PermissionCheckFail;

/**
 * Validates session and checks that the caller holds the required permission.
 * For Express: use requireAuth middleware instead. This is kept for legacy compatibility.
 */
export async function withPermission(
  req: Request,
  permission: Permission
): Promise<PermissionCheck> {
  const fakeRequest = toWebRequest(req);
  const requestId = getRequestId(fakeRequest);
  const meta = apiMeta({ request_id: requestId });

  const token = req.cookies?.[COOKIE.SESSION_NAME];
  const sessionResult = token ? await validateSession(token, fakeRequest) : null;

  if (!sessionResult?.ok) {
    return {
      ok: false,
      response: {
        status: 401,
        body: apiError("UNAUTHORIZED", "Authentication required", undefined, meta),
      },
    };
  }

  const session = sessionResult.data;

  if (!hasPermission(session.role as SessionRole, permission)) {
    await logAudit({
      action: "permission.denied",
      userId: session.userId,
      accountId: session.accountId,
      ipAddress: req.headers["x-forwarded-for"] as string ?? "unknown",
      severity: "warn",
      outcome: "failure",
      metadata: {
        required: permission,
        actual_role: session.role,
        path: req.path,
      },
    }).catch(() => {});

    return {
      ok: false,
      response: {
        status: 403,
        body: apiError("FORBIDDEN", "Insufficient permissions", undefined, meta),
      },
    };
  }

  return { ok: true, session };
}
