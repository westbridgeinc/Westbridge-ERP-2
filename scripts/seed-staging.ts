#!/usr/bin/env tsx
/**
 * Staging data seeder — generates anonymised, production-like data.
 * Run: DATABASE_URL=<staging-db> npx tsx scripts/seed-staging.ts
 *
 * Creates:
 *  - 3 accounts (starter, professional, enterprise)
 *  - 5 users per account (owner + 4 members)
 *  - 20 sessions per account
 *  - 50 audit log entries per account
 */
import { prisma } from "../lib/data/prisma";
import { createHash, randomBytes } from "crypto";

function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function randomId() {
  return randomBytes(12).toString("hex");
}

function randomEmail(prefix: string) {
  return `${prefix}-${randomId().slice(0, 6)}@staging.westbridge.test`;
}

const PLANS = ["starter", "professional", "enterprise"] as const;

async function main() {
  console.log("🌱 Seeding staging database...");

  for (const plan of PLANS) {
    const accountId = randomId();
    const companyName = `Staging ${plan.charAt(0).toUpperCase() + plan.slice(1)} Co.`;

    await prisma.account.create({
      data: {
        id: accountId,
        companyName,
        email: randomEmail("admin"),
        plan,
        status: "active",
        erpnextCompany: companyName,
      },
    });

    // Owner + 4 members
    for (let i = 0; i < 5; i++) {
      const email = randomEmail(i === 0 ? "owner" : `member${i}`);
      await prisma.user.create({
        data: {
          id: randomId(),
          accountId,
          email,
          name: `Staging User ${i + 1}`,
          role: i === 0 ? "owner" : "member",
          status: "active",
          passwordHash: hash("Staging@Password123!"),
        },
      });
    }

    // Audit log entries
    for (let j = 0; j < 50; j++) {
      await prisma.auditLog.create({
        data: {
          accountId,
          action: ["user.login", "invoice.created", "user.invited", "settings.updated"][j % 4],
          severity: "info",
          outcome: "success",
          ipAddress: `10.0.${Math.floor(j / 10)}.${j % 256}`,
          userAgent: "Mozilla/5.0 (staging seed)",
        },
      });
    }

    console.log(`  ✓ Created account: ${companyName} (${plan})`);
  }

  console.log("\n✅ Staging seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
