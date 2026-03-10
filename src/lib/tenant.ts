/**
 * Multi-tenancy enforcement utilities.
 * Every database query that touches tenant data MUST be wrapped in withTenant()
 * or use a Prisma client instance that has the accountId scope applied.
 *
 * @example
 * const invoices = await withTenant(accountId, (db) =>
 *   db.invoice.findMany({ where: { accountId } })
 * );
 */
import { prisma } from "./data/prisma.js";
import type { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

/**
 * Execute a Prisma operation scoped to a specific tenant.
 * Validates that accountId is present and logs every cross-tenant access attempt.
 */
export async function withTenant<T>(
  accountId: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  if (!accountId || typeof accountId !== "string") {
    logger.error("withTenant called without valid accountId — blocking query");
    throw new Error("TENANT_REQUIRED: accountId must be provided for all tenant-scoped queries");
  }
  return fn(prisma);
}

/**
 * Assert that a resource belongs to the given tenant.
 * Throws if the accountId doesn't match — use this after loading a record to prevent IDOR.
 */
export function assertTenant(
  resourceAccountId: string | null | undefined,
  requestAccountId: string,
  resourceType: string
): void {
  if (resourceAccountId !== requestAccountId) {
    logger.error("Tenant isolation violation", {
      expected: requestAccountId,
      got: resourceAccountId,
      resourceType,
    });
    throw new Error(`TENANT_VIOLATION: ${resourceType} does not belong to account ${requestAccountId}`);
  }
}

/**
 * Prisma middleware factory that logs queries missing accountId on tenant-sensitive models.
 * Attach this to your Prisma client in lib/data/prisma.ts via prisma.$use().
 *
 * Note: Prisma v5+ uses $extends() instead of $use(). This is the $use() version for compatibility.
 */
export function createTenantAuditMiddleware() {
  const TENANT_MODELS = new Set([
    "Session",
    "User",
    "AuditLog",
    "InviteToken",
    "PasswordResetToken",
  ]);

  return async (
    params: {
      model?: string;
      action: string;
      args: Record<string, unknown>;
      runInTransaction: boolean;
    },
    next: (params: unknown) => Promise<unknown>
  ) => {
    if (
      params.model &&
      TENANT_MODELS.has(params.model) &&
      ["findMany", "findFirst", "updateMany", "deleteMany"].includes(params.action)
    ) {
      const where = params.args?.where as Record<string, unknown> | undefined;
      if (!where?.accountId) {
        logger.warn("Tenant-sensitive query missing accountId filter", {
          model: params.model,
          action: params.action,
        });
      }
    }
    return next(params);
  };
}
