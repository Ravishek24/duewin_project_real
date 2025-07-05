# Disk Space Prevention Guide for DueWin Backend

## Overview
This guide provides comprehensive solutions to prevent disk space issues that caused the recent system crash.

## Root Cause Analysis
- **Primary Issue**: Excessive logging in `periodService.js` (28+ million log entries)
- **Secondary Issues**: No log rotation, no disk monitoring, small EC2 volume (6.8GB)
- **Impact**: Complete disk exhaustion, process crashes, system instability

## Solutions Implemented

### 1. Fixed Excessive Logging
- ✅ Removed `console.log` from `periodService.js` line 572
- ✅ Implemented rate-limited logging system
- ✅ Created centralized logging configuration

### 2. Automated Monitoring System
- ✅ Disk usage monitoring (every 15 minutes)
- ✅ Emergency alerts (every 5 minutes)
- ✅ Automatic log rotation (daily)
- ✅ System cleanup (weekly)

### 3. Enhanced Logging Infrastructure
- ✅ Winston-based logging with rotation
- ✅ Rate-limited logging for high-frequency operations
- ✅ Sensitive data sanitization
- ✅ Performance monitoring

## Setup Instructions

### Step 1: Emergency Cleanup (Run First)
```bash
# Stop all processes
pm2 stop all

# Clear massive logs
> ~/.pm2/logs/game-scheduler-out.log
pm2 flush

# Clear system logs
sudo journalctl --vacuum-time=1d
sudo apt clean
sudo apt autoremove -y

# Check disk space
df -h
```

### Step 2: Install Monitoring System
```bash
cd ~/duewin_project_real-main/backend

# Make scripts executable
chmod +x scripts/setup-monitoring.sh
chmod +x scripts/emergency-disk-cleanup.sh
chmod +x scripts/disk-monitor.js

# Run monitoring setup
./scripts/setup-monitoring.sh
```

### Step 3: Restart Services with New Configuration
```bash
# Start with new ecosystem config (includes log rotation)
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Check status
pm2 list
```

### Step 4: Verify Monitoring
```bash
# Check monitoring dashboard
./scripts/monitoring-dashboard.sh

# Check cron jobs
crontab -l

# Monitor logs
tail -f logs/disk-monitor.log
```

## Monitoring Features

### Automated Tasks
1. **Disk Monitoring** (every 15 minutes)
   - Checks disk usage
   - Logs usage statistics
   - Triggers alerts at 90% usage

2. **Emergency Alerts** (every 5 minutes)
   - Monitors critical disk usage
   - Auto-cleanup at 95% usage
   - Logs emergency events

3. **Log Rotation** (daily at 2 AM)
   - Rotates application logs
   - Clears old system logs
   - Maintains log file sizes

4. **System Cleanup** (weekly on Sunday at 3 AM)
   - Clears temporary files
   - Removes old packages
   - Cleans npm cache

### Manual Commands
```bash
# View monitoring dashboard
./scripts/monitoring-dashboard.sh

# Check disk usage
df -h

# Check large files
find ~/duewin_project_real-main -type f -size +50M -exec ls -lh {} \;

# Check PM2 logs
pm2 logs --lines 50

# Emergency cleanup
./scripts/emergency-disk-cleanup.sh
```

## Prevention Strategies

### 1. Volume Size Recommendation
- **Current**: 6.8GB (too small)
- **Recommended**: 20GB minimum
- **Action**: Increase EC2 EBS volume size

### 2. Log Management
- **PM2 Logs**: Auto-rotate at 10MB, keep 7 days
- **Application Logs**: Rotate at 5MB, keep 3 days
- **System Logs**: Keep 7 days maximum

### 3. Rate Limiting
- **Game Period Logs**: Max 10 per minute
- **Game Tick Logs**: Max 5 per minute
- **API Requests**: Max 100 per minute

### 4. Monitoring Thresholds
- **Warning**: 80% disk usage
- **Alert**: 90% disk usage
- **Emergency**: 95% disk usage (auto-cleanup)

## Troubleshooting

### High Disk Usage
1. Check monitoring dashboard: `./scripts/monitoring-dashboard.sh`
2. Identify large files: `find ~/duewin_project_real-main -type f -size +50M`
3. Run emergency cleanup: `./scripts/emergency-disk-cleanup.sh`
4. Check for log leaks: `pm2 logs --lines 100`

### Monitoring Not Working
1. Check cron jobs: `crontab -l`
2. Check monitoring logs: `tail -f logs/disk-monitor.log`
3. Restart monitoring: `./scripts/setup-monitoring.sh`

### Service Crashes
1. Check PM2 status: `pm2 list`
2. Check logs: `pm2 logs`
3. Restart services: `pm2 restart all`

## Best Practices

### Daily Monitoring
- Check monitoring dashboard once daily
- Review disk usage trends
- Monitor for unusual log growth

### Weekly Maintenance
- Review large files
- Check monitoring logs
- Verify cron job execution

### Monthly Review
- Analyze disk usage patterns
- Review log rotation effectiveness
- Update monitoring thresholds if needed

## Emergency Procedures

### Critical Disk Usage (>95%)
1. Stop non-essential services
2. Run emergency cleanup
3. Check for log leaks
4. Restart services

### Service Crashes
1. Check disk space first
2. Clear logs if necessary
3. Restart services
4. Investigate root cause

### Monitoring Failures
1. Check cron service: `sudo service cron status`
2. Restart cron: `sudo service cron restart`
3. Reinstall monitoring: `./scripts/setup-monitoring.sh`

## Configuration Files

### Key Files Modified
- `services/periodService.js` - Removed excessive logging
- `utils/logger.js` - Enhanced logging with rotation
- `ecosystem.config.js` - PM2 configuration with log rotation
- `scripts/disk-monitor.js` - Disk monitoring script
- `scripts/setup-monitoring.sh` - Monitoring setup script

### Environment Variables
```bash
# Logging level
LOG_LEVEL=info

# Node environment
NODE_ENV=production

# Disk monitoring thresholds
DISK_WARNING_THRESHOLD=80
DISK_ALERT_THRESHOLD=90
DISK_EMERGENCY_THRESHOLD=95
```

## Support

For issues or questions:
1. Check this documentation first
2. Review monitoring logs
3. Run diagnostic scripts
4. Contact system administrator

## Updates

- **2025-06-29**: Initial implementation
- **2025-06-29**: Added emergency procedures
- **2025-06-29**: Enhanced monitoring features 