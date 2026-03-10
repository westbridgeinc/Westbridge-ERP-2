/**
 * Master data retention cleanup. Run daily via cron.
 * - Audit logs older than DATA_RETENTION.AUDIT_LOGS_DAYS
 * - Expired sessions older than DATA_RETENTION.SESSIONS_EXPIRED_DAYS
 * Run: npx tsx scripts/data-retention.ts
 */
/* eslint-disable no-console */

import { prisma } from "@/lib/data/prisma";
import { DATA_RETENTION } from "@/lib/data-retention";

async function main() {
  const now = new Date();
  const auditCutoff = new Date(now.getTime() - DATA_RETENTION.AUDIT_LOGS_DAYS * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now.getTime() - DATA_RETENTION.SESSIONS_EXPIRED_DAYS * 24 * 60 * 60 * 1000);

  const [auditResult, sessionResult] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { timestamp: { lt: auditCutoff } } }),
    prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: sessionCutoff } }, { lastActiveAt: { lt: sessionCutoff } }] },
    }),
  ]);

  console.log(`Audit logs deleted: ${auditResult.count}`);
  console.log(`Sessions deleted: ${sessionResult.count}`);
  console.log(`Summary: ${auditResult.count + sessionResult.count} total records removed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
