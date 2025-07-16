#!/bin/bash

# 🚀 Nginx Setup Script for New Server - api.strikecolor1.com
# This script sets up Nginx with SSL certificate and security configurations

echo "🚀 Setting up Nginx for api.strikecolor1.com..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL certificates
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Install additional dependencies
echo "📦 Installing additional dependencies..."
apt install -y curl wget unzip

# Create Nginx configuration directory structure
echo "📁 Creating Nginx configuration directories..."
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
mkdir -p /var/log/nginx

# Backup default Nginx configuration
echo "📋 Backing up default Nginx configuration..."
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Create optimized Nginx main configuration
echo "📝 Creating optimized Nginx main configuration..."
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:;" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# Create the site configuration for api.strikecolor1.com
echo "📝 Creating site configuration for api.strikecolor1.com..."
cat > /etc/nginx/sites-available/api.strikecolor1.com << 'EOF'
server {
    server_name api.strikecolor1.com;

    # 🔒 CRITICAL SECURITY: Block access to sensitive files and directories
    location ~ /\. {
        deny all;
        return 404;
    }

    # Block access to .git directory specifically
    location ~* /\.git {
        deny all;
        return 404;
    }

    # Block access to common sensitive files
    location ~* \.(git|env|config|ini|log|sql|bak|backup|old|tmp|temp)$ {
        deny all;
        return 404;
    }

    # Block access to hidden files
    location ~ /\. {
        deny all;
        return 404;
    }

    # Rate limiting for API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 🔒 SECURITY: Preserve all security headers from backend
        proxy_hide_header X-Powered-By;
        proxy_pass_header X-Frame-Options;
        proxy_pass_header X-Content-Type-Options;
        proxy_pass_header Content-Security-Policy;
        proxy_pass_header Referrer-Policy;
        proxy_pass_header Permissions-Policy;
        proxy_pass_header Strict-Transport-Security;
        proxy_pass_header X-XSS-Protection;
        proxy_pass_header X-Permitted-Cross-Domain-Policies;
        proxy_pass_header Cross-Origin-Opener-Policy;
        proxy_pass_header Cross-Origin-Embedder-Policy;
        
        # Additional security headers
        proxy_pass_header X-Download-Options;
        proxy_pass_header X-DNS-Prefetch-Control;
        proxy_pass_header X-Requested-With;
        
        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security test endpoint
    location /security-test {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Root endpoint
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 🔒 SECURITY: Preserve all security headers from backend
        proxy_hide_header X-Powered-By;
        proxy_pass_header X-Frame-Options;
        proxy_pass_header X-Content-Type-Options;
        proxy_pass_header Content-Security-Policy;
        proxy_pass_header Referrer-Policy;
        proxy_pass_header Permissions-Policy;
        proxy_pass_header Strict-Transport-Security;
        proxy_pass_header X-XSS-Protection;
        proxy_pass_header X-Permitted-Cross-Domain-Policies;
        proxy_pass_header Cross-Origin-Opener-Policy;
        proxy_pass_header Cross-Origin-Embedder-Policy;
        
        # Additional security headers
        proxy_pass_header X-Download-Options;
        proxy_pass_header X-DNS-Prefetch-Control;
        proxy_pass_header X-Requested-With;
        
        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 86400;
    }

    # HTTP to HTTPS redirect (will be managed by Certbot)
    listen 80;
    server_name api.strikecolor1.com;
}
EOF

# Enable the site
echo "🔗 Enabling the site configuration..."
ln -sf /etc/nginx/sites-available/api.strikecolor1.com /etc/nginx/sites-enabled/

# Remove default site
echo "🗑️ Removing default Nginx site..."
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration test passed"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Start and enable Nginx
echo "🚀 Starting and enabling Nginx..."
systemctl start nginx
systemctl enable nginx

# Check Nginx status
echo "📊 Checking Nginx status..."
systemctl status nginx --no-pager -l

echo ""
echo "🎉 Nginx setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your domain api.strikecolor1.com points to this server's IP"
echo "2. Run: sudo certbot --nginx -d api.strikecolor1.com"
echo "3. Test your API: curl -I http://api.strikecolor1.com/health"
echo ""
echo "🔍 To check if everything is working:"
echo "curl -I http://api.strikecolor1.com/health"
echo ""
echo "⚠️  IMPORTANT: Make sure your backend is running on port 8000 before testing!" 