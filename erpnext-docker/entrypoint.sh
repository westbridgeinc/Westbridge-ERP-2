#!/bin/bash
set -e

SITE_NAME="${SITE_NAME:-site1.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
DB_HOST="${DB_HOST:-mariadb}"
DB_PORT="${DB_PORT:-3306}"
DB_ROOT_USER="${DB_ROOT_USER:-root}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-admin}"

# Wait for MariaDB
echo "Waiting for MariaDB at $DB_HOST:$DB_PORT..."
until timeout 2 bash -c "cat < /dev/null > /dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; do
  sleep 2
done
echo "MariaDB is up."

# Wait for Redis
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
if [ -n "$FRAPPE_REDIS_CACHE" ]; then
  _r="${FRAPPE_REDIS_CACHE#redis://}"; _r="${_r%%/*}"; REDIS_HOST="${_r%:*}"; [ "${_r#*:}" != "$_r" ] && REDIS_PORT="${_r#*:}"; fi
echo "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
until timeout 2 bash -c "cat < /dev/null > /dev/tcp/$REDIS_HOST/$REDIS_PORT" 2>/dev/null; do
  sleep 2
done
echo "Redis is up."

cd /home/frappe/frappe-bench

# Ensure bench uses remote DB (common_site_config)
bench set-config -g db_host "$DB_HOST" 2>/dev/null || true
bench set-config -g db_port "$DB_PORT" 2>/dev/null || true
bench set-config -g db_root_username "$DB_ROOT_USER" 2>/dev/null || true
bench set-config -g db_root_password "$DB_ROOT_PASSWORD" 2>/dev/null || true

SITES_DIR="/home/frappe/frappe-bench/sites"
if [ ! -d "$SITES_DIR/$SITE_NAME" ]; then
  echo "Creating site $SITE_NAME and installing ERPNext + my_white_label..."
  bench new-site "$SITE_NAME" --admin-password="$ADMIN_PASSWORD" --install-app erpnext --install-app my_white_label
  echo "Site created and apps installed."
else
  if ! bench --site "$SITE_NAME" list-apps 2>/dev/null | grep -q my_white_label; then
    echo "Installing my_white_label on existing site $SITE_NAME..."
    bench --site "$SITE_NAME" install-app my_white_label
  fi
fi

if [ $# -eq 0 ]; then
  exec bench start
else
  exec "$@"
fi
