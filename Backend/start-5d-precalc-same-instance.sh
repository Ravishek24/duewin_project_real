#!/bin/bash

# 5D Pre-Calculation Scheduler - Same Instance Startup Script
# This script starts the 5D pre-calculation scheduler on the same server as WebSocket

echo "🚀 Starting 5D Pre-Calculation Scheduler on same instance as WebSocket..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install PM2 first:"
    echo "npm install -g pm2"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "scripts/5dPreCalcScheduler.js" ]; then
    echo "❌ 5D Pre-Calculation Scheduler not found. Please run this script from the Backend directory."
    exit 1
fi

# Check if ecosystem config exists
if [ ! -f "ecosystem-5d-precalc-single.config.js" ]; then
    echo "❌ PM2 ecosystem config not found: ecosystem-5d-precalc-single.config.js"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

echo "📋 Checking current PM2 processes..."
pm2 list

# Check if WebSocket is already running
if pm2 list | grep -q "strike-backend\|websocket\|app"; then
    echo "✅ WebSocket service detected as running"
else
    echo "⚠️ No WebSocket service detected. Make sure your main WebSocket service is running."
fi

echo "🔄 Starting 5D Pre-Calculation Scheduler with PM2..."
pm2 start ecosystem-5d-precalc-single.config.js

echo "⏳ Waiting for process to start..."
sleep 3

echo "📊 PM2 Status:"
pm2 list

echo "📋 5D Pre-Calculation Scheduler logs:"
pm2 logs 5d-precalc-scheduler --lines 10

echo "✅ 5D Pre-Calculation Scheduler started successfully on same instance!"
echo ""
echo "📝 Current Setup:"
echo "  ┌─────────────────────────────────────┐"
echo "  │         Single Server Instance      │"
echo "  ├─────────────────────────────────────┤"
echo "  │  • WebSocket Service (Main App)     │"
echo "  │  • 5D Pre-Calculation Scheduler     │"
echo "  │  • Redis (Shared)                   │"
echo "  │  • Database (Shared)                │"
echo "  └─────────────────────────────────────┘"
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs 5d-precalc-scheduler          # View scheduler logs"
echo "  pm2 logs strike-backend                # View WebSocket logs"
echo "  pm2 restart 5d-precalc-scheduler       # Restart scheduler"
echo "  pm2 stop 5d-precalc-scheduler          # Stop scheduler"
echo "  pm2 delete 5d-precalc-scheduler        # Remove from PM2"
echo "  pm2 monit                              # Monitor all processes"
echo ""
echo "🎯 The 5D pre-calculation scheduler is now running on the same instance!"
echo "   It will monitor 5D periods and trigger pre-calculation at bet freeze (t=5s)"
echo "   Results will be shared via Redis with your WebSocket service." 