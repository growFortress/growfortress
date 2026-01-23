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
    
    # Check if container is running
    if ! docker ps | grep -q arcade-postgres; then
        echo "Error: PostgreSQL container is not running"
        exit 1
    fi
    
    # Create backup inside container
    docker exec arcade-postgres pg_dump -U arcade -F c -f "/backups/full_${DATE}.dump" arcade
    
    # Copy from container
    docker cp arcade-postgres:/backups/full_${DATE}.dump "$FULL_DIR/"
    
    # Compress
    if command -v gzip &> /dev/null; then
        gzip "$FULL_DIR/full_${DATE}.dump"
        echo "Full backup completed: full_${DATE}.dump.gz"
    else
        echo "Full backup completed: full_${DATE}.dump (gzip not available)"
    fi
    
    # Cleanup old backups
    find "$FULL_DIR" -name "full_*.dump.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$FULL_DIR" -name "full_*.dump" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    echo "Backup cleanup completed (retention: ${RETENTION_DAYS} days)"
}

# WAL archive cleanup (keep last 7 days)
wal_cleanup() {
    echo "Cleaning WAL archives older than 7 days..."
    find "$WAL_DIR" -name "*.wal" -mtime +7 -delete 2>/dev/null || true
    echo "WAL cleanup completed"
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
        echo "  full - Create a full database backup"
        echo "  wal  - Clean up old WAL archive files"
        exit 1
        ;;
esac
