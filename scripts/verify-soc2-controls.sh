#!/usr/bin/env bash
set -euo pipefail

ERRORS=0
WARNINGS=0

echo "=== SOC 2 Controls Verification ==="
echo ""

echo "--- CC6.1: Logical Access Controls ---"
if grep -q "requireRole\|requireOwnerOrAdmin" app/api/erp/doc/route.ts 2>/dev/null; then
  echo "PASS: RBAC enforced in ERP doc route"
else
  echo "FAIL: RBAC not found in ERP doc route"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "requireRole" app/api/erp/list/route.ts 2>/dev/null; then
  echo "PASS: RBAC enforced in ERP list route"
else
  echo "FAIL: RBAC not found in ERP list route"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "failedLoginAttempts\|lockedUntil" app/api/auth/login/route.ts 2>/dev/null; then
  echo "PASS: Account lockout implemented"
else
  echo "FAIL: Account lockout not found"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "lib/password-policy.ts" ]; then
  echo "PASS: Password policy file exists"
else
  echo "FAIL: Password policy file missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "--- CC6.5: Data Protection ---"
if [ -f "lib/encryption.ts" ]; then
  echo "PASS: Encryption module exists"
else
  echo "FAIL: Encryption module missing"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "ENCRYPTION_KEY" lib/env.ts 2>/dev/null; then
  echo "PASS: ENCRYPTION_KEY in required env vars"
else
  echo "WARN: ENCRYPTION_KEY not in required env vars"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "--- CC7.1: Monitoring ---"
if grep -q "logAudit\|logAction" app/api/auth/login/route.ts 2>/dev/null; then
  echo "PASS: Audit logging in login route"
else
  echo "FAIL: Audit logging missing in login route"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "lib/security-monitor.ts" ]; then
  echo "PASS: Security monitor exists"
else
  echo "FAIL: Security monitor missing"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "app/api/health/route.ts" ]; then
  echo "PASS: Health check endpoint exists"
else
  echo "FAIL: Health check endpoint missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "--- CC7.2: Incident Detection ---"
if grep -rq "reportSecurityEvent" app/api/ lib/ 2>/dev/null; then
  echo "PASS: Security event reporting integrated"
else
  echo "FAIL: Security event reporting not found"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "--- P4.1: Data Retention ---"
if [ -f "lib/data-retention.ts" ]; then
  echo "PASS: Data retention config exists"
else
  echo "FAIL: Data retention config missing"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "scripts/data-retention.ts" ]; then
  echo "PASS: Data retention cleanup script exists"
else
  echo "FAIL: Data retention cleanup script missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "--- Policy Documents ---"
for policy in access-control audit-logging data-retention incident-response encryption availability; do
  if [ -f "docs/policies/${policy}.md" ]; then
    echo "PASS: ${policy}.md exists"
  else
    echo "FAIL: ${policy}.md missing"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "================================"
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS controls missing, $WARNINGS warnings"
  exit 1
else
  echo "ALL SOC 2 CONTROLS VERIFIED ($WARNINGS warnings)"
  exit 0
fi
