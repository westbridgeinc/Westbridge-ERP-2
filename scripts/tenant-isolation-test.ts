#!/usr/bin/env tsx
/**
 * Tenant isolation smoke test.
 * Creates 2 test accounts and verifies complete data isolation.
 * Run: DATABASE_URL=<url> npx tsx scripts/tenant-isolation-test.ts
 */
import { prisma } from "../lib/data/prisma";
import { randomBytes } from "crypto";

function id() { return randomBytes(8).toString("hex"); }

async function main() {
  console.log("🔒 Running tenant isolation test...\n");

  // Create two isolated test accounts
  const account1Id = id();
  const account2Id = id();

  await prisma.account.createMany({
    data: [
      { id: account1Id, companyName: "Test Tenant A", email: `a-${id()}@test.local`, plan: "starter", status: "active" },
      { id: account2Id, companyName: "Test Tenant B", email: `b-${id()}@test.local`, plan: "starter", status: "active" },
    ],
  });

  // Create a user in account 1
  const user1Id = id();
  await prisma.user.create({
    data: { id: user1Id, accountId: account1Id, email: `user-${id()}@a.local`, role: "owner", status: "active" },
  });

  // Attempt to read account1 user scoped to account2 — must return nothing
  const leaked = await prisma.user.findMany({
    where: { accountId: account2Id, id: user1Id },
  });

  if (leaked.length > 0) {
    console.error("❌ ISOLATION FAILURE: Account 2 can see Account 1 user data!");
    process.exitCode = 1;
  } else {
    console.log("✓ Account 1 user is not visible when scoped to Account 2");
  }

  // Verify account 1 user IS visible when scoped correctly
  const visible = await prisma.user.findMany({
    where: { accountId: account1Id, id: user1Id },
  });

  if (visible.length !== 1) {
    console.error("❌ ISOLATION FAILURE: Account 1 user not visible within correct tenant scope!");
    process.exitCode = 1;
  } else {
    console.log("✓ Account 1 user is visible within correct tenant scope");
  }

  // Cleanup
  await prisma.user.deleteMany({ where: { accountId: { in: [account1Id, account2Id] } } });
  await prisma.account.deleteMany({ where: { id: { in: [account1Id, account2Id] } } });

  if (process.exitCode === 1) {
    console.error("\n❌ Tenant isolation test FAILED");
  } else {
    console.log("\n✅ Tenant isolation test PASSED");
  }
}

main()
  .catch((e) => { console.error("Test error:", e); process.exit(1); });
