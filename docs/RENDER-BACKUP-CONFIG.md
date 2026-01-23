# Render Backup Configuration

This guide covers configuring automated backups for PostgreSQL and Redis on Render.

## PostgreSQL Backups on Render

### Automatic Backups

Render provides automatic daily backups for PostgreSQL databases:

1. **Access Database Settings:**
   - Go to Render Dashboard → Your PostgreSQL Database
   - Click on "Settings" tab

2. **Backup Configuration:**
   - **Automatic Backups**: Enabled by default
   - **Backup Schedule**: Daily at 02:00 UTC (configurable)
   - **Retention Period**:
     - Free tier: 7 days
     - Starter plan: 7 days
     - Standard plan: 30 days
     - Pro plan: 30 days

3. **Manual Backup:**
   ```bash
   # Via Render CLI
   render backups:create --service <postgres-service-id>
   
   # Or via Dashboard
   # Database → Backups → Create Backup
   ```

### Point-in-Time Recovery (PITR)

**Availability:**
- Available on Standard plan and above
- Allows restore to any point within retention period

**How to Use:**

1. **Via Dashboard:**
   - Go to Database → Backups
   - Click "Restore" on any backup
   - Select "Point-in-Time Recovery"
   - Choose target timestamp
   - Confirm restore

2. **Via CLI:**
   ```bash
   # List available backups
   render backups:list --service <postgres-service-id>
   
   # Restore to specific time
   render backups:restore <backup-id> --target-time "2024-01-23T14:30:00Z"
   ```

### Backup Export

**Download Backup:**
```bash
# List backups
render backups:list --service <postgres-service-id>

# Download backup
render backups:download <backup-id> --output backup.dump

# Restore locally
pg_restore -d arcade backup.dump
```

**Automated Export Script:**

Create `scripts/export-render-backup.sh`:

```bash
#!/bin/bash
# Export latest Render PostgreSQL backup
# Requires: Render CLI configured

set -e

SERVICE_ID="${RENDER_POSTGRES_SERVICE_ID}"
OUTPUT_DIR="./backups/render-exports"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "Fetching latest backup for service: $SERVICE_ID"

# Get latest backup ID
BACKUP_ID=$(render backups:list --service "$SERVICE_ID" --format json | \
  jq -r '.[0].id')

if [ -z "$BACKUP_ID" ]; then
    echo "Error: No backups found"
    exit 1
fi

echo "Downloading backup: $BACKUP_ID"
render backups:download "$BACKUP_ID" \
  --output "$OUTPUT_DIR/render_backup_${DATE}.dump"

echo "Backup exported to: $OUTPUT_DIR/render_backup_${DATE}.dump"
```

**Cron Schedule:**
```cron
# Export Render backup weekly (Sunday 00:00 UTC)
0 0 * * 0 cd /path/to/arcade && ./scripts/export-render-backup.sh
```

### Recommended Production Setup

1. **Upgrade to Standard Plan** (30-day retention)
2. **Enable Automatic Backups** (default)
3. **Set Backup Schedule** to off-peak hours (02:00 UTC)
4. **Enable PITR** if available on your plan
5. **Export Monthly Backups** to external storage (S3, etc.)
6. **Monitor Backup Health** via Render dashboard

---

## Redis Backups on Render

### Managed Redis Service

If using Render's managed Redis:

1. **Access Redis Settings:**
   - Go to Render Dashboard → Your Redis Instance
   - Click on "Settings" tab

2. **Persistence Configuration:**
   - **RDB Snapshots**: Automatic (configurable frequency)
   - **AOF Persistence**: Available on paid plans
   - **Backup Retention**: 7-30 days (plan-dependent)

3. **Manual Backup:**
   ```bash
   # Via Render CLI
   render redis:backup --service <redis-service-id>
   ```

### Self-Managed Redis (Docker)

If running Redis in a Docker service on Render:

1. **Configure Persistence in docker-compose.yml:**
   ```yaml
   redis:
     command: >
       redis-server
       --appendonly yes
       --appendfsync everysec
       --save 900 1
       --save 300 10
       --save 60 10000
   ```

2. **Backup via Cron Job:**
   - Create a Cron Job service on Render
   - Use the `backup-redis.sh` script
   - Schedule every 6 hours

3. **Backup Storage:**
   - Mount persistent disk for backups
   - Or sync to external storage (S3)

### Recommended Production Setup

1. **Use Managed Redis** if available (automatic backups)
2. **Enable RDB + AOF** for maximum durability
3. **Configure frequent snapshots** (every 5-15 minutes)
4. **Set up external backup sync** (S3, etc.)
5. **Monitor Redis persistence** via metrics

---

## Backup Monitoring

### Render Dashboard

1. **Check Backup Status:**
   - Database → Backups → View recent backups
   - Check backup sizes and timestamps
   - Verify backup success

