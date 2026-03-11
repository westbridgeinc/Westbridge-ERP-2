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
import { publish } from "../lib/realtime.js";
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

/**
 * Supported report types and their data sources.
 * Each handler fetches data, aggregates, and returns the report payload.
 * The worker stores the result in the audit log for retrieval.
 */
const REPORT_HANDLERS: Record<
  string,
  (accountId: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  async revenue_summary(accountId, params) {
    const period = (params.period as string) ?? new Date().toISOString().slice(0, 7);
    const startDate = new Date(`${period}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    logger.info("Generating revenue summary", { accountId, period });

    const invoiceActivity = await prisma.auditLog.count({
      where: {
        accountId,
        action: "erp.doc.create",
        resource: "Sales Invoice",
        timestamp: { gte: startDate, lt: endDate },
      },
    });

    return {
      reportType: "revenue_summary",
      period,
      invoicesCreated: invoiceActivity,
      generatedAt: new Date().toISOString(),
    };
  },

  async audit_export(accountId, params) {
    const days = (params.days as number) ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    logger.info("Generating audit export", { accountId, days });

    const logs = await prisma.auditLog.findMany({
      where: { accountId, timestamp: { gte: cutoff } },
      orderBy: { timestamp: "desc" },
      take: 10_000,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        userId: true,
        ipAddress: true,
        severity: true,
        outcome: true,
        timestamp: true,
      },
    });

    return {
      reportType: "audit_export",
      days,
      rowCount: logs.length,
      rows: logs,
      generatedAt: new Date().toISOString(),
    };
  },

  async user_activity(accountId, _params) {
    logger.info("Generating user activity report", { accountId });

    const users = await prisma.user.findMany({
      where: { accountId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    const activeSessions = await prisma.session.count({
      where: {
        user: { accountId },
        expiresAt: { gt: new Date() },
      },
    });

    return {
      reportType: "user_activity",
      userCount: users.length,
      activeSessionCount: activeSessions,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  },
};

/** List of supported report types — export for API validation. */
export const SUPPORTED_REPORT_TYPES = Object.keys(REPORT_HANDLERS);

function createReportsWorker(): Worker {
  return new Worker<ReportJobData>(
    "reports",
    async (job: Job<ReportJobData>) => {
      const { accountId, reportType, params, requestedBy } = job.data;
      logger.info("Report generation started", { jobId: job.id, accountId, reportType, requestedBy });

      const handler = REPORT_HANDLERS[reportType];
      if (!handler) {
        logger.error("Unknown report type", { jobId: job.id, reportType, supported: SUPPORTED_REPORT_TYPES });
        throw new Error(`Unknown report type: ${reportType}. Supported: ${SUPPORTED_REPORT_TYPES.join(", ")}`);
      }

      try {
        const result = await handler(accountId, params);

        // Store the completed report in the audit log for retrieval by the user
        await prisma.auditLog.create({
          data: {
            accountId,
            userId: requestedBy,
            action: "report.generated",
            resource: reportType,
            resourceId: job.id ?? crypto.randomUUID(),
            ipAddress: "worker",
            userAgent: "bullmq-reports-worker",
            metadata: JSON.parse(JSON.stringify(result)),
            severity: "info",
            outcome: "success",
          },
        });

        // Notify connected clients that their report is ready
        void publish(accountId, {
          type: "report.ready",
          payload: { jobId: job.id, reportType, requestedBy },
          timestamp: new Date().toISOString(),
        });

        logger.info("Report generation completed", {
          jobId: job.id,
          reportType,
          accountId,
          rowCount: (result as Record<string, unknown>).rowCount ?? (result as Record<string, unknown>).userCount ?? 0,
        });

        return result;
      } catch (err) {
        logger.error("Report generation failed", {
          jobId: job.id,
          reportType,
          accountId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
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
