#!/bin/sh
set -e
if command -v prisma >/dev/null 2>&1; then
  prisma migrate deploy 2>/dev/null || echo "Warning: prisma migrate failed, starting anyway"
fi
exec node server.js
