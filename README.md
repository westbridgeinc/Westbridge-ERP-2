# Westbridge ERP — Backend API

Enterprise-grade Express.js API server powering the Westbridge ERP platform.
Built for small-to-medium Caribbean businesses — invoicing, inventory, HR, payroll, CRM, and AI-powered insights.

[![CI](https://github.com/westbridge/erp-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/westbridge/erp-backend/actions/workflows/ci.yml)
[![Security](https://github.com/westbridge/erp-backend/actions/workflows/security.yml/badge.svg)](https://github.com/westbridge/erp-backend/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database](#database)
- [Background Jobs](#background-jobs)
- [Testing](#testing)
- [Deployment](#deployment)
- [Observability](#observability)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────────────┐
│   Next.js    │────▶│  Express.js API (port 4000)                     │
│  Frontend    │     │                                                  │
│  (port 3004) │◀────│  ┌─────────┐  ┌──────────┐  ┌───────────────┐  │
└──────────────┘     │  │ Routes  │─▶│ Services │─▶│ Data Clients  │  │
                     │  └─────────┘  └──────────┘  └───────┬───────┘  │
                     │       │                              │          │
                     │  ┌────▼────┐                  ┌──────▼──────┐  │
                     │  │ Middle- │                  │  PostgreSQL │  │
                     │  │  ware   │                  │  (Prisma)   │  │
                     │  └─────────┘                  └─────────────┘  │
                     │       │                              │          │
                     │  ┌────▼────┐  ┌──────────┐  ┌──────▼──────┐  │
                     │  │  Auth   │  │ BullMQ   │  │   ERPNext   │  │
                     │  │  CSRF   │  │ Workers  │  │  (v16 API)  │  │
                     │  │  RBAC   │  └────┬─────┘  └─────────────┘  │
                     │  └─────────┘       │                          │
                     │               ┌────▼─────┐                    │
                     │               │  Redis   │                    │
                     │               │ (BullMQ, │                    │
                     │               │ sessions,│                    │
                     │               │  cache)  │                    │
                     │               └──────────┘                    │
                     └──────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| **Routes** | `src/routes/` | HTTP handling, input validation, response formatting |
| **Middleware** | `src/middleware/` | Auth, CSRF, rate limiting, security headers |
| **Services** | `src/lib/services/` | Business logic, orchestration (returns `Result<T, E>`) |
| **Data Clients** | `src/lib/data/` | Database access (Prisma), external APIs (ERPNext, 2Checkout) |
| **Workers** | `src/workers/` | Background jobs — email, cleanup, webhooks, ERP sync, reports |
| **Caribbean** | `src/lib/caribbean/` | GY tax (PAYE, NIS, VAT), currency handling |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 20+ (ES modules) |
| Framework | Express.js 5 |
| Language | TypeScript 5.8 (strict mode) |
| Database | PostgreSQL 16 (Prisma ORM 6) |
| Cache / Queue | Redis 7 (ioredis + BullMQ) |
| ERP Backend | ERPNext v16 (proxied API) |
| Auth | bcrypt + JWT sessions + CSRF double-submit |
| AI | Anthropic Claude API |
| Email | Resend |
| Billing | 2Checkout |
| Logging | Pino (structured JSON) |
| Metrics | Prometheus (prom-client) |
| Tracing | OpenTelemetry |
| Error Tracking | Sentry |
| Analytics | PostHog |
| Testing | Vitest + Supertest + k6 |
| CI/CD | GitHub Actions → Fly.io |
| Container | Docker (multi-stage, non-root) |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.19.0 (see `.nvmrc`)
- **Docker Desktop** (for PostgreSQL, Redis, ERPNext)
- **npm** >= 10

### 1. Clone and install

```bash
git clone https://github.com/westbridge/erp-backend.git
cd erp-backend
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis erpnext redis-erpnext mariadb
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY
# Generate secrets: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Set up database

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed        # Seeds demo data (Westbridge Trading Ltd)
```

### 5. Start the server

```bash
npm run dev                # Hot-reload on port 4000
```

### Demo credentials

After seeding:
- **Admin:** `admin@westbridge.gy` / `Westbridge@2026#Secure`
- **Member:** `member@westbridge.gy` / `Westbridge@2026#Secure`

---

## Environment Variables

See [`.env.example`](.env.example) for the complete list with descriptions.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `PORT` | No | Server port (default: `4000`) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `FRONTEND_URL` | Yes | CORS origin (e.g., `http://localhost:3004`) |
| `SESSION_SECRET` | Yes | 64-char hex for session signing |
| `CSRF_SECRET` | Yes | 64-char hex for CSRF token HMAC |
| `ENCRYPTION_KEY` | Yes | 64-char hex for field-level encryption (supports rotation) |
| `ERPNEXT_URL` | Yes | ERPNext base URL (e.g., `http://localhost:8080`) |
| `ANTHROPIC_API_KEY` | No | Claude API key (AI features degrade gracefully) |
| `SENTRY_DSN` | No | Sentry error tracking |
| `POSTHOG_API_KEY` | No | Product analytics |

---

## API Reference

All routes are prefixed with `/api`. Full OpenAPI 3.1 spec available at `GET /api/docs`.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login with email/password |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/validate` | Validate current session |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET` | `/api/csrf` | Get CSRF token (double-submit cookie) |
| `POST` | `/api/signup` | Create new account |

### ERP Data

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/erp/list` | List documents (paginated, filtered) |
| `GET` | `/api/erp/doc` | Get single document |
| `POST` | `/api/erp/doc` | Create document |
| `PUT` | `/api/erp/doc` | Update document |
| `DELETE` | `/api/erp/doc` | Delete document |
| `GET` | `/api/erp/dashboard` | Dashboard aggregated metrics |

**Supported doctypes:** Customer, Supplier, Item, Sales Invoice, Sales Order, Purchase Order, Purchase Invoice, Quotation, Employee, Expense Claim, Payment Entry, Opportunity

### Reports

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/reports` | Enqueue report generation |
| `GET` | `/api/reports` | List completed reports |
| `GET` | `/api/reports/:jobId` | Get report status/result |

### Team & Account

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/team` | List team members |
| `POST` | `/api/invite` | Send team invite |
| `PATCH` | `/api/account/profile` | Update profile |
| `GET` | `/api/account/export` | GDPR data export |
| `DELETE` | `/api/account/delete` | GDPR account deletion |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/flags` | Feature flags |
| `GET` | `/api/admin/jobs` | BullMQ queue stats |
| `GET` | `/api/audit` | Paginated audit logs |
| `GET` | `/api/audit/export` | Export audit logs (CSV/JSON) |
| `GET` | `/api/billing/history` | Billing history |

### Operations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Comprehensive health check |
| `GET` | `/api/health/ready` | Readiness probe |
| `GET` | `/api/health/live` | Liveness probe |
| `GET` | `/api/metrics` | Prometheus metrics |
| `GET` | `/api/events/stream` | SSE real-time events |
| `POST` | `/api/ai/chat` | AI assistant |
| `GET` | `/api/docs` | OpenAPI 3.1 spec |

---

## Database

### Schema

The Prisma schema lives at [`prisma/schema.prisma`](prisma/schema.prisma). Core models:

- **Account** — Multi-tenant organization (company name, plan, modules, currency)
- **User** — Authentication (bcrypt hash, role, status, login tracking)
- **Session** — Server-side sessions with ERPNext SID relay
- **AuditLog** — Immutable audit trail (action, resource, IP, user-agent, severity)
- **Subscription** — Billing state (plan, status, trial dates)
- **WebhookEndpoint** — Outbound webhook configuration
- **InviteToken** / **PasswordResetToken** — Time-limited tokens
- **ApiKey** — API key management

### Commands

```bash
npx prisma migrate dev      # Create migration from schema changes
npx prisma migrate deploy   # Apply pending migrations (production)
npx prisma migrate status   # Check migration status
npx prisma db seed          # Seed demo data
npx prisma studio           # Visual database browser
```

---

## Background Jobs

Five BullMQ queues process work asynchronously:

| Queue | Purpose | Retry | Concurrency |
|-------|---------|-------|-------------|
| `email` | Transactional email delivery | 3x exponential | 5 |
| `cleanup` | Expired session + audit log pruning | 2x | 1 |
| `webhooks` | Outbound webhook delivery (HMAC signed) | 5x exponential | 10 |
| `erp-sync` | ERPNext document verification | 2x | 3 |
| `reports` | Async report generation (revenue, audit, activity) | 1x | 2 |

Workers start automatically with the server. Queue stats visible at `GET /api/admin/jobs`.

---

## Testing

### Unit & Integration Tests

```bash
npm test                    # Run all tests (Vitest)
npm run test:watch          # Watch mode
```

Test files live alongside source code (`*.test.ts`). Coverage thresholds enforced at 80%.

### Load Tests (k6)

```bash
npm run test:load:smoke     # Quick sanity check
npm run test:load           # Average load profile
npm run test:load:stress    # Stress test
npm run test:load:spike     # Spike test
```

### Type Checking

```bash
npm run typecheck           # tsc --noEmit (zero errors required)
```

---

## Deployment

### Docker

```bash
docker build -t westbridge-api .
docker run -p 4000:4000 --env-file .env.production westbridge-api
```

The Dockerfile uses a multi-stage build:
1. **Builder** — installs deps, generates Prisma client, compiles TypeScript
2. **Production** — minimal Alpine image, non-root user (`westbridge:1001`), health check built in

### Fly.io (Production)

Deployment is automated via GitHub Actions on push to `main`:

1. Type check + tests pass
2. Deploy to Fly.io via `flyctl`
3. Health check verification

Manual deploy: `flyctl deploy`

### Full Stack (Docker Compose)

```bash
docker compose up -d        # All services: API, PostgreSQL, Redis, ERPNext, MariaDB
```

---

## Observability

| Signal | Tool | Endpoint |
|--------|------|----------|
| Logs | Pino (JSON) | stdout |
| Metrics | Prometheus | `GET /api/metrics` |
| Traces | OpenTelemetry | OTLP exporter |
| Errors | Sentry | Automatic capture |
| Analytics | PostHog | Server-side events |

### Health Checks

- `GET /api/health` — Full check (DB, Redis, ERPNext) — returns `healthy`, `degraded`, or `unhealthy`
- `GET /api/health/ready` — Readiness probe (all critical deps)
- `GET /api/health/live` — Liveness probe (process alive)

---

## Security

- **Authentication:** bcrypt password hashing (cost 12) + server-side sessions
- **CSRF:** Double-submit cookie with HMAC validation and 1-hour expiry
- **Rate Limiting:** Tiered Redis-backed sliding window (login: 10/min, ERP: 60/min per-route, 200/min per-account)
- **Input Validation:** Zod schemas on all request bodies and query params
- **SSRF Protection:** DNS resolution check blocks private/reserved IPs on webhook delivery
- **Encryption:** AES-256-GCM field-level encryption with key rotation support
- **Headers:** Helmet.js security headers on all responses
- **RBAC:** Role-based access control (owner, admin, member, viewer)
- **Audit Trail:** Every sensitive action logged with IP, user-agent, severity
- **CI Security:** CodeQL SAST, npm audit, TruffleHog secret scanning, weekly schedule

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR requirements.

---

## License

[MIT](LICENSE)
