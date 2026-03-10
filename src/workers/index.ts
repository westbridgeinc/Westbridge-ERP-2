/**
 * BullMQ workers for all job queues.
 * Started from server.ts after the HTTP server is listening.
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { sendEmail } from "../lib/email/index.js";
import { prisma } from "../lib/data/prisma.js";
import type {
  EmailJobData,
  CleanupJobData,
  WebhookJobData,
  ErpSyncJobData,
  ReportJobData,
} from "../lib/jobs/queue.js";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6380),
  password: process.env.REDIS_PASSWORD,
};

// ─── Email Worker ──────────────────────────────────────────────────────────────

function createEmailWorker(): Worker {
  return new Worker<EmailJobData>(
    "email",
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, from } = job.data;
      console.log(`[email-worker] Processing job ${job.id}: sending to ${to}`);
      const result = await sendEmail({ to, subject, html, from });
      if (result.ok) {
        console.log(`[email-worker] Job ${job.id} succeeded: email sent to ${to}`);
      } else {
        console.log(`[email-worker] Job ${job.id} failed: ${result.error}`);
        throw new Error(result.error);
      }
    },
    { connection },
  );
}

// ─── Cleanup Worker ────────────────────────────────────────────────────────────

function createCleanupWorker(): Worker {
  return new Worker<CleanupJobData>(
    "cleanup",
    async (job: Job<CleanupJobData>) => {
      const { task } = job.data;
      console.log(`[cleanup-worker] Processing job ${job.id}: task=${task}`);

      if (task === "sessions") {
        const result = await prisma.session.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        console.log(`[cleanup-worker] Deleted ${result.count} expired sessions`);
      } else if (task === "audit_logs") {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const result = await prisma.auditLog.deleteMany({
          where: { timestamp: { lt: ninetyDaysAgo } },
        });
        console.log(`[cleanup-worker] Deleted ${result.count} old audit logs`);
      }
    },
    { connection },
  );
}

// ─── Webhooks Worker ───────────────────────────────────────────────────────────

function createWebhooksWorker(): Worker {
  return new Worker<WebhookJobData>(
    "webhooks",
    async (job: Job<WebhookJobData>) => {
      const { endpointId, event, payload, deliveryId } = job.data;
      console.log(`[webhooks-worker] Processing job ${job.id}: event=${event}, endpoint=${endpointId}`);

      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId },
      });

      if (!endpoint || !endpoint.enabled) {
        console.log(`[webhooks-worker] Skipping job ${job.id}: endpoint not found or disabled`);
        return;
      }

      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Delivery-Id": deliveryId,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
        }

        // Reset consecutive failures on success
        await prisma.webhookEndpoint.update({
          where: { id: endpointId },
          data: { consecutiveFailures: 0 },
        });
        console.log(`[webhooks-worker] Job ${job.id} succeeded: delivered to ${endpoint.url}`);
      } catch (err) {
        const newFailures = endpoint.consecutiveFailures + 1;
        const shouldDisable = newFailures >= 5;

        await prisma.webhookEndpoint.update({
          where: { id: endpointId },
          data: {
            consecutiveFailures: newFailures,
            ...(shouldDisable ? { enabled: false, disabledAt: new Date() } : {}),
          },
        });

        if (shouldDisable) {
          console.log(`[webhooks-worker] Endpoint ${endpointId} disabled after ${newFailures} consecutive failures`);
        }

        console.log(`[webhooks-worker] Job ${job.id} failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    },
    { connection },
  );
}

// ─── ERP Sync Worker (stub) ────────────────────────────────────────────────────

function createErpSyncWorker(): Worker {
  return new Worker<ErpSyncJobData>(
    "erp-sync",
    async (job: Job<ErpSyncJobData>) => {
      console.log(`[erp-sync-worker] Processing job ${job.id}:`, job.data);
    },
    { connection },
  );
}

// ─── Reports Worker (stub) ─────────────────────────────────────────────────────

function createReportsWorker(): Worker {
  return new Worker<ReportJobData>(
    "reports",
    async (job: Job<ReportJobData>) => {
      console.log(`[reports-worker] Processing job ${job.id}:`, job.data);
    },
    { connection },
  );
}

// ─── Start all workers ─────────────────────────────────────────────────────────

export function startWorkers(): Worker[] {
  const workers = [
    createEmailWorker(),
    createCleanupWorker(),
    createWebhooksWorker(),
    createErpSyncWorker(),
    createReportsWorker(),
  ];

  console.log(`[workers] Started ${workers.length} BullMQ workers`);
  return workers;
}
