module.exports = {
  apps: [
    {
      name: 'duewin-backend',
      script: 'index.js',
      cwd: '/home/ubuntu/duewin_project_real-main/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      // Log rotation settings
      log_file: '/home/ubuntu/duewin_project_real-main/backend/logs/combined.log',
      out_file: '/home/ubuntu/duewin_project_real-main/backend/logs/out.log',
      error_file: '/home/ubuntu/duewin_project_real-main/backend/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart settings
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      // Log rotation
      log_type: 'json',
      merge_logs: true,
      // Prevent log files from growing too large
      log_rotate_interval: '1d',
      log_rotate_max: 7,
      log_rotate_keep: 7
    },
    {
      name: 'game-scheduler',
      script: 'scripts/start-scheduler.js',
      cwd: '/home/ubuntu/duewin_project_real-main/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // Log rotation settings
      log_file: '/home/ubuntu/duewin_project_real-main/backend/logs/scheduler-combined.log',
      out_file: '/home/ubuntu/duewin_project_real-main/backend/logs/scheduler-out.log',
      error_file: '/home/ubuntu/duewin_project_real-main/backend/logs/scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart settings
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      // Log rotation
      log_type: 'json',
      merge_logs: true,
      log_rotate_interval: '1d',
      log_rotate_max: 7,
      log_rotate_keep: 7
    },
    {
      name: 'bullmq-worker',
      script: 'workers/workerManager.js',
      cwd: '/home/ubuntu/duewin_project_real-main/backend',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // Log rotation settings
      log_file: '/home/ubuntu/duewin_project_real-main/backend/logs/bullmq-combined.log',
      out_file: '/home/ubuntu/duewin_project_real-main/backend/logs/bullmq-out.log',
      error_file: '/home/ubuntu/duewin_project_real-main/backend/logs/bullmq-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart settings
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      // Log rotation
      log_type: 'json',
      merge_logs: true,
      log_rotate_interval: '1d',
      log_rotate_max: 7,
      log_rotate_keep: 7
    }
  ],
  
  // Global PM2 settings
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'your-repo-url',
      path: '/home/ubuntu/duewin_project_real-main',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
}; 