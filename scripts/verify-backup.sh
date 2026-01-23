#!/bin/bash
# Verify backup integrity
# Usage: ./verify-backup.sh [postgres|redis]

set -e

case "$1" in
    postgres)
        echo "Verifying PostgreSQL backup..."
        BACKUP_DIR="./backups/postgres/full"
        
        if [ ! -d "$BACKUP_DIR" ]; then
            echo "Error: Backup directory not found: $BACKUP_DIR"
            exit 1
        fi
        
        # Find most recent backup
        BACKUP=$(find "$BACKUP_DIR" -name "full_*.dump.gz" -type f | sort -r | head -1)
        
        if [ -z "$BACKUP" ]; then
            BACKUP=$(find "$BACKUP_DIR" -name "full_*.dump" -type f | sort -r | head -1)
        fi
        
        if [ -z "$BACKUP" ]; then
            echo "Error: No PostgreSQL backup found"
            exit 1
        fi
        
        echo "Checking backup: $BACKUP"
        
        # Check if it's compressed
        if [[ "$BACKUP" == *.gz ]]; then
            if command -v gzip &> /dev/null; then
                if gunzip -t "$BACKUP" 2>/dev/null; then
                    echo "✓ Backup file is valid (compressed)"
                else
                    echo "✗ Backup file is corrupted"
                    exit 1
                fi
            else
                echo "Warning: gzip not available, skipping compression check"
            fi
        fi
        
        # Try to list contents (requires pg_restore)
        if command -v pg_restore &> /dev/null; then
            if [[ "$BACKUP" == *.gz ]]; then
                if gunzip -c "$BACKUP" | pg_restore --list > /dev/null 2>&1; then
                    echo "✓ Backup contents are valid"
                else
                    echo "✗ Backup contents are corrupted"
                    exit 1
                fi
            else
                if pg_restore --list "$BACKUP" > /dev/null 2>&1; then
                    echo "✓ Backup contents are valid"
                else
                    echo "✗ Backup contents are corrupted"
                    exit 1
                fi
            fi
        else
            echo "Warning: pg_restore not available, skipping content validation"
        fi
        
        echo "✓ PostgreSQL backup is valid"
        ;;
    redis)
        echo "Verifying Redis backup..."
        BACKUP_DIR="./backups/redis"
        
        if [ ! -d "$BACKUP_DIR" ]; then
            echo "Error: Backup directory not found: $BACKUP_DIR"
            exit 1
        fi
        
        # Find most recent backup
        BACKUP=$(find "$BACKUP_DIR" -name "redis_*.tar.gz" -type f | sort -r | head -1)
        
        if [ -z "$BACKUP" ]; then
            echo "Error: No Redis backup found"
            exit 1
        fi
        
        echo "Checking backup: $BACKUP"
        
        # Test tar archive
        if command -v tar &> /dev/null; then
            if tar -tzf "$BACKUP" > /dev/null 2>&1; then
                echo "✓ Backup archive is valid"
            else
                echo "✗ Backup archive is corrupted"
                exit 1
            fi
        else
            echo "Warning: tar not available, skipping archive check"
        fi
        
        echo "✓ Redis backup is valid"
        ;;
    *)
        echo "Usage: $0 [postgres|redis]"
        echo "  postgres - Verify PostgreSQL backup integrity"
        echo "  redis    - Verify Redis backup integrity"
        exit 1
        ;;
esac
