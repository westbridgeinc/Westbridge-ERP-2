/**
 * Deletes expired sessions and sessions idle for more than 30 minutes.
 * Run: npx tsx scripts/cleanup-sessions.ts
 */
/* eslint-disable no-console */

import { prisma } from "@/lib/data/prisma";

const IDLE_MINUTES = 30;

async function main() {
  const now = new Date();
  const idleCutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000);
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { lastActiveAt: { lt: idleCutoff } }],
    },
  });
  console.log(`Deleted ${result.count} expired or idle session(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
