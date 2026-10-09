# Database Restoration Drill Script for Fuel Wholesale Management System
param (
    [string]$DbHost = "localhost",
    [string]$DbPort = "5436",
    [string]$DbUser = "postgres",
    [string]$TestDbName = "fuel_db_restore_test",
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not $BackupFile) {
    # Find latest backup in ./backups directory
    $LatestBackup = Get-ChildItem -Path "./backups" -Filter "*.sql" | Sort-LastWriteTime -Descending | Select-Object -First 1
    if (-not $LatestBackup) {
        Write-Error "No backup file specified and no SQL file found in ./backups"
        exit 1
    }
    $BackupFile = $LatestBackup.FullName
}

Write-Host "Starting Database Restoration Drill using backup: $BackupFile..." -ForegroundColor Cyan

$env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }

try {
    # Drop test DB if exists and recreate
    psql -h $DbHost -p $DbPort -U $DbUser -c "DROP DATABASE IF EXISTS $TestDbName;"
    psql -h $DbHost -p $DbPort -U $DbUser -c "CREATE DATABASE $TestDbName;"

    # Restore backup into test DB
    psql -h $DbHost -p $DbPort -U $DbUser -d $TestDbName -f $BackupFile

    Write-Host "Restoration drill succeeded! Verifying database integrity..." -ForegroundColor Green

    # Run integrity verification query
    $CustomerCount = psql -h $DbHost -p $DbPort -U $DbUser -d $TestDbName -t -c "SELECT COUNT(*) FROM \"Customer\";"
    Write-Host "Restored customer count: $($CustomerCount.Trim())" -ForegroundColor Yellow

    # Drop test DB after drill
    psql -h $DbHost -p $DbPort -U $DbUser -c "DROP DATABASE $TestDbName;"
    Write-Host "Restoration drill completed cleanly!" -ForegroundColor Green
} catch {
    Write-Error "Database restoration drill failed: $_"
}
