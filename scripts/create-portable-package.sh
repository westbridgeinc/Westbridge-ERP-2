#!/usr/bin/env bash
# Creates a single zip in ~/Downloads with everything set to launch anywhere.
# Includes .env (with current CSRF_SECRET etc.) so unzip + ./start.sh works.

set -e
cd "$(dirname "$0")/.."
OUT="${1:-$HOME/Downloads/westbridge-platform.zip}"

echo "Creating portable package at $OUT ..."
bash scripts/ensure-env.sh 2>/dev/null || true

cd ..
zip -r "$OUT" westbridge \
  -x "westbridge/node_modules/*" \
  -x "westbridge/.next/*" \
  -x "westbridge/.git/*" \
  -x "westbridge/.venv/*" \
  -x "westbridge/lib/generated/*" \
  -x "westbridge/*.log" \
  -x "westbridge/.DS_Store"

echo "Done: $OUT"
echo "To run anywhere: unzip westbridge-platform.zip -d westbridge && cd westbridge && chmod +x start.sh && ./start.sh"
