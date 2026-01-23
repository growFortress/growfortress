#!/bin/bash
# Redis backup script
# Usage: ./backup-redis.sh

set -e

BACKUP_DIR="./backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "Starting Redis backup at $(date)"

# Check if container is running
if ! docker ps | grep -q arcade-redis; then
    echo "Error: Redis container is not running"
    exit 1
fi

# Trigger RDB save
echo "Triggering RDB save..."
docker exec arcade-redis redis-cli BGSAVE

# Wait for save to complete (check LASTSAVE timestamp)
LAST_SAVE=$(docker exec arcade-redis redis-cli LASTSAVE)
echo "Waiting for save to complete (last save: $LAST_SAVE)..."

while true; do
    CURRENT_SAVE=$(docker exec arcade-redis redis-cli LASTSAVE)
    if [ "$CURRENT_SAVE" != "$LAST_SAVE" ]; then
        break
    fi
    sleep 1
done

echo "RDB save completed"

# Copy RDB file
if docker exec arcade-redis test -f /data/dump.rdb; then
    docker cp arcade-redis:/data/dump.rdb "$BACKUP_DIR/dump_${DATE}.rdb"
    echo "Copied RDB file"
else
    echo "Warning: dump.rdb not found in container"
fi

# Copy AOF files if they exist
if docker exec arcade-redis test -d /data/appendonlydir; then
    docker cp arcade-redis:/data/appendonlydir "$BACKUP_DIR/aof_${DATE}"
    echo "Copied AOF files"
fi

# Compress if tar is available
if command -v tar &> /dev/null; then
    cd "$BACKUP_DIR"
    tar -czf "redis_${DATE}.tar.gz" "dump_${DATE}.rdb" "aof_${DATE}" 2>/dev/null || \
    tar -czf "redis_${DATE}.tar.gz" "dump_${DATE}.rdb" 2>/dev/null || true
    rm -f "dump_${DATE}.rdb"
    rm -rf "aof_${DATE}"
    echo "Redis backup completed: redis_${DATE}.tar.gz"
else
    echo "Redis backup completed (files in $BACKUP_DIR, tar not available)"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "redis_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "dump_*.rdb" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "aof_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true

echo "Backup cleanup completed (retention: ${RETENTION_DAYS} days)"
