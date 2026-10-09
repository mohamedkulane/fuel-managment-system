#!/usr/bin/env bash
# Automated PostgreSQL Database Backup Script for Fuel Wholesale Management System (Linux/Ubuntu)
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5436}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-fuel_db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/fuel_db_backup_${TIMESTAMP}.sql"

echo "[INFO] Starting PostgreSQL database backup for database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "$BACKUP_FILE"; then
    echo "[SUCCESS] Database backup created at: ${BACKUP_FILE}"
else
    echo "[ERROR] Database backup failed!" >&2
    exit 1
fi
