#!/bin/bash

# Comprehensive Monitoring Setup for DueWin Backend
# This script sets up automated disk monitoring and alerting

set -e

echo "🔧 Setting up comprehensive monitoring system..."
echo "================================================"

# Create monitoring directory
mkdir -p ~/duewin_project_real-main/backend/monitoring

# 1. Set up disk monitoring cron job
echo "📊 Setting up disk monitoring..."

# Add disk monitoring to crontab (every 15 minutes)
(crontab -l 2>/dev/null; echo "*/15 * * * * cd ~/duewin_project_real-main/backend && node scripts/disk-monitor.js >> logs/disk-monitor.log 2>&1") | crontab -

# 2. Set up log rotation cron job (daily at 2 AM)
echo "🔄 Setting up log rotation..."
(crontab -l 2>/dev/null; echo "0 2 * * * cd ~/duewin_project_real-main/backend && ./scripts/rotate-logs.sh >> logs/log-rotation.log 2>&1") | crontab -

# 3. Set up system cleanup cron job (weekly on Sunday at 3 AM)
echo "🧹 Setting up system cleanup..."
(crontab -l 2>/dev/null; echo "0 3 * * 0 cd ~/duewin_project_real-main/backend && ./scripts/system-cleanup.sh >> logs/system-cleanup.log 2>&1") | crontab -

# 4. Set up PM2 log rotation
echo "📝 Setting up PM2 log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# 5. Create log rotation script
cat > ~/duewin_project_real-main/backend/scripts/rotate-logs.sh << 'EOF'
#!/bin/bash

# Daily log rotation script
echo "🔄 Starting daily log rotation at $(date)"

# Rotate application logs
find ~/duewin_project_real-main/backend/logs -name "*.log" -size +50M -exec truncate -s 0 {} \;

# Rotate PM2 logs if they're too large
find ~/.pm2/logs -name "*.log" -size +100M -exec truncate -s 0 {} \;

# Clear old system logs
sudo journalctl --vacuum-time=7d

# Clear old package cache
sudo apt clean

echo "✅ Log rotation completed at $(date)"
EOF

chmod +x ~/duewin_project_real-main/backend/scripts/rotate-logs.sh

# 6. Create system cleanup script
cat > ~/duewin_project_real-main/backend/scripts/system-cleanup.sh << 'EOF'
#!/bin/bash

# Weekly system cleanup script
echo "🧹 Starting weekly system cleanup at $(date)"

# Clear temporary files
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*

# Clear old system logs
sudo journalctl --vacuum-time=14d

# Clear package cache
sudo apt clean
sudo apt autoremove -y

# Clear npm cache
npm cache clean --force

# Clear old PM2 logs
pm2 flush

# Check for large files
echo "🔍 Checking for large files..."
find ~/duewin_project_real-main -type f -size +100M -exec ls -lh {} \; 2>/dev/null || echo "No large files found"

echo "✅ System cleanup completed at $(date)"
EOF

chmod +x ~/duewin_project_real-main/backend/scripts/system-cleanup.sh

# 7. Create emergency alert script
cat > ~/duewin_project_real-main/backend/scripts/emergency-alert.sh << 'EOF'
#!/bin/bash

# Emergency alert script for disk space issues
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -gt 90 ]; then
    echo "🚨 CRITICAL: Disk usage is ${DISK_USAGE}% at $(date)"
    echo "🚨 CRITICAL: Disk usage is ${DISK_USAGE}% at $(date)" >> ~/duewin_project_real-main/backend/logs/emergency-alerts.log
    
    # Send notification (you can add email/SMS here)
    # Example: curl -X POST "your-webhook-url" -d "Disk usage: ${DISK_USAGE}%"
    
    # Auto-cleanup if disk usage is critical
    if [ "$DISK_USAGE" -gt 95 ]; then
        echo "🚨 EMERGENCY CLEANUP TRIGGERED"
        pm2 flush
        sudo journalctl --vacuum-time=1d
        sudo apt clean
    fi
fi
EOF

chmod +x ~/duewin_project_real-main/backend/scripts/emergency-alert.sh

# 8. Add emergency alert to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * cd ~/duewin_project_real-main/backend && ./scripts/emergency-alert.sh") | crontab -

# 9. Create monitoring dashboard script
cat > ~/duewin_project_real-main/backend/scripts/monitoring-dashboard.sh << 'EOF'
#!/bin/bash

# Monitoring dashboard script
echo "📊 DueWin Backend Monitoring Dashboard"
echo "======================================"
echo "Date: $(date)"
echo ""

# Disk usage
echo "💾 Disk Usage:"
df -h / | tail -1
echo ""

# Memory usage
echo "🧠 Memory Usage:"
free -h
echo ""

# PM2 status
echo "🔄 PM2 Status:"
pm2 list
echo ""

# Large files
echo "📁 Large Files (>50MB):"
find ~/duewin_project_real-main -type f -size +50M -exec ls -lh {} \; 2>/dev/null | head -5 || echo "No large files found"
echo ""

# Recent logs
echo "📝 Recent Log Entries:"
tail -5 ~/duewin_project_real-main/backend/logs/disk-monitor.log 2>/dev/null || echo "No monitoring logs found"
echo ""

# Crontab status
echo "⏰ Active Cron Jobs:"
crontab -l 2>/dev/null | grep -E "(disk-monitor|rotate-logs|system-cleanup|emergency-alert)" || echo "No monitoring cron jobs found"
EOF

chmod +x ~/duewin_project_real-main/backend/scripts/monitoring-dashboard.sh

# 10. Show current crontab
echo "📋 Current monitoring cron jobs:"
crontab -l

echo ""
echo "✅ Comprehensive monitoring setup completed!"
echo ""
echo "🔍 Monitoring features installed:"
echo "  - Disk usage monitoring (every 15 minutes)"
echo "  - Log rotation (daily at 2 AM)"
echo "  - System cleanup (weekly on Sunday at 3 AM)"
echo "  - Emergency alerts (every 5 minutes)"
echo "  - PM2 log rotation (automatic)"
echo ""
echo "📊 To view monitoring dashboard:"
echo "  ./scripts/monitoring-dashboard.sh"
echo ""
echo "📝 To check monitoring logs:"
echo "  tail -f logs/disk-monitor.log"
echo "  tail -f logs/emergency-alerts.log" 