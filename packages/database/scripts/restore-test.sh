#!/usr/bin/env bash
# Database Restoration Drill Script for Fuel Wholesale Management System (Linux/Ubuntu)
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5436}"
DB_USER="${DB_USER:-postgres}"
TEST_DB_NAME="${TEST_DB_NAME:-fuel_db_restore_test}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    LATEST_BACKUP=$(ls -t ./backups/*.sql 2>/dev/null | head -n 1 || true)
    if [ -z "$LATEST_BACKUP" ]; then
        echo "[ERROR] No backup file provided and no .sql file found in ./backups" >&2
        exit 1
    fi
    BACKUP_FILE="$LATEST_BACKUP"
fi

echo "[INFO] Starting Database Restoration Drill using backup: ${BACKUP_FILE}..."

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE ${TEST_DB_NAME};"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -f "$BACKUP_FILE"

echo "[SUCCESS] Backup restored into temporary database ${TEST_DB_NAME}."

CUSTOMER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM \"Customer\";" | tr -d ' ')
echo "[VERIFY] Restored customer count: ${CUSTOMER_COUNT}"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE ${TEST_DB_NAME};"
echo "[SUCCESS] Restoration drill completed cleanly!"
