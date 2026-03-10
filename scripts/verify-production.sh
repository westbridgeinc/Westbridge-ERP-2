#!/usr/bin/env bash
set -euo pipefail

ERRORS=0

echo "=== Westbridge Production Readiness Check ==="

# 1. Required environment variables
for var in CSRF_SECRET DATABASE_URL ENCRYPTION_KEY ERPNEXT_URL NEXT_PUBLIC_APP_URL; do
  if [ -z "${!var:-}" ]; then
    echo "FAIL: $var is not set"
    ERRORS=$((ERRORS + 1))
  else
    echo "PASS: $var is set"
  fi
done

# 2. CSRF_SECRET is not the default
if [ "${CSRF_SECRET:-}" = "westbridge-csrf-secret" ]; then
  echo "FAIL: CSRF_SECRET is using the default value"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: CSRF_SECRET is not default"
fi

# 3. DATABASE_URL is not using default credentials
if echo "${DATABASE_URL:-}" | grep -q "postgres:postgres"; then
  echo "WARN: DATABASE_URL appears to use default credentials"
fi

# 4. No .env file with secrets
if [ -f .env ] && grep -q "CSRF_SECRET=." .env; then
  echo "FAIL: .env contains CSRF_SECRET — use environment variables instead"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: No secrets in .env"
fi

# 5. NODE_ENV is production
if [ "${NODE_ENV:-}" != "production" ]; then
  echo "FAIL: NODE_ENV is not 'production'"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: NODE_ENV is production"
fi

# 6. Build exists
if [ ! -d ".next" ]; then
  echo "FAIL: .next build directory missing — run npm run build"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: Build exists"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS checks failed. Do not deploy."
  exit 1
else
  echo "ALL CHECKS PASSED. Ready to deploy."
  exit 0
fi
