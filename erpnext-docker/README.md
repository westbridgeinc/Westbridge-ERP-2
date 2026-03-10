# ERPNext Docker with Custom Theme App (my_white_label)

This setup packages **Frappe/ERPNext** with a custom theme app that overrides the default logo, favicon, and login screen colors. It uses the **official `frappe/erpnext`** Docker image as the base and adds the custom app at build time.

## Contents

- **`my_white_label/`** — Frappe app that provides:
  - Custom logo and favicon (replace placeholders in `my_white_label/public/images/`)
  - Login page theme (CSS variables in `my_white_label/public/css/login_theme.css`)
- **`Dockerfile`** — Builds a custom image from `frappe/erpnext:v16` and installs `my_white_label`.
- **`docker-compose.yml`** — Orchestrates MariaDB, Redis, and the custom ERPNext image; one-command launch.
- **`entrypoint.sh`** — Waits for DB/Redis, creates the site if missing, and installs `my_white_label` automatically.

## Prerequisites

- Docker and Docker Compose v2
- At least 4 GB RAM (8 GB+ recommended for production)

## Build the custom image

From this directory (`erpnext-docker/`):

```bash
docker compose build
```

Or build with a specific ERPNext version:

```bash
docker build --build-arg ERPNEXT_VERSION=v16 -t erpnext-my-whitelabel:latest .
```

## One-command launch

Start the entire stack (MariaDB, Redis, ERPNext with theme app):

```bash
docker compose up -d
```

- **ERPNext UI:** http://localhost:8080  
- **Default site:** `site1.local` (or set `SITE_NAME` in the compose file)  
- **Login:** Administrator / `admin` (or set `ADMIN_PASSWORD` in the compose file)

## Auto-configuration

On first run, the entrypoint:

1. Waits for MariaDB and Redis to be ready.
2. Creates the site (e.g. `site1.local`) if it does not exist.
3. Installs **ERPNext** and **my_white_label** on the new site.
4. Starts the bench.

If the site already exists (e.g. from a previous run with the same volume), it only ensures `my_white_label` is installed, then starts.

## Customize branding

1. **Logo and favicon**  
   Replace the placeholder files in `my_white_label/my_white_label/public/images/`:
   - `logo.png` — e.g. 200×60 px
   - `favicon.ico` — e.g. 32×32 px  

   Then rebuild the image: `docker compose build erpnext`.

2. **Login screen colors**  
   Edit `my_white_label/my_white_label/public/css/login_theme.css` and change the CSS variables (`--primary`, `--login-bg`, etc.). Rebuild the image after changes.

## Environment variables (docker-compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `SITE_NAME` | `site1.local` | Frappe site name |
| `ADMIN_PASSWORD` | `admin` | Administrator password for new site |
| `DB_HOST` | `mariadb` | MariaDB service name |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_ROOT_USER` | `root` | MariaDB root user |
| `DB_ROOT_PASSWORD` | `admin` | MariaDB root password |
| `FRAPPE_REDIS_*` | (see compose) | Redis URLs for cache, queue, socketio |

## Volumes

- **erpnext-mariadb-data** — MariaDB data (persistent).
- **erpnext-sites** — Frappe sites and apps (persistent). Deleting this volume will remove the site; you will get a new site on next `up`.

## Useful commands

```bash
# View logs
docker compose logs -f erpnext

# Shell into the ERPNext container
docker compose exec erpnext bash

# Rebuild after changing my_white_label
docker compose build erpnext && docker compose up -d erpnext erpnext-worker

# Stop everything
docker compose down
```

## Files summary

| File | Purpose |
|------|---------|
| `docker-compose.yml` | MariaDB, Redis, custom ERPNext image + worker; one-command `up -d`. |
| `Dockerfile` | FROM `frappe/erpnext:v16`; copies and installs `my_white_label`; custom entrypoint. |
| `entrypoint.sh` | Wait for DB/Redis; create site and install apps; then run CMD. |
| `my_white_label/` | Frappe theme app (logo, favicon, login CSS). |
