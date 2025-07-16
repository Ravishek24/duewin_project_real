# 🚀 New Server Setup Guide - api.strikecolor1.com

This guide will help you set up your new server with Nginx, SSL certificates, and all necessary configurations for your DueWin backend.

## 📋 Prerequisites

1. **Server Access**: Root access to your new server
2. **Domain**: `api.strikecolor1.com` pointing to your server's IP address
3. **Backend Code**: Your DueWin backend code ready to deploy

## 🔧 Step 1: Server Preparation

### 1.1 Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Essential Tools
```bash
sudo apt install -y curl wget git unzip build-essential
```

## 🐳 Step 2: Install Node.js and PM2

### 2.1 Install Node.js 18.x
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 2.2 Install PM2 for Process Management
```bash
sudo npm install -g pm2
```

## 🗄️ Step 3: Install and Configure Database

### 3.1 Install MySQL/MariaDB
```bash
sudo apt install -y mariadb-server mariadb-client

# Secure the installation
sudo mysql_secure_installation
```

### 3.2 Install Redis
```bash
sudo apt install -y redis-server

# Start and enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## 🌐 Step 4: Install and Configure Nginx

### 4.1 Run the Nginx Setup Script
```bash
# Make the script executable
chmod +x setup-nginx-new-server.sh

# Run the setup script
sudo ./setup-nginx-new-server.sh
```

### 4.2 Verify Nginx Installation
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t
```

## 🔒 Step 5: SSL Certificate Setup

### 5.1 Install Certbot (if not already installed)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Obtain SSL Certificate
```bash
# Make sure your domain points to this server first
sudo certbot --nginx -d api.strikecolor1.com

# Test certificate renewal
sudo certbot renew --dry-run
```

## 📦 Step 6: Deploy Your Backend

### 6.1 Upload Your Backend Code
```bash
# Create application directory
sudo mkdir -p /var/www/duewin-backend
sudo chown $USER:$USER /var/www/duewin-backend

# Upload your backend code to this directory
# You can use scp, git clone, or any method you prefer
```

### 6.2 Install Dependencies
```bash
cd /var/www/duewin-backend
npm install
```

### 6.3 Configure Environment Variables
```bash
# Copy your .env file
cp .env.example .env

# Edit the environment variables
nano .env
```

**Important Environment Variables:**
```env
NODE_ENV=production
SERVER_PORT=8000
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 6.4 Setup Database
```bash
# Run database migrations
npm run migrate

# Seed database if needed
npm run seed
```

## 🚀 Step 7: Start Your Application

### 7.1 Start with PM2
```bash
# Navigate to your backend directory
cd /var/www/duewin-backend

# Start the application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 7.2 Verify Application is Running
```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs

# Test the API
curl -I http://localhost:8000/health
```

## 🔍 Step 8: Testing and Verification

### 8.1 Test HTTP Access
```bash
# Test HTTP endpoint
curl -I http://api.strikecolor1.com/health

# Test security headers
curl -I http://api.strikecolor1.com/security-test
```

### 8.2 Test HTTPS Access
```bash
# Test HTTPS endpoint
curl -I https://api.strikecolor1.com/health

# Test security headers over HTTPS
curl -I https://api.strikecolor1.com/security-test
```

### 8.3 Test WebSocket Connection
```bash
# Test WebSocket endpoint
curl -I https://api.strikecolor1.com/socket.io/
```

## 🔧 Step 9: Security Hardening

### 9.1 Configure Firewall
```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable
```

### 9.2 Setup Log Rotation
```bash
# Create log rotation configuration
sudo tee /etc/logrotate.d/nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 nginx adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 \`cat /var/run/nginx.pid\`
        fi
    endscript
}
EOF
```

## 📊 Step 10: Monitoring Setup

### 10.1 Setup PM2 Monitoring
```bash
# Install PM2 monitoring
pm2 install pm2-server-monit

# Setup PM2 monitoring dashboard
pm2 install pm2-logrotate
```

### 10.2 Setup Log Monitoring
```bash
# Create log monitoring script
sudo tee /usr/local/bin/monitor-logs.sh << 'EOF'
#!/bin/bash
echo "=== Nginx Access Logs ==="
tail -n 20 /var/log/nginx/access.log

echo -e "\n=== Nginx Error Logs ==="
tail -n 20 /var/log/nginx/error.log

echo -e "\n=== PM2 Logs ==="
pm2 logs --lines 20
EOF

chmod +x /usr/local/bin/monitor-logs.sh
```

## 🔄 Step 11: Maintenance Scripts

### 11.1 Create Update Script
```bash
sudo tee /usr/local/bin/update-duewin.sh << 'EOF'
#!/bin/bash
echo "🔄 Updating DueWin Backend..."

cd /var/www/duewin-backend

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run migrate

# Restart application
pm2 restart all

echo "✅ Update completed!"
EOF

chmod +x /usr/local/bin/update-duewin.sh
```

### 11.2 Create Backup Script
```bash
sudo tee /usr/local/bin/backup-duewin.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/duewin"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u root -p your_database > $BACKUP_DIR/database_$DATE.sql

# Backup application
tar -czf $BACKUP_DIR/application_$DATE.tar.gz /var/www/duewin-backend

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR"
EOF

chmod +x /usr/local/bin/backup-duewin.sh
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. Nginx Not Starting
```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

#### 2. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check certificate expiration
sudo certbot certificates | grep "VALID"
```

#### 3. Application Not Starting
```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs

# Restart application
pm2 restart all
```

#### 4. Database Connection Issues
```bash
# Test MySQL connection
mysql -u your_user -p your_database

# Check MySQL status
sudo systemctl status mariadb

# Restart MySQL
sudo systemctl restart mariadb
```

#### 5. Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping

# Check Redis status
sudo systemctl status redis-server

# Restart Redis
sudo systemctl restart redis-server
```

## 📞 Support Commands

### Quick Status Check
```bash
echo "=== System Status ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "MySQL: $(systemctl is-active mariadb)"
echo "Redis: $(systemctl is-active redis-server)"
echo "PM2: $(pm2 status --no-daemon | head -n 5)"
```

### Quick Health Check
```bash
echo "=== Health Check ==="
curl -s https://api.strikecolor1.com/health | jq .
```

## ✅ Final Verification Checklist

- [ ] Domain `api.strikecolor1.com` points to server IP
- [ ] Nginx is running and serving content
- [ ] SSL certificate is installed and working
- [ ] Backend application is running on port 8000
- [ ] Database is accessible and migrations are complete
- [ ] Redis is running and accessible
- [ ] All security headers are present
- [ ] WebSocket connections are working
- [ ] Firewall is configured
- [ ] Log rotation is set up
- [ ] Monitoring is configured
- [ ] Backup scripts are in place

## 🎉 Congratulations!

Your new server is now set up and ready to serve your DueWin backend application. The setup includes:

- ✅ Nginx with optimized configuration
- ✅ SSL certificate with automatic renewal
- ✅ Security headers and rate limiting
- ✅ WebSocket support
- ✅ Process management with PM2
- ✅ Database and Redis setup
- ✅ Monitoring and backup scripts
- ✅ Firewall configuration

Your API is now accessible at: `https://api.strikecolor1.com` 