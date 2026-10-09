# Automated PostgreSQL Database Backup Script for Fuel Wholesale Management System
param (
    [string]$DbHost = "localhost",
    [string]$DbPort = "5436",
    [string]$DbUser = "postgres",
    [string]$DbName = "fuel_db",
    [string]$BackupDir = "./backups"
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$BackupFile = Join-Path $BackupDir "fuel_db_backup_$Timestamp.sql"

Write-Host "Starting PostgreSQL database backup for $DbName..." -ForegroundColor Cyan

# Set PGPASSWORD if needed or use environment variable
$env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }

# Execute pg_dump
try {
    pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -F p -f $BackupFile
    Write-Host "Database backup successfully created at: $BackupFile" -ForegroundColor Green
} catch {
    Write-Error "Failed to perform pg_dump database backup: $_"
}
