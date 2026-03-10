/**
 * Deletes audit log entries older than 365 days (SOC 2 minimum 1-year retention).
 * Run: npx tsx scripts/cleanup-audit-logs.ts
 */
/* eslint-disable no-console */

import { prisma } from "@/lib/data/prisma";

const RETENTION_DAYS = 365;

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const result = await prisma.auditLog.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });
  console.log(`Deleted ${result.count} audit log(s) older than ${RETENTION_DAYS} days.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
