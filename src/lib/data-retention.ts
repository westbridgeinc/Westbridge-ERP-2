export const DATA_RETENTION = {
  AUDIT_LOGS_DAYS: 365, // 1 year minimum for SOC 2
  SESSIONS_EXPIRED_DAYS: 30, // Clean up expired sessions after 30 days
  SOFT_DELETED_DAYS: 90, // Permanently delete soft-deleted records after 90 days
} as const;
