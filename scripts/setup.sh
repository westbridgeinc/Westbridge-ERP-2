#!/bin/bash
# One-command local development setup.
# Installs deps, starts Docker services, runs migrations, seeds DB, starts dev server.
set -e

echo "🚀 Westbridge local setup"
echo ""

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 20 ]; then echo "❌ Node.js 20+ required, found $NODE_VER"; exit 1; fi

# 2. Copy env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example"
  echo "   ⚠️  Set ENCRYPTION_KEY, SESSION_SECRET, CSRF_SECRET before continuing"
  echo "   Run: openssl rand -hex 32  (for ENCRYPTION_KEY and SESSION_SECRET)"
  echo "   Run: openssl rand -base64 32  (for CSRF_SECRET)"
  echo ""
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Start Docker services
echo "🐳 Starting Docker services (postgres + redis)..."
docker-compose up -d postgres redis
echo "   Waiting for postgres..."
until docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
echo "   ✓ Postgres ready"

# 5. Generate Prisma client + run migrations
echo "🗄️  Running database migrations..."
npx prisma generate
npx prisma migrate deploy
echo "   ✓ Migrations applied"

# 6. Start dev server
echo ""
echo "✅ Setup complete! Starting dev server..."
echo "   App:     http://localhost:3000"
echo "   Health:  http://localhost:3000/api/health"
echo "   API docs: http://localhost:3000/api/docs"
echo ""
npm run dev
