/**
 * Integration test helpers — shared setup for tests that run against a real PostgreSQL database.
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { randomUUID, createHash } from "crypto";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/westbridge_test";

let prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return prisma;
}

export async function setupTestDatabase(): Promise<void> {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}

/**
 * Delete all data in dependency-safe order (children before parents).
 */
export async function cleanDatabase(): Promise<void> {
  const db = getTestPrisma();
  await db.passwordResetToken.deleteMany();
  await db.session.deleteMany();
  await db.inviteToken.deleteMany();
  await db.apiKey.deleteMany();
  await db.auditLog.deleteMany();
  await db.webhookEndpoint.deleteMany();
  await db.subscription.deleteMany();
  await db.user.deleteMany();
  await db.account.deleteMany();
}

export async function teardownTestDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// ─── Test data factories ────────────────────────────────────────────────────

export function createTestAccount(overrides: Partial<Parameters<PrismaClient["account"]["create"]>[0]["data"]> = {}) {
  return {
    email: `test-${randomUUID()}@example.com`,
    companyName: "Test Corp",
    plan: "Starter",
    status: "active",
    modulesSelected: [],
    ...overrides,
  };
}

export function createTestUser(
  accountId: string,
  overrides: Partial<Parameters<PrismaClient["user"]["create"]>[0]["data"]> = {},
) {
  return {
    accountId,
    email: `user-${randomUUID()}@example.com`,
    role: "owner",
    passwordHash: "$2b$12$testhashedpassword000000000000000000000000000000000",
    status: "active",
    ...overrides,
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
