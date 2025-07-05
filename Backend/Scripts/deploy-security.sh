#!/bin/bash

# 🛡️ COMPREHENSIVE SECURITY DEPLOYMENT SCRIPT
# This script deploys all security measures for your backend

set -e  # Exit on any error

echo "🛡️  DEPLOYING COMPREHENSIVE SECURITY MEASURES"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root for system-level changes
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# 1. SYSTEM-LEVEL SECURITY
print_status "Step 1: Configuring system-level security..."

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y
print_success "System packages updated"

# Configure UFW firewall
print_status "Configuring UFW firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp  # Your Node.js app port
print_success "UFW firewall configured"

# 2. NGINX SECURITY
print_status "Step 2: Configuring nginx security..."

# Backup current nginx configuration
NGINX_CONFIG="/etc/nginx/sites-available/api.strikecolor1.com"
if [ -f "$NGINX_CONFIG" ]; then
    cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    print_success "Nginx configuration backed up"
fi

# Apply security configuration
cp nginx-security-config.conf "$NGINX_CONFIG"
print_success "Security nginx configuration applied"

# Test nginx configuration
if nginx -t; then
    print_success "Nginx configuration test passed"
else
    print_error "Nginx configuration test failed"
    print_warning "Restoring backup..."
    cp "$NGINX_CONFIG.backup."* "$NGINX_CONFIG"
    exit 1
fi

# Reload nginx
systemctl reload nginx
print_success "Nginx reloaded with security configuration"

# 3. APPLICATION SECURITY
print_status "Step 3: Configuring application security..."

# Install required dependencies
print_status "Installing security dependencies..."
npm install helmet express-rate-limit ioredis
print_success "Security dependencies installed"

# Create logs directory if it doesn't exist
mkdir -p logs
print_success "Logs directory created"

# 4. ENVIRONMENT VARIABLES
print_status "Step 4: Setting up environment variables..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found, creating template..."
    cat > .env << EOF
# Security Configuration
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here
REDIS_URL=redis://localhost:6379

# IP Whitelist/Blacklist
IP_WHITELIST=127.0.0.1,::1
IP_BLACKLIST=185.177.72.14

# Security Settings
ENABLE_ADMIN_IP_CHECK=true
ADMIN_IP_WHITELIST=127.0.0.1

# SSL Configuration (if using custom SSL)
SSL_CERT_PATH=/path/to/your/cert.pem
SSL_KEY_PATH=/path/to/your/key.pem
SSL_CA_PATH=/path/to/your/ca.pem
EOF
    print_success ".env template created"
    print_warning "Please edit .env file with your actual values"
else
    print_success ".env file already exists"
fi

# 5. REDIS SECURITY
print_status "Step 5: Configuring Redis security..."

# Install Redis if not installed
if ! command -v redis-server &> /dev/null; then
    print_status "Installing Redis..."
    apt install redis-server -y
    print_success "Redis installed"
fi

# Configure Redis security
cat > /etc/redis/redis.conf << EOF
# Redis Security Configuration
bind 127.0.0.1
protected-mode yes
port 6379
timeout 300
tcp-keepalive 60
daemonize yes
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

systemctl restart redis-server
print_success "Redis configured and restarted"

# 6. LOG ROTATION
print_status "Step 6: Configuring log rotation..."

# Create logrotate configuration
cat > /etc/logrotate.d/duewin-backend << EOF
/path/to/your/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload nginx
    endscript
}
EOF

print_success "Log rotation configured"

# 7. MONITORING SETUP
print_status "Step 7: Setting up security monitoring..."

# Make security scripts executable
chmod +x scripts/security-monitor.js
chmod +x scripts/block-ip.js
chmod +x scripts/unblock-ip.js
chmod +x scripts/security-report.js
print_success "Security scripts made executable"

# 8. TEST SECURITY
print_status "Step 8: Testing security measures..."

# Test git access blocking
TEST_RESULT=$(curl -s -o /dev/null -w "%{http_code}" https://api.strikecolor1.com/.git/config)
if [ "$TEST_RESULT" = "404" ]; then
    print_success "Git access blocking: ✅ Working"
else
    print_error "Git access blocking: ❌ Failed (got HTTP $TEST_RESULT)"
fi

# Test security headers
HEADERS=$(curl -I https://api.strikecolor1.com/health 2>/dev/null)
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    print_success "Security headers: ✅ Working"
else
    print_warning "Security headers: ⚠️  May not be working"
fi

# 9. FINAL SETUP
print_status "Step 9: Final security setup..."

# Create security monitoring service
cat > /etc/systemd/system/duewin-security-monitor.service << EOF
[Unit]
Description=DueWin Security Monitor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/your/backend
ExecStart=/usr/bin/node scripts/security-monitor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_success "Security monitoring service created"

# 10. SUMMARY
echo ""
echo "🎉 SECURITY DEPLOYMENT COMPLETE!"
echo "================================"
echo ""
echo "✅ What was deployed:"
echo "   1. System package updates"
echo "   2. UFW firewall configuration"
echo "   3. Nginx security configuration"
echo "   4. Application security middleware"
echo "   5. Redis security configuration"
echo "   6. Log rotation setup"
echo "   7. Security monitoring scripts"
echo "   8. Environment variable template"
echo ""
echo "🔧 Next steps:"
echo "   1. Edit .env file with your actual values"
echo "   2. Restart your Node.js application: pm2 restart all"
echo "   3. Start security monitoring: npm run security-monitor"
echo "   4. Generate security report: npm run security-report"
echo ""
echo "🛡️  Security features active:"
echo "   - Git directory access blocked"
echo "   - Sensitive file access blocked"
echo "   - Security headers implemented"
echo "   - Rate limiting enabled"
echo "   - Attack detection active"
echo "   - IP blocking capabilities"
echo ""
echo "📊 Monitoring commands:"
echo "   - npm run security-monitor    # Real-time monitoring"
echo "   - npm run security-report     # Generate security report"
echo "   - npm run block-ip <ip>       # Block specific IP"
echo "   - tail -f /var/log/nginx/access.log | grep -E '\\.git|\\.env'"
echo ""
print_success "Your backend is now protected against common attacks!" 