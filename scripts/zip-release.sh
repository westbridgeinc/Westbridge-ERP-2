#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# zip-release.sh — Create a clean distribution zip for Westbridge.
#
# Usage:
#   ./scripts/zip-release.sh [output-path]
#   Default output: ../westbridge-platform.zip
#
# ── What is excluded and why ──────────────────────────────────────────────────
#
#  node_modules/        — resolved by `npm install`; ~300 MB, not for shipping
#  .next/               — build output; rebuilt by `npm run build`
#  .git/                — version control history; not needed by recipients
#  .env / .env.local    — contains real secrets; use .env.example instead
#  .env.*.local         — per-developer local overrides
#  *.log                — debug output; ephemeral
#  coverage/            — Jest/c8 coverage reports; dev artifact
#  test-results/        — Playwright/k6 run output; dev artifact
#  *.tsbuildinfo        — TypeScript incremental build cache; regenerated
#  *.zip                — prevents zips-inside-zips from prior runs
#  .venv/ / __pycache__ — Python virtualenvs from any tooling (e.g. pre-commit)
#  .pytest_cache/       — pytest run cache
#  node_modules/.cache/ — Webpack/Turbopack build cache; not needed
#  load-tests/results/  — k6 HTML reports
#  .turbo/              — Turborepo cache
#  dist/                — any intermediate build output
#
# ── Maintenance note ─────────────────────────────────────────────────────────
# When adding a new tool/artifact directory, add an exclusion here AND update
# the comment block above explaining what it is and why it is excluded.
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

OUT="${1:-$(dirname "$(pwd)")/westbridge-platform.zip}"

echo "Building release zip → $OUT"

zip -r "$OUT" . \
  --exclude "node_modules/*" \
  --exclude ".next/*" \
  --exclude ".git/*" \
  --exclude ".env" \
  --exclude ".env.local" \
  --exclude ".env.*.local" \
  --exclude "*.log" \
  --exclude "*/coverage/*" \
  --exclude "*/test-results/*" \
  --exclude "*.tsbuildinfo" \
  --exclude "*.zip" \
  --exclude "*/.venv/*" \
  --exclude "*/__pycache__/*" \
  --exclude "*/.pytest_cache/*" \
  --exclude "*/node_modules/.cache/*" \
  --exclude "*/load-tests/results/*" \
  --exclude ".turbo/*" \
  --exclude "*/dist/*"

SIZE=$(du -sh "$OUT" | cut -f1)
echo "✓ Created $OUT ($SIZE)"
echo ""
echo "Checklist before sharing:"
echo "  - Confirm .env is NOT in the zip:    unzip -l '$OUT' | grep -E '^\\.env$'"
echo "  - Confirm no node_modules:           unzip -l '$OUT' | grep node_modules | wc -l"
echo "  - Confirm no coverage dirs:          unzip -l '$OUT' | grep coverage  | wc -l"
echo ""
echo "Recipients should run:"
echo "  npm install && cp .env.example .env && # fill in .env values"
echo "  npx prisma migrate deploy && npm run build && npm start"
