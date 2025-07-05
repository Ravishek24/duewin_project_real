#!/bin/bash

# Emergency Disk Cleanup Script for DueWin Backend
# This script safely cleans up disk space and restarts services

set -e  # Exit on any error

echo "🚨 EMERGENCY DISK CLEANUP STARTED"
echo "=================================="

# Check current disk usage
echo "📊 Current disk usage:"
df -h /

# Step 1: Stop all PM2 processes
echo "🛑 Stopping all PM2 processes..."
pm2 stop all

# Step 2: Clear PM2 logs (this is the main culprit)
echo "🧹 Clearing PM2 logs..."
pm2 flush

# Step 3: Clear system journal logs
echo "🧹 Clearing system journal logs..."
sudo journalctl --vacuum-time=1d

# Step 4: Clear package cache
echo "🧹 Clearing package cache..."
sudo apt clean
sudo apt autoremove -y

# Step 5: Clear temporary files
echo "🧹 Clearing temporary files..."
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*

# Step 6: Clear old log files in the project
echo "🧹 Clearing old application logs..."
find ~/duewin_project_real-main/backend/logs -name "*.log" -size +10M -exec truncate -s 0 {} \;

# Step 7: Check disk usage after cleanup
echo "📊 Disk usage after cleanup:"
df -h /

# Step 8: Create logs directory if it doesn't exist
echo "📁 Ensuring logs directory exists..."
mkdir -p ~/duewin_project_real-main/backend/logs

# Step 9: Start services with new ecosystem config
echo "🚀 Starting services with new configuration..."
cd ~/duewin_project_real-main/backend

# Check if ecosystem.config.js exists
if [ -f "ecosystem.config.js" ]; then
    echo "✅ Using ecosystem.config.js for PM2 configuration"
    pm2 start ecosystem.config.js
else
    echo "⚠️ ecosystem.config.js not found, starting with basic configuration"
    pm2 start index.js --name duewin-backend
    pm2 start workers/workerManager.js --name bullmq-worker --instances 2
fi

# Step 10: Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Step 11: Set up PM2 startup script
echo "🔧 Setting up PM2 startup script..."
pm2 startup

# Step 12: Final disk usage check
echo "📊 Final disk usage:"
df -h /

# Step 13: Show PM2 status
echo "📋 PM2 Status:"
pm2 list

echo "✅ EMERGENCY DISK CLEANUP COMPLETED"
echo "=================================="
echo ""
echo "🔍 Next steps:"
echo "1. Monitor disk usage: df -h"
echo "2. Check PM2 logs: pm2 logs"
echo "3. Monitor application: pm2 monit"
echo "4. Set up automated monitoring: crontab -e"
echo ""
echo "📝 Add this to crontab for automated monitoring:"
echo "*/30 * * * * cd ~/duewin_project_real-main/backend && node scripts/disk-monitor.js >> logs/disk-monitor.log 2>&1" 