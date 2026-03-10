# Westbridge ERP 2 — Infrastructure & Deployment

This repository contains the infrastructure, Docker configuration, ERPNext setup, deployment scripts, and database schema for the Westbridge ERP platform.

## Structure

```
├── Dockerfile                      # Multi-stage build for the Next.js app
├── docker-compose.yml              # Dev: Postgres + ERPNext (Next.js runs separately)
├── docker-compose.platform.yml     # Production: Full stack in Docker
├── docker-entrypoint.sh            # Container startup script (migrations + start)
├── erpnext-docker/                 # Headless ERPNext Docker build
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── entrypoint.sh
│   └── my_white_label/             # White-label Frappe app
├── erpnext/                        # ERPNext custom Dockerfile
├── prisma/
│   └── schema.prisma               # Database schema (PostgreSQL)
├── scripts/                        # Operational scripts
│   ├── setup.sh                    # Initial setup
│   ├── seed-staging.ts             # Seed staging data
│   ├── cleanup-sessions.ts         # Session cleanup
│   ├── cleanup-audit-logs.ts       # Audit log retention
│   ├── data-retention.ts           # Data retention policies
│   ├── verify-production.sh        # Production readiness checks
│   ├── verify-soc2-controls.sh     # SOC 2 compliance verification
│   └── ...
└── load-tests/                     # Load testing configs
```

## Quick Start

### Local Development

```bash
# Start databases + ERPNext (Next.js runs separately via `npm run dev`)
docker compose up -d

# Full platform stack
docker compose -f docker-compose.platform.yml up -d
```

### Required Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/westbridge
POSTGRES_PASSWORD=<your-password>
MYSQL_ROOT_PASSWORD=<your-password>
REDIS_PASSWORD=<your-password>
ERPNEXT_URL=https://your-erpnext-instance:8080
```

## Related

- [Westbridge ERP 1](https://github.com/westbridgeinc/Westbridge-ERP-1) — The full-stack Next.js platform (frontend + backend API)
