# Backup Strategy

## Overview

This document outlines the backup and recovery strategy for the Arcade TD infrastructure, covering PostgreSQL databases and Redis cache/queue systems.

**Current Infrastructure:**
- **PostgreSQL**: PostgreSQL 15 (local via Docker, production on Render)
- **Redis**: Redis 7 (local via Docker, production likely managed service)
- **Critical Data**: User accounts, game sessions, leaderboards, guilds, economy transactions

---

## PostgreSQL Backup Strategy

### Backup Schedule

| Backup Type | Frequency | Retention | Purpose |
|------------|-----------|-----------|---------|
| **Full Backup** | Daily at 02:00 UTC | 30 days | Complete database snapshot |
| **WAL Archiving** | Continuous | 7 days | Point-in-time recovery |
| **Weekly Full** | Sunday 01:00 UTC | 90 days | Long-term retention |
| **Monthly Full** | 1st of month 00:00 UTC | 1 year | Compliance/audit |

### Implementation

#### Local Development (Docker Compose)

**1. Enable WAL Archiving**

Update `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: arcade-postgres
    environment:
      POSTGRES_USER: arcade
      POSTGRES_PASSWORD: arcade
      POSTGRES_DB: arcade
      # WAL Archiving
      POSTGRES_INITDB_ARGS: "-c wal_level=replica"
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups/postgres:/backups
      - ./backups/postgres/wal:/var/lib/postgresql/wal_archive
    command: >
      postgres
      -c wal_level=replica
      -c archive_mode=on
      -c archive_command='test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
      -c max_wal_senders=3
      -c hot_standby=on
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arcade -d arcade"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**2. Backup Script**

Create `scripts/backup-postgres.sh`:

```bash
#!/bin/bash
# PostgreSQL backup script
# Usage: ./backup-postgres.sh [full|wal]

set -e

BACKUP_DIR="./backups/postgres"
WAL_DIR="$BACKUP_DIR/wal"
FULL_DIR="$BACKUP_DIR/full"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
RETENTION_WEEKS=12
RETENTION_MONTHS=12

# Ensure directories exist
mkdir -p "$FULL_DIR" "$WAL_DIR"

# Full backup
full_backup() {
    echo "Starting full backup at $(date)"
    
    docker exec arcade-postgres pg_dump -U arcade -F c -f "/backups/full_${DATE}.dump" arcade
    
    # Copy from container
    docker cp arcade-postgres:/backups/full_${DATE}.dump "$FULL_DIR/"
    
    # Compress
    gzip "$FULL_DIR/full_${DATE}.dump"
    
    echo "Full backup completed: full_${DATE}.dump.gz"
    
    # Cleanup old backups
    find "$FULL_DIR" -name "full_*.dump.gz" -mtime +$RETENTION_DAYS -delete
}

# WAL archive cleanup (keep last 7 days)
wal_cleanup() {
    find "$WAL_DIR" -name "*.wal" -mtime +7 -delete
}

case "$1" in
    full)
        full_backup
        ;;
    wal)
        wal_cleanup
        ;;
    *)
        echo "Usage: $0 [full|wal]"
        exit 1
        ;;
esac
```

**3. Cron Schedule**

Add to crontab (`crontab -e`):

```cron
# Daily full backup at 02:00 UTC
0 2 * * * cd /path/to/arcade && ./scripts/backup-postgres.sh full

# Weekly full backup (Sunday 01:00 UTC)
0 1 * * 0 cd /path/to/arcade && ./scripts/backup-postgres.sh full

