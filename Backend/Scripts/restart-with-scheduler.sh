#!/bin/bash

# Restart DueWin Backend with Game Scheduler
# This script restarts all PM2 processes including the new game scheduler

echo "🔄 Restarting DueWin Backend with Game Scheduler..."
echo "=================================================="

# Stop all existing processes
echo "🛑 Stopping all PM2 processes..."
pm2 stop all

# Delete all processes
echo "🗑️ Removing all PM2 processes..."
pm2 delete all

# Start with new ecosystem config
echo "🚀 Starting services with new ecosystem configuration..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Show status
echo "📋 Current PM2 Status:"
pm2 list

echo ""
echo "✅ Services restarted successfully!"
echo "📊 You should now see:"
echo "   - duewin-backend (main application)"
echo "   - game-scheduler (period management)"
echo "   - bullmq-worker (queue processing)"
echo ""
echo "🔍 To monitor logs:"
echo "   pm2 logs game-scheduler --lines 50"
echo "   pm2 logs duewin-backend --lines 50"
echo ""
echo "🎮 Game periods should now be created automatically!" 