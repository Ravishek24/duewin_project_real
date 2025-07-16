#!/bin/bash

echo "🔄 [SCHEDULER_RESTART] Restarting game scheduler with database fixes..."

# Stop the current scheduler
echo "🛑 Stopping current scheduler..."
pm2 stop game-scheduler

# Wait a moment for clean shutdown
sleep 3

# Check if scheduler is stopped
if pm2 list | grep -q "game-scheduler"; then
    echo "⚠️ Scheduler still running, force stopping..."
    pm2 delete game-scheduler
    sleep 2
fi

# Clear any stuck Redis locks
echo "🔓 Clearing stuck Redis locks..."
redis-cli --eval <<EOF
local keys = redis.call('keys', 'scheduler_result_lock_*')
for i=1,#keys do
    redis.call('del', keys[i])
end
return #keys
EOF

echo "🧹 Cleared Redis locks"

# Start the scheduler with new configuration
echo "🚀 Starting scheduler with database fixes..."
pm2 start ecosystem.config.js --only game-scheduler

# Wait for startup
sleep 5

# Check scheduler status
echo "📊 Checking scheduler status..."
pm2 list | grep game-scheduler

# Monitor logs for first 30 seconds
echo "📋 Monitoring scheduler logs for 30 seconds..."
timeout 30 pm2 logs game-scheduler --lines 50

echo "✅ [SCHEDULER_RESTART] Scheduler restart completed"
echo "🔍 Run 'pm2 logs game-scheduler' to monitor ongoing logs"
echo "🔍 Run 'node monitor-database-health.js' to check database health" 