# WAL cleanup (daily at 03:00 UTC)
0 3 * * * cd /path/to/arcade && ./scripts/backup-postgres.sh wal
```

#### Production (Render)

Render provides automatic backups for PostgreSQL databases:

1. **Automatic Daily Backups**: Enabled by default
   - Retention: 7 days (free tier), 30 days (paid plans)
   - Stored in Render's S3-compatible storage

2. **Manual Backup Trigger**:
   ```bash
   # Via Render CLI
   render backups:create --service <postgres-service-id>
   ```

3. **Point-in-Time Recovery**:
   - Available on paid plans
   - Restore to any point within retention period
   - Access via Render dashboard → Database → Backups → Restore

4. **Backup Export**:
   ```bash
   # Download backup file
   render backups:download <backup-id> --output backup.dump
   ```

**Recommended Production Setup:**
- Enable automatic daily backups (default)
- Upgrade to plan with 30+ day retention
- Enable PITR if available
- Export monthly backups to external storage (S3, etc.)

---

## Redis Persistence Strategy

### Persistence Methods

Redis supports two persistence mechanisms:

| Method | Type | Pros | Cons | Use Case |
|--------|------|------|------|----------|
| **RDB** | Snapshot | Fast, compact, minimal impact | May lose recent data | Full backups |
| **AOF** | Append-only | Durability, can replay commands | Larger files, slower | Critical data |
| **RDB + AOF** | Hybrid | Best of both | More disk I/O | Production recommended |

### Configuration

#### Local Development (Docker Compose)

Update `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: arcade-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./backups/redis:/backups
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --save 900 1
      --save 300 10
      --save 60 10000
      --dir /data
      --appenddirname appendonlydir
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Configuration Explanation:**
- `--appendonly yes`: Enable AOF persistence
- `--appendfsync everysec`: Sync AOF every second (balance between performance and durability)
- `--save 900 1`: RDB snapshot if 1 key changed in 900 seconds (15 min)
- `--save 300 10`: RDB snapshot if 10 keys changed in 300 seconds (5 min)
- `--save 60 10000`: RDB snapshot if 10000 keys changed in 60 seconds (1 min)

**Backup Script**

Create `scripts/backup-redis.sh`:

```bash
#!/bin/bash
# Redis backup script
# Usage: ./backup-redis.sh

set -e

BACKUP_DIR="./backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "Starting Redis backup at $(date)"

# Trigger RDB save
docker exec arcade-redis redis-cli BGSAVE

# Wait for save to complete
while [ "$(docker exec arcade-redis redis-cli LASTSAVE)" = "$(docker exec arcade-redis redis-cli LASTSAVE)" ]; do
    sleep 1
done

# Copy RDB file
docker cp arcade-redis:/data/dump.rdb "$BACKUP_DIR/dump_${DATE}.rdb"

# Copy AOF files
docker cp arcade-redis:/data/appendonlydir "$BACKUP_DIR/aof_${DATE}"

# Compress
tar -czf "$BACKUP_DIR/redis_${DATE}.tar.gz" -C "$BACKUP_DIR" "dump_${DATE}.rdb" "aof_${DATE}"
rm -rf "$BACKUP_DIR/dump_${DATE}.rdb" "$BACKUP_DIR/aof_${DATE}"

echo "Redis backup completed: redis_${DATE}.tar.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "redis_*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

**Cron Schedule:**

```cron
# Redis backup every 6 hours
0 */6 * * * cd /path/to/arcade && ./scripts/backup-redis.sh
```

#### Production (Managed Redis)

If using a managed Redis service (e.g., Render, Redis Cloud, AWS ElastiCache):

1. **Check Provider Features:**
   - Automatic RDB snapshots
   - AOF persistence options
   - Backup retention policies
   - Point-in-time recovery

2. **Render Redis:**
   - Automatic daily snapshots (if available)
   - Manual backup via dashboard
   - Export backup files

3. **Best Practices:**
   - Enable both RDB and AOF
   - Set appropriate `appendfsync` (everysec recommended)
   - Configure automatic snapshots
   - Export backups to external storage

---

## Point-in-Time Recovery (PITR)

### PostgreSQL PITR

Point-in-time recovery allows restoring the database to any moment within the WAL retention period.

#### Prerequisites

1. **WAL Archiving Enabled** (see PostgreSQL backup section)
2. **Base Backup** (full backup)
3. **WAL Files** from base backup time to target time

#### Recovery Process

**1. Stop PostgreSQL:**
```bash
docker stop arcade-postgres
```

**2. Restore Base Backup:**
```bash
# Restore most recent full backup before target time
docker run --rm -v arcade_postgres_data:/var/lib/postgresql/data \
  -v $(pwd)/backups/postgres/full:/backups \
  postgres:15-alpine \
  pg_restore -U arcade -d arcade -c /backups/full_YYYYMMDD_HHMMSS.dump.gz
