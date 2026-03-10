#!/usr/bin/env bash
# Ensures .env exists and has CSRF_SECRET set (generates one if missing).
# Run from repo root: bash scripts/ensure-env.sh

set -e
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if ! grep -q '^CSRF_SECRET=.\+' .env 2>/dev/null; then
  SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-me-$(date +%s)")
  if grep -q '^CSRF_SECRET=' .env; then
    sed -i.bak "s/^CSRF_SECRET=.*/CSRF_SECRET=$SECRET/" .env
  else
    echo "CSRF_SECRET=$SECRET" >> .env
  fi
  echo "Set CSRF_SECRET in .env"
fi

echo "Env check done. Start app with: npm run dev"
