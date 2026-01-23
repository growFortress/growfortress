# Backup Setup Guide

Quick setup guide for configuring automated backups.

## ✅ Completed Steps

1. **Updated `docker-compose.yml`** with backup configuration:
   - PostgreSQL WAL archiving enabled
   - Redis persistence (RDB + AOF) configured
   - Backup volume mounts added

2. **Created backup scripts** in `scripts/`:
   - `backup-postgres.sh` - PostgreSQL backups
   - `backup-redis.sh` - Redis backups
   - `verify-backup.sh` - Backup verification
   - `restore-postgres-pitr.sh` - Point-in-time recovery

3. **Created automation files**:
   - `scripts/crontab.example` - Linux/Mac cron schedule
   - `scripts/windows-scheduled-tasks.ps1` - Windows Task Scheduler setup
   - `scripts/test-backups.ps1` - Backup testing script

4. **Documentation**:
   - `docs/BACKUP-STRATEGY.md` - Complete backup strategy
   - `docs/RENDER-BACKUP-CONFIG.md` - Render production setup

## 🚀 Next Steps

### 1. Restart Docker Containers

The updated `docker-compose.yml` requires containers to be restarted to apply backup settings:

```bash
# Stop existing containers
docker-compose down

# Start with new configuration
docker-compose up -d
```

**Note:** Restarting will apply:
- PostgreSQL WAL archiving
- Redis persistence settings
- Backup volume mounts

### 2. Test Backup Scripts

**On Windows (Git Bash or WSL):**
```bash
cd c:/dev/arcade

# Test PostgreSQL backup
bash scripts/backup-postgres.sh full

# Test Redis backup
bash scripts/backup-redis.sh

# Verify backups
bash scripts/verify-backup.sh postgres
bash scripts/verify-backup.sh redis
```

**On Linux/Mac:**
```bash
cd /path/to/arcade

# Make scripts executable
chmod +x scripts/*.sh

# Test backups
./scripts/backup-postgres.sh full
./scripts/backup-redis.sh
./scripts/verify-backup.sh postgres
./scripts/verify-backup.sh redis
```

### 3. Set Up Automated Backups

#### Linux/Mac (Cron)

1. **Copy cron example:**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add entries from scripts/crontab.example
   # Update paths to match your project location
   ```

2. **Or install directly:**
   ```bash
   # Update paths in crontab.example first
   crontab scripts/crontab.example
   ```

#### Windows (Task Scheduler)

1. **Run PowerShell as Administrator:**
   ```powershell
   cd c:\dev\arcade
   .\scripts\windows-scheduled-tasks.ps1
   ```

2. **Verify tasks created:**
   ```powershell
   Get-ScheduledTask -TaskName "Arcade-*"
   ```

3. **Test a task:**
   ```powershell
   Start-ScheduledTask -TaskName "Arcade-PostgreSQL-Daily-Backup"
   ```

**Note:** Windows tasks require Git Bash to be installed at `C:\Program Files\Git\bin\bash.exe`. Update the path in `windows-scheduled-tasks.ps1` if different.

### 4. Configure Production Backups (Render)

See `docs/RENDER-BACKUP-CONFIG.md` for detailed instructions.

**Quick Steps:**

1. **PostgreSQL:**
   - Go to Render Dashboard → Your PostgreSQL Database
   - Verify "Automatic Backups" is enabled
   - Check backup retention (upgrade to Standard plan for 30-day retention)
   - Enable Point-in-Time Recovery if available

2. **Redis:**
   - If using managed Redis: Check backup settings in dashboard
   - If self-managed: Use cron job with `backup-redis.sh`

3. **Export Script:**
   - Set `RENDER_POSTGRES_SERVICE_ID` environment variable
   - Run `scripts/export-render-backup.sh` weekly (via cron)

## 📋 Backup Schedule Summary

| Service | Frequency | Retention | Script |
|---------|-----------|----------|--------|
| PostgreSQL Full | Daily 02:00 UTC | 30 days | `backup-postgres.sh full` |
| PostgreSQL Weekly | Sunday 01:00 UTC | 90 days | `backup-postgres.sh full` |
| PostgreSQL WAL | Continuous | 7 days | (automatic) |
| Redis | Every 6 hours | 7 days | `backup-redis.sh` |
| Verification | Daily 04:00-05:00 UTC | - | `verify-backup.sh` |

## 🔍 Verification

### Check Backup Files

```bash
# List PostgreSQL backups
ls -lh backups/postgres/full/

# List Redis backups
ls -lh backups/redis/

# Check WAL archives
ls -lh backups/postgres/wal/
```

### Test Restore (Staging)

```bash
# Create test database
createdb test_restore

# Restore backup
pg_restore -d test_restore backups/postgres/full/full_YYYYMMDD_HHMMSS.dump.gz

# Verify data
psql test_restore -c "SELECT COUNT(*) FROM \"User\";"

# Cleanup
dropdb test_restore
```

## 🐛 Troubleshooting

### Scripts Not Executable (Linux/Mac)

```bash
chmod +x scripts/*.sh
```

### Docker Containers Not Running

```bash
# Check status
docker ps

# Start containers
docker-compose up -d
```

### Backup Directory Permissions

```bash
# Ensure directories are writable
chmod 755 backups/
chmod 755 backups/postgres/
chmod 755 backups/redis/
```

### Windows: Git Bash Not Found

Update `scripts/windows-scheduled-tasks.ps1` with correct Git Bash path:
```powershell
$Action = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" ...
```

Or install Git for Windows: https://git-scm.com/download/win

## 📚 Documentation

- **Complete Strategy**: `docs/BACKUP-STRATEGY.md`
- **Render Setup**: `docs/RENDER-BACKUP-CONFIG.md`
- **Script Usage**: `scripts/README.md`

## ✅ Checklist

- [ ] Restart Docker containers with new configuration
- [ ] Test backup scripts manually
- [ ] Set up automated backups (cron/Task Scheduler)
- [ ] Verify backups are created successfully
- [ ] Test restore procedure (staging)
- [ ] Configure Render production backups
- [ ] Set up backup monitoring/alerts
- [ ] Document any custom procedures
- [ ] Schedule monthly backup testing

## 🆘 Support

If you encounter issues:

1. Check `docs/BACKUP-STRATEGY.md` for detailed procedures
2. Verify Docker containers are running
3. Check script permissions (Linux/Mac)
4. Review backup logs in `backups/` directory
5. Test scripts manually before automating