```

**3. Configure Recovery:**
```bash
# Create recovery.conf (PostgreSQL 12+) or use postgresql.conf
docker exec arcade-postgres sh -c 'cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = '\''cp /var/lib/postgresql/wal_archive/%f %p'\''
recovery_target_time = '\''2024-01-23 14:30:00'\''
recovery_target_action = promote
EOF'
```

**4. Start PostgreSQL:**
```bash
docker start arcade-postgres
```

**5. Verify Recovery:**
```sql
-- Check recovery status
SELECT pg_is_in_recovery();

-- Check recovery target
SELECT * FROM pg_stat_recovery;
```

#### Automated PITR Script

Create `scripts/restore-postgres-pitr.sh`:

```bash
#!/bin/bash
# PostgreSQL PITR restore script
# Usage: ./restore-postgres-pitr.sh <target_timestamp>
# Example: ./restore-postgres-pitr.sh "2024-01-23 14:30:00"

set -e

TARGET_TIME="$1"
BACKUP_DIR="./backups/postgres"
FULL_DIR="$BACKUP_DIR/full"
WAL_DIR="$BACKUP_DIR/wal"

if [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 <target_timestamp>"
    echo "Example: $0 '2024-01-23 14:30:00'"
    exit 1
fi

echo "Restoring to: $TARGET_TIME"

# Find appropriate base backup
BASE_BACKUP=$(find "$FULL_DIR" -name "full_*.dump.gz" | sort -r | head -1)

if [ -z "$BASE_BACKUP" ]; then
    echo "Error: No base backup found"
    exit 1
fi

echo "Using base backup: $BASE_BACKUP"

# Stop PostgreSQL
docker stop arcade-postgres

# Restore base backup (implementation depends on your setup)
# This is a simplified example - adjust for your environment

echo "Recovery configured. Start PostgreSQL to begin recovery."
echo "Target time: $TARGET_TIME"
```

### Redis PITR

Redis doesn't support true PITR, but you can:

1. **Restore from RDB snapshot** (closest point before target time)
2. **Replay AOF commands** up to target time (requires custom tooling)
3. **Use Redis replication** with delayed replicas

**Recommended Approach:**
- Use frequent RDB snapshots (every 5-15 minutes)
- Keep AOF files for replay capability
- For critical data, consider application-level event sourcing

---

## Backup Verification

### Automated Testing

Create `scripts/verify-backup.sh`:

```bash
#!/bin/bash
# Verify backup integrity
# Usage: ./verify-backup.sh [postgres|redis]

set -e

case "$1" in
    postgres)
        echo "Verifying PostgreSQL backup..."
        BACKUP=$(ls -t ./backups/postgres/full/*.dump.gz | head -1)
        gunzip -c "$BACKUP" | pg_restore --list > /dev/null
        echo "✓ PostgreSQL backup is valid"
        ;;
    redis)
        echo "Verifying Redis backup..."
        BACKUP=$(ls -t ./backups/redis/*.tar.gz | head -1)
        tar -tzf "$BACKUP" > /dev/null
        echo "✓ Redis backup is valid"
        ;;
    *)
        echo "Usage: $0 [postgres|redis]"
        exit 1
        ;;
esac
```

**Cron Schedule:**
```cron
# Verify backups daily
0 4 * * * cd /path/to/arcade && ./scripts/verify-backup.sh postgres
0 5 * * * cd /path/to/arcade && ./scripts/verify-backup.sh redis
```

### Manual Testing

**PostgreSQL:**
```bash
# Test restore to temporary database
createdb test_restore
pg_restore -d test_restore ./backups/postgres/full/full_YYYYMMDD_HHMMSS.dump.gz
# Verify data
psql test_restore -c "SELECT COUNT(*) FROM \"User\";"
dropdb test_restore
```

**Redis:**
```bash
# Test restore to temporary Redis instance
docker run -d --name redis-test -p 6380:6379 redis:7-alpine
# Copy backup and restore
docker cp ./backups/redis/redis_YYYYMMDD_HHMMSS.tar.gz redis-test:/tmp/
docker exec redis-test sh -c "cd /tmp && tar -xzf redis_YYYYMMDD_HHMMSS.tar.gz && cp dump_*.rdb /data/dump.rdb"
# Verify
docker exec redis-test redis-cli DBSIZE
docker stop redis-test && docker rm redis-test
```

---

## Disaster Recovery Plan

### Recovery Time Objectives (RTO)

| Component | RTO Target | Current Setup |
|-----------|------------|--------------|
| PostgreSQL | < 1 hour | Daily backups + WAL (7 days) |
| Redis | < 15 minutes | RDB + AOF (6-hour backups) |
| Application | < 30 minutes | Stateless, redeploy from Git |

### Recovery Procedures

#### 1. Complete Database Loss

**PostgreSQL:**
1. Provision new PostgreSQL instance
2. Restore most recent full backup
3. Replay WAL files to latest point
4. Update `DATABASE_URL` in application
5. Verify data integrity

**Redis:**
1. Provision new Redis instance
2. Restore most recent RDB snapshot
3. Replay AOF if available
4. Update `REDIS_URL` in application
5. Verify cache integrity

#### 2. Partial Data Corruption

**PostgreSQL:**
1. Identify affected tables/rows
2. Restore from backup to temporary database
3. Export clean data
4. Import to production (selective restore)
5. Verify consistency

**Redis:**
1. Identify affected keys
2. Clear corrupted keys
3. Let application repopulate from database
4. Monitor for issues

#### 3. Point-in-Time Recovery

Follow PITR procedures above to restore to specific timestamp.

---

## Backup Storage

### Local Development

- **Location**: `./backups/`
- **Structure**:
  ```
  backups/
  ├── postgres/
  │   ├── full/          # Full backups
  │   └── wal/           # WAL archives
  └── redis/
      └── *.tar.gz       # Redis snapshots
  ```

### Production

**Recommended Storage Strategy:**

1. **Primary**: Provider-managed backups (Render, etc.)
2. **Secondary**: External S3-compatible storage
3. **Tertiary**: Off-site backup (monthly exports)

**S3 Backup Script Example:**

```bash
#!/bin/bash
# Upload backups to S3
# Requires: AWS CLI configured

BACKUP_DIR="./backups"
S3_BUCKET="s3://your-backup-bucket/arcade"
DATE=$(date +%Y%m%d)

# Upload PostgreSQL backups
aws s3 sync "$BACKUP_DIR/postgres" "$S3_BUCKET/postgres/$DATE/"

# Upload Redis backups
aws s3 sync "$BACKUP_DIR/redis" "$S3_BUCKET/redis/$DATE/"

# Set lifecycle policy (delete after 90 days)
aws s3api put-bucket-lifecycle-configuration --bucket your-backup-bucket \
  --lifecycle-configuration file://lifecycle.json
```

---

## Monitoring & Alerts

### Backup Health Checks

**1. Backup Success Monitoring:**
```bash
# Check if backup ran successfully
if [ ! -f "./backups/postgres/full/full_$(date +%Y%m%d)*.dump.gz" ]; then
    echo "ALERT: PostgreSQL backup missing for today"
    # Send alert (email, Slack, etc.)
fi
```

**2. Backup Size Monitoring:**
```bash
# Alert if backup size is suspiciously small
BACKUP_SIZE=$(du -m ./backups/postgres/full/latest.dump.gz | cut -f1)
if [ "$BACKUP_SIZE" -lt 10 ]; then
    echo "ALERT: Backup size is unusually small: ${BACKUP_SIZE}MB"
fi
```

**3. Disk Space Monitoring:**
```bash
# Alert if backup directory is running out of space
DISK_USAGE=$(df -h ./backups | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "ALERT: Backup disk usage at ${DISK_USAGE}%"
fi
```

### Integration with Application

Add backup status endpoint to health check:

```typescript
// apps/server/src/routes/health.ts
app.get('/health/backups', async (request, reply) => {
  const backupStatus = {
    postgres: {
      lastBackup: await getLastBackupTime('postgres'),
      size: await getBackupSize('postgres'),
      status: await verifyBackup('postgres'),
    },
    redis: {
      lastBackup: await getLastBackupTime('redis'),
      size: await getBackupSize('redis'),
      status: await verifyBackup('redis'),
    },
  };
  
  return reply.send(backupStatus);
});
```

---

## Best Practices

### PostgreSQL

1. ✅ **Enable WAL archiving** for PITR capability
2. ✅ **Full backups daily**, weekly, monthly
3. ✅ **Test restores regularly** (monthly)
4. ✅ **Monitor backup sizes** for anomalies
5. ✅ **Store backups off-site** (3-2-1 rule)
6. ✅ **Document recovery procedures**
7. ✅ **Automate backup verification**

### Redis

1. ✅ **Enable both RDB and AOF** for redundancy
2. ✅ **Frequent snapshots** (every 5-15 minutes)
3. ✅ **AOF with everysec** fsync (balance performance/durability)
4. ✅ **Monitor AOF file size** (rewrite if > 2GB)
5. ✅ **Test restore procedures** regularly
6. ✅ **Consider replication** for high availability

### General

1. ✅ **3-2-1 Rule**: 3 copies, 2 different media, 1 off-site
2. ✅ **Automate everything** (cron, scripts)
3. ✅ **Document procedures** (this document)
4. ✅ **Test recovery** regularly
5. ✅ **Monitor backup health** (alerts)
6. ✅ **Encrypt backups** (especially off-site)
7. ✅ **Version control** backup scripts

---

## Quick Reference

### Backup Commands

```bash
# PostgreSQL full backup
./scripts/backup-postgres.sh full

# PostgreSQL WAL cleanup
./scripts/backup-postgres.sh wal

# Redis backup
./scripts/backup-redis.sh

# Verify backups
./scripts/verify-backup.sh postgres
./scripts/verify-backup.sh redis

# Restore PostgreSQL (PITR)
./scripts/restore-postgres-pitr.sh "2024-01-23 14:30:00"
```

### Cron Schedule Summary

```cron
# PostgreSQL
0 2 * * *   ./scripts/backup-postgres.sh full      # Daily backup
0 1 * * 0   ./scripts/backup-postgres.sh full      # Weekly backup
0 3 * * *   ./scripts/backup-postgres.sh wal       # WAL cleanup
0 4 * * *   ./scripts/verify-backup.sh postgres    # Verify backup

# Redis
0 */6 * * * ./scripts/backup-redis.sh              # Every 6 hours
0 5 * * *   ./scripts/verify-backup.sh redis       # Verify backup
```

---

## Implementation Status

✅ **Completed:**
- Backup strategy documentation
- Backup scripts (`scripts/backup-postgres.sh`, `scripts/backup-redis.sh`)
- Verification scripts (`scripts/verify-backup.sh`)
- PITR helper script (`scripts/restore-postgres-pitr.sh`)
- Example docker-compose configuration (`docker-compose.backup.yml.example`)

⏳ **Next Steps:**

1. **Review and customize** backup scripts for your environment
2. **Update docker-compose.yml** with backup configuration (or use `docker-compose.backup.yml.example` as reference)
3. **Configure production backups** (Render/managed services)
4. **Set up cron/scheduled tasks** for automated backups
5. **Test backup and restore procedures** in staging environment
6. **Set up monitoring** and alerts for backup health
7. **Schedule regular backup testing** (monthly)
8. **Configure off-site backup storage** (S3, etc.)

---

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/15/backup.html)
- [PostgreSQL WAL Archiving](https://www.postgresql.org/docs/15/continuous-archiving.html)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Render Database Backups](https://render.com/docs/databases#backups)
- [3-2-1 Backup Rule](https://www.backblaze.com/blog/the-3-2-1-backup-strategy/)
