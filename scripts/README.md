# Backup Scripts

This directory contains backup and recovery scripts for PostgreSQL and Redis.

## Scripts

### `backup-postgres.sh`
Creates full PostgreSQL database backups.

**Usage:**
```bash
./backup-postgres.sh full    # Create full backup
./backup-postgres.sh wal     # Clean up old WAL files
```

**Features:**
- Creates compressed database dumps
- Automatic cleanup of old backups (30 day retention)
- Container-aware (checks if PostgreSQL is running)

### `backup-redis.sh`
Creates Redis backups (RDB + AOF).

**Usage:**
```bash
./backup-redis.sh
```

**Features:**
- Triggers RDB snapshot
- Copies AOF files if available
- Creates compressed tar archive
- Automatic cleanup (7 day retention)

### `verify-backup.sh`
Verifies backup file integrity.

**Usage:**
```bash
./verify-backup.sh postgres  # Verify PostgreSQL backup
./verify-backup.sh redis     # Verify Redis backup
```

**Features:**
- Checks file compression integrity
- Validates backup contents (if tools available)
- Reports backup status

### `restore-postgres-pitr.sh`
Point-in-time recovery helper for PostgreSQL.

**Usage:**
```bash
./restore-postgres-pitr.sh "2024-01-23 14:30:00"
```

**Warning:** This script will stop your PostgreSQL container. Use with caution.

**Features:**
- Finds appropriate base backup
- Guides through PITR process
- Safety prompts before destructive operations

## Setup

### 1. Make scripts executable (Linux/Mac)
```bash
chmod +x scripts/*.sh
```

### 2. Windows (Git Bash/WSL)
Scripts should work in Git Bash or WSL. For native PowerShell, consider creating `.ps1` equivalents.

### 3. Configure Cron (Linux/Mac)

Add to crontab (`crontab -e`):

```cron
# PostgreSQL daily backup at 02:00 UTC
0 2 * * * cd /path/to/arcade && ./scripts/backup-postgres.sh full

# Redis backup every 6 hours
0 */6 * * * cd /path/to/arcade && ./scripts/backup-redis.sh

# Verify backups daily
0 4 * * * cd /path/to/arcade && ./scripts/verify-backup.sh postgres
0 5 * * * cd /path/to/arcade && ./scripts/verify-backup.sh redis
```

### 4. Windows Task Scheduler

Create scheduled tasks for:
- `backup-postgres.sh full` - Daily at 2:00 AM
- `backup-redis.sh` - Every 6 hours
- `verify-backup.sh` - Daily at 4:00 AM

## Requirements

- Docker (for container access)
- PostgreSQL client tools (for verification)
- tar/gzip (for compression)
- Bash (Git Bash on Windows)

## Backup Locations

- PostgreSQL: `./backups/postgres/full/`
- Redis: `./backups/redis/`
- WAL Archives: `./backups/postgres/wal/`

## See Also

- [Backup Strategy Documentation](../docs/BACKUP-STRATEGY.md)
- [Docker Compose Backup Example](../docker-compose.backup.yml.example)
