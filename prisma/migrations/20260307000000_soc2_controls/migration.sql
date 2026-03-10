-- SOC 2 controls: AuditLog schema, User lockout fields, Session lastActiveAt

-- AuditLog: add new columns
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "outcome" TEXT NOT NULL DEFAULT 'success';

-- Backfill timestamp from created_at for existing rows (before we drop created_at)
UPDATE "audit_logs" SET "timestamp" = "created_at";

-- Drop old audit_logs indexes
DROP INDEX IF EXISTS "audit_logs_account_id_created_at_idx";
DROP INDEX IF EXISTS "audit_logs_user_id_idx";

-- Drop created_at from audit_logs
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "created_at";

-- Create new audit_logs indexes
CREATE INDEX "audit_logs_account_id_timestamp_idx" ON "audit_logs"("account_id", "timestamp");
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");
CREATE INDEX "audit_logs_severity_timestamp_idx" ON "audit_logs"("severity", "timestamp");

-- User: account lockout and password policy fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_failed_login" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP(3);

-- Session: last active tracking for idle timeout
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
