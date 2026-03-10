/**
 * Validate required environment variables at runtime.
 * Call from API routes or a startup check so missing config fails fast.
 */

const required = [
  "DATABASE_URL",
  "CSRF_SECRET",
  "ENCRYPTION_KEY",
] as const;

const requiredInProduction = [
  "ERPNEXT_URL",
  "TWOCO_MERCHANT_CODE",
  "TWOCO_SECRET_WORD",
] as const;

const optional = [
  "REDIS_URL",
  "SYSTEM_ACCOUNT_ID",
  "ERPNEXT_URL",
  "NEXT_PUBLIC_APP_URL",
  "TWOCO_MERCHANT_CODE",
  "TWOCO_SECRET_WORD",
  "TWOCO_LINK_STARTER",
  "TWOCO_LINK_PROFESSIONAL",
  "TWOCO_LINK_ENTERPRISE",
  "TWOCO_LINK_GROWTH",
  "TWOCO_LINK_BUSINESS",
] as const;

export function validateEnv(): { ok: true } | { ok: false; missing: string[] } {
  const toCheck = [
    ...required,
    ...(process.env.NODE_ENV === "production" ? requiredInProduction : []),
  ];
  const missing = toCheck.filter((key) => {
    const v = process.env[key];
    return v === undefined || v === "";
  });
  if (missing.length > 0) return { ok: false, missing: [...missing] };
  return { ok: true };
}

export function getEnvSummary(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of [...required, ...optional]) {
    const v = process.env[key];
    out[key] = v !== undefined && v !== "";
  }
  return out;
}
