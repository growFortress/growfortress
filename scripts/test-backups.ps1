# PowerShell script to test backup scripts
# Usage: .\scripts\test-backups.ps1

$ErrorActionPreference = "Stop"

Write-Host "Testing backup scripts..." -ForegroundColor Green
Write-Host ""

# Check if containers are running
Write-Host "Checking Docker containers..." -ForegroundColor Cyan
$postgresRunning = docker ps --filter "name=arcade-postgres" --format "{{.Names}}" | Select-String "arcade-postgres"
$redisRunning = docker ps --filter "name=arcade-redis" --format "{{.Names}}" | Select-String "arcade-redis"

if (-not $postgresRunning) {
    Write-Host "⚠ PostgreSQL container is not running" -ForegroundColor Yellow
    Write-Host "  Start with: docker-compose up -d postgres" -ForegroundColor Gray
} else {
    Write-Host "✓ PostgreSQL container is running" -ForegroundColor Green
}

if (-not $redisRunning) {
    Write-Host "⚠ Redis container is not running" -ForegroundColor Yellow
    Write-Host "  Start with: docker-compose up -d redis" -ForegroundColor Gray
} else {
    Write-Host "✓ Redis container is running" -ForegroundColor Green
}

Write-Host ""

# Check if backup directories exist
Write-Host "Checking backup directories..." -ForegroundColor Cyan
$backupDirs = @(
    "backups/postgres/full",
    "backups/postgres/wal",
    "backups/redis"
)

foreach ($dir in $backupDirs) {
    if (Test-Path $dir) {
        Write-Host "✓ $dir exists" -ForegroundColor Green
    } else {
        Write-Host "⚠ $dir does not exist" -ForegroundColor Yellow
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "  Created $dir" -ForegroundColor Gray
    }
}

Write-Host ""

# Check if scripts are executable (for Git Bash)
Write-Host "Checking backup scripts..." -ForegroundColor Cyan
$scripts = @(
    "scripts/backup-postgres.sh",
    "scripts/backup-redis.sh",
    "scripts/verify-backup.sh"
)

foreach ($script in $scripts) {
    if (Test-Path $script) {
        Write-Host "✓ $script exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $script not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "To test backups manually:" -ForegroundColor Cyan
Write-Host "  1. Open Git Bash or WSL" -ForegroundColor Gray
Write-Host "  2. cd c:/dev/arcade" -ForegroundColor Gray
Write-Host "  3. bash scripts/backup-postgres.sh full" -ForegroundColor Gray
Write-Host "  4. bash scripts/backup-redis.sh" -ForegroundColor Gray
Write-Host "  5. bash scripts/verify-backup.sh postgres" -ForegroundColor Gray
Write-Host "  6. bash scripts/verify-backup.sh redis" -ForegroundColor Gray
