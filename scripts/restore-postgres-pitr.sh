#!/bin/bash
# PostgreSQL PITR restore script
# Usage: ./restore-postgres-pitr.sh <target_timestamp>
# Example: ./restore-postgres-pitr.sh "2024-01-23 14:30:00"
#
# WARNING: This script will stop and modify your PostgreSQL container!
# Use with caution. Test in a non-production environment first.

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

echo "=========================================="
echo "PostgreSQL Point-in-Time Recovery"
echo "=========================================="
echo "Target time: $TARGET_TIME"
echo ""
echo "WARNING: This will stop your PostgreSQL container!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

# Check if container exists
if ! docker ps -a | grep -q arcade-postgres; then
    echo "Error: PostgreSQL container not found"
    exit 1
fi

# Find appropriate base backup (most recent before target time)
echo "Searching for base backup..."
BASE_BACKUP=$(find "$FULL_DIR" -name "full_*.dump.gz" -type f | sort -r | head -1)

if [ -z "$BASE_BACKUP" ]; then
    BASE_BACKUP=$(find "$FULL_DIR" -name "full_*.dump" -type f | sort -r | head -1)
fi

if [ -z "$BASE_BACKUP" ]; then
    echo "Error: No base backup found in $FULL_DIR"
    exit 1
fi

echo "Found base backup: $BASE_BACKUP"

# Check if WAL directory exists
if [ ! -d "$WAL_DIR" ]; then
    echo "Warning: WAL directory not found: $WAL_DIR"
    echo "PITR requires WAL archiving. Continuing with base backup only..."
fi

echo ""
echo "Recovery steps:"
echo "1. Stop PostgreSQL container"
echo "2. Restore base backup"
echo "3. Configure recovery to target time: $TARGET_TIME"
echo "4. Start PostgreSQL (will automatically recover)"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read -r

# Stop PostgreSQL
echo "Stopping PostgreSQL container..."
docker stop arcade-postgres || true

echo ""
echo "=========================================="
echo "Manual Recovery Steps Required"
echo "=========================================="
echo ""
echo "Due to the complexity of PITR, manual steps are required:"
echo ""
echo "1. Restore base backup:"
if [[ "$BASE_BACKUP" == *.gz ]]; then
    echo "   gunzip -c $BASE_BACKUP | docker exec -i arcade-postgres pg_restore -U arcade -d arcade"
else
    echo "   docker exec -i arcade-postgres pg_restore -U arcade -d arcade < $BASE_BACKUP"
fi
echo ""
echo "2. Configure recovery (PostgreSQL 12+):"
echo "   Create recovery.conf or update postgresql.conf with:"
echo "   restore_command = 'cp $WAL_DIR/%f %p'"
echo "   recovery_target_time = '$TARGET_TIME'"
echo "   recovery_target_action = 'promote'"
echo ""
echo "3. Start PostgreSQL:"
echo "   docker start arcade-postgres"
echo ""
echo "4. Monitor recovery:"
echo "   docker logs -f arcade-postgres"
echo ""
echo "For detailed instructions, see: docs/BACKUP-STRATEGY.md"
echo ""
echo "Would you like to start the container now? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    docker start arcade-postgres
    echo "Container started. Monitor logs for recovery progress."
else
    echo "Container remains stopped. Complete manual steps above."
fi
