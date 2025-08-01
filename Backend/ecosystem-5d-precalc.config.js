module.exports = {
  apps: [
    {
      name: '5d-precalc-scheduler',
      script: './scripts/5dPreCalcScheduler.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      // Logging configuration
      log_file: './logs/5d-precalc-scheduler.log',
      out_file: './logs/5d-precalc-scheduler-out.log',
      error_file: './logs/5d-precalc-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      
      // Health check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Environment variables
      env_file: '.env',
      
      // Kill timeout
      kill_timeout: 5000,
      
      // Listen timeout
      listen_timeout: 8000,
      
      // PM2 specific
      pmx: true,
      source_map_support: true,
      
      // Node.js specific
      node_args: '--max-old-space-size=512',
      
      // Cron restart (optional - restart daily at 2 AM)
      cron_restart: '0 2 * * *',
      
      // Merge logs
      merge_logs: true,
      
      // Disable source map
      disable_source_map_support: false,
      
      // Enable PMX
      pmx: true,
      
      // Enable source map support
      source_map_support: true,
      
      // Enable PM2 monitoring
      pmx_module: true,
      
      // Enable PM2 profiling
      pmx_profiling: false,
      
      // Enable PM2 metrics
      pmx_metrics: true,
      
      // Enable PM2 actions
      pmx_actions: true,
      
      // Enable PM2 notifications
      pmx_notifications: true,
      
      // Enable PM2 dashboard
      pmx_dashboard: false,
      
      // Enable PM2 web interface
      pmx_web: false,
      
      // Enable PM2 API
      pmx_api: false,
      
      // Enable PM2 CLI
      pmx_cli: false,
      
      // Enable PM2 GUI
      pmx_gui: false,
      
      // Enable PM2 monitoring
      pmx_monitoring: true,
      
      // Enable PM2 profiling
      pmx_profiling: false,
      
      // Enable PM2 metrics
      pmx_metrics: true,
      
      // Enable PM2 actions
      pmx_actions: true,
      
      // Enable PM2 notifications
      pmx_notifications: true,
      
      // Enable PM2 dashboard
      pmx_dashboard: false,
      
      // Enable PM2 web interface
      pmx_web: false,
      
      // Enable PM2 API
      pmx_api: false,
      
      // Enable PM2 CLI
      pmx_cli: false,
      
      // Enable PM2 GUI
      pmx_gui: false
    }
  ],
  
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-repo-url',
      path: '/var/www/5d-precalc-scheduler',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem-5d-precalc.config.js --env production',
      'pre-setup': ''
    }
  }
}; 