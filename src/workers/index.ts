/**
 * BullMQ workers for all job queues.
 * Started from server.ts after the HTTP server is listening.
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { createHmac } from "crypto";
import { sendEmail } from "../lib/email/index.js";
import { prisma } from "../lib/data/prisma.js";
import { logger } from "../lib/logger.js";
import { DATA_RETENTION } from "../lib/data-retention.js";
import { erpGet } from "../lib/data/erpnext.client.js";
import { decrypt } from "../lib/encryption.js";
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
      logger.info("Processing email job", { jobId: job.id, to, subject });
      const result = await sendEmail({ to, subject, html, from });
      if (result.ok) {
        logger.info("Email sent", { jobId: job.id, to });
      } else {
        logger.error("Email send failed", { jobId: job.id, to, error: result.error });
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
      logger.info("Processing cleanup job", { jobId: job.id, task });

      if (task === "sessions") {
        const result = await prisma.session.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        logger.info("Deleted expired sessions", { jobId: job.id, count: result.count });
      } else if (task === "audit_logs") {
        const cutoff = new Date(Date.now() - DATA_RETENTION.AUDIT_LOGS_DAYS * 24 * 60 * 60 * 1000);
        const result = await prisma.auditLog.deleteMany({
          where: { timestamp: { lt: cutoff } },
        });
        logger.info("Deleted old audit logs", { jobId: job.id, count: result.count, retentionDays: DATA_RETENTION.AUDIT_LOGS_DAYS });
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
      logger.info("Processing webhook job", { jobId: job.id, event, endpointId });

      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId },
      });

      if (!endpoint || !endpoint.enabled) {
        logger.warn("Skipping webhook: endpoint not found or disabled", { jobId: job.id, endpointId });
        return;
      }

      try {
        const secret = decrypt(endpoint.secret);
        const bodyStr = JSON.stringify(payload);
        const signature = createHmac("sha256", secret).update(bodyStr).digest("hex");

        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Delivery-Id": deliveryId,
            "X-Webhook-Signature": signature,
          },
          body: bodyStr,
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
        logger.info("Webhook delivered", { jobId: job.id, url: endpoint.url });
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
          logger.warn("Webhook endpoint disabled after consecutive failures", { endpointId, consecutiveFailures: newFailures });
        }

        logger.error("Webhook delivery failed", { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
    { connection },
  );
}

// ─── ERP Sync Worker ───────────────────────────────────────────────────────────

function createErpSyncWorker(): Worker {
  return new Worker<ErpSyncJobData>(
    "erp-sync",
    async (job: Job<ErpSyncJobData>) => {
      const { accountId, doctype, name, erpnextSessionId } = job.data;
      logger.info("Processing ERP sync job", { jobId: job.id, accountId, doctype, name });

      try {
        const result = await erpGet(doctype, name, erpnextSessionId, accountId);

        if (result.ok) {
          logger.info("ERP document synced", { jobId: job.id, accountId, doctype, name });
        } else {
          logger.error("ERP sync failed: document fetch error", { jobId: job.id, accountId, doctype, name, error: result.error });
          throw new Error(result.error);
        }
      } catch (err) {
        logger.error("ERP sync job error", { jobId: job.id, accountId, doctype, name, error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
    { connection },
  );
}

// ─── Reports Worker ────────────────────────────────────────────────────────────

function createReportsWorker(): Worker {
  return new Worker<ReportJobData>(
    "reports",
    async (job: Job<ReportJobData>) => {
      const { accountId, reportType, params, requestedBy } = job.data;
      logger.info("Report generation requested", { jobId: job.id, accountId, reportType, requestedBy, params });
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

  logger.info("Started BullMQ workers", { count: workers.length });
  return workers;
}
