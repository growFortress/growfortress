# PowerShell script to create Windows Scheduled Tasks for backups
# Run as Administrator: .\scripts\windows-scheduled-tasks.ps1

$ErrorActionPreference = "Stop"

# Get project root directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ScriptsPath = Join-Path $ProjectRoot "scripts"

Write-Host "Creating Windows Scheduled Tasks for backups..." -ForegroundColor Green

# Function to create a scheduled task
function Create-BackupTask {
    param(
        [string]$TaskName,
        [string]$Description,
        [string]$ScriptPath,
        [string]$Schedule,
        [string]$Time
    )
    
    $TaskPath = Join-Path $ScriptsPath $ScriptPath
    
    # Check if task already exists
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
        Write-Host "Task '$TaskName' already exists. Removing..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    
    # Create action (run script in Git Bash)
    $Action = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" `
        -Argument "-c `"cd '$ProjectRoot' && ./scripts/$ScriptPath`""
    
    # Create trigger based on schedule
    $Trigger = switch ($Schedule) {
        "Daily" {
            $TimeParts = $Time.Split(':')
            New-ScheduledTaskTrigger -Daily -At "$($TimeParts[0]):$($TimeParts[1])"
        }
        "Hourly" {
            $Interval = [int]$Time
            New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours $Interval) -RepetitionDuration (New-TimeSpan -Days 365)
        }
        "Weekly" {
            $TimeParts = $Time.Split(':')
            New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "$($TimeParts[0]):$($TimeParts[1])"
        }
    }
    
    # Create settings
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    # Register task
    Register-ScheduledTask -TaskName $TaskName -Description $Description `
        -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Highest
    
    Write-Host "✓ Created task: $TaskName" -ForegroundColor Green
}

# Create tasks
try {
    # PostgreSQL daily backup at 02:00
    Create-BackupTask -TaskName "Arcade-PostgreSQL-Daily-Backup" `
        -Description "Daily PostgreSQL full backup" `
        -ScriptPath "backup-postgres.sh full" `
        -Schedule "Daily" `
        -Time "02:00"
    
    # PostgreSQL weekly backup (Sunday 01:00)
    Create-BackupTask -TaskName "Arcade-PostgreSQL-Weekly-Backup" `
        -Description "Weekly PostgreSQL full backup" `
        -ScriptPath "backup-postgres.sh full" `
        -Schedule "Weekly" `
        -Time "01:00"
    
    # PostgreSQL WAL cleanup (daily at 03:00)
    Create-BackupTask -TaskName "Arcade-PostgreSQL-WAL-Cleanup" `
        -Description "Clean up old PostgreSQL WAL files" `
        -ScriptPath "backup-postgres.sh wal" `
        -Schedule "Daily" `
        -Time "03:00"
    
    # Redis backup every 6 hours
    Create-BackupTask -TaskName "Arcade-Redis-Backup" `
        -Description "Redis backup (RDB + AOF)" `
        -ScriptPath "backup-redis.sh" `
        -Schedule "Hourly" `
        -Time "6"
    
    # Verify PostgreSQL backup (daily at 04:00)
    Create-BackupTask -TaskName "Arcade-Verify-PostgreSQL-Backup" `
        -Description "Verify PostgreSQL backup integrity" `
        -ScriptPath "verify-backup.sh postgres" `
        -Schedule "Daily" `
        -Time "04:00"
    
    # Verify Redis backup (daily at 05:00)
    Create-BackupTask -TaskName "Arcade-Verify-Redis-Backup" `
        -Description "Verify Redis backup integrity" `
        -ScriptPath "verify-backup.sh redis" `
        -Schedule "Daily" `
        -Time "05:00"
    
    Write-Host "`nAll scheduled tasks created successfully!" -ForegroundColor Green
    Write-Host "`nTo view tasks: Get-ScheduledTask -TaskName 'Arcade-*'" -ForegroundColor Cyan
    Write-Host "To remove tasks: Get-ScheduledTask -TaskName 'Arcade-*' | Unregister-ScheduledTask" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating scheduled tasks: $_" -ForegroundColor Red
    exit 1
}