2. **Set Up Alerts:**
   - Render Dashboard → Alerts
   - Configure backup failure notifications
   - Set up email/Slack notifications

### Health Check Endpoint

Add backup status to your health check:

```typescript
// apps/server/src/routes/health.ts
app.get('/health/backups', async (request, reply) => {
  // Check Render backup status via API
  // Or check local backup files
  const backupStatus = {
    postgres: {
      lastBackup: await getLastRenderBackup('postgres'),
      status: 'ok',
    },
    redis: {
      lastBackup: await getLastRenderBackup('redis'),
      status: 'ok',
    },
  };
  
  return reply.send(backupStatus);
});
```

---

## Disaster Recovery Procedures

### Complete Database Loss

1. **Identify Last Good Backup:**
   - Check Render dashboard → Backups
   - Note backup timestamp

2. **Restore Database:**
   ```bash
   # Via Dashboard: Database → Backups → Restore
   # Or via CLI:
   render backups:restore <backup-id>
   ```

3. **Verify Data:**
   ```sql
   -- Connect to restored database
   SELECT COUNT(*) FROM "User";
   SELECT COUNT(*) FROM "GameSession";
   -- Verify critical tables
   ```

4. **Update Application:**
   - Verify DATABASE_URL is correct
   - Restart application services
   - Monitor for errors

### Point-in-Time Recovery

1. **Identify Target Time:**
   - Determine when corruption/loss occurred
   - Choose recovery point before issue

2. **Restore to Point:**
   - Render Dashboard → Backups → PITR
   - Enter target timestamp
   - Confirm restore

3. **Verify Recovery:**
   - Check data at target time
   - Verify application functionality
   - Monitor for issues

---

## Best Practices

### PostgreSQL

1. ✅ **Use Standard Plan or Higher** (30-day retention)
2. ✅ **Enable Automatic Backups** (daily)
3. ✅ **Test Restores Monthly** (staging environment)
4. ✅ **Export Critical Backups** to external storage
5. ✅ **Monitor Backup Sizes** (alert on anomalies)
6. ✅ **Document Recovery Procedures**

### Redis

1. ✅ **Use Managed Redis** if available
2. ✅ **Enable RDB + AOF** persistence
3. ✅ **Configure Frequent Snapshots** (5-15 min)
4. ✅ **Monitor Persistence Metrics**
5. ✅ **Test Restore Procedures** regularly

### General

1. ✅ **3-2-1 Rule**: 3 copies, 2 media types, 1 off-site
2. ✅ **Automate Everything** (backups, exports, verification)
3. ✅ **Test Recovery** regularly (monthly)
4. ✅ **Monitor Backup Health** (alerts, dashboards)
5. ✅ **Document Procedures** (this guide)
6. ✅ **Encrypt Off-Site Backups**

---

## Render CLI Setup

### Installation

```bash
# Install Render CLI
npm install -g render-cli

# Or via Homebrew
brew install render
```

### Authentication

```bash
# Login to Render
render login

# Set service IDs as environment variables
export RENDER_POSTGRES_SERVICE_ID="srv-xxxxx"
export RENDER_REDIS_SERVICE_ID="srv-yyyyy"
```

### Useful Commands

```bash
# List all backups
render backups:list --service <service-id>

# Create manual backup
render backups:create --service <service-id>

# Download backup
render backups:download <backup-id> --output backup.dump

# Restore backup
render backups:restore <backup-id>

# View backup details
render backups:get <backup-id>
```

---

## Cost Considerations

### Backup Storage Costs

- **Render Backups**: Included in plan (up to retention limit)
- **External Storage**: S3/Backblaze (~$0.023/GB/month)
- **Bandwidth**: Render egress charges may apply

### Optimization

1. **Compress Backups** before external storage
2. **Use Lifecycle Policies** (S3) to move old backups to Glacier
3. **Retain Only Necessary Backups** (delete old exports)
4. **Monitor Storage Usage** regularly

---

## Troubleshooting

### Backup Failures

**Issue**: Backups not appearing in dashboard
- Check service status (database must be running)
- Verify plan includes backups
- Check Render status page for outages

**Issue**: Backup size is 0 or unusually small
- Database may be empty or corrupted
- Check database connection
- Verify tables exist

### Restore Issues

**Issue**: Restore fails
- Check backup file integrity
- Verify target database is accessible
- Ensure sufficient disk space
- Check Render service limits

**Issue**: Data missing after restore
- Verify restore completed successfully
- Check if restore was to correct point in time
- Verify application is using correct database

---

## References

- [Render Database Backups](https://render.com/docs/databases#backups)
- [Render CLI Documentation](https://render.com/docs/cli)
- [PostgreSQL Backup Best Practices](https://www.postgresql.org/docs/15/backup.html)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
