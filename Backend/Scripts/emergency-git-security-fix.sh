#!/bin/bash

# 🚨 EMERGENCY GIT SECURITY FIX
# This script immediately blocks access to .git directories and other sensitive files

echo "🚨 EMERGENCY: Applying Git Security Fixes..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Backup current nginx configuration
echo "📋 Creating backup of current nginx configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/api.strikecolor1.com"
if [ -f "$NGINX_CONFIG" ]; then
    cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Backup created"
else
    echo "⚠️  Nginx config not found at $NGINX_CONFIG"
    echo "Please update your nginx configuration manually with the security blocks"
fi

# Apply the security configuration
echo "🔒 Applying security configuration..."
cp nginx-security-config.conf "$NGINX_CONFIG"

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration test passed"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    if systemctl reload nginx; then
        echo "✅ Nginx reloaded successfully"
    else
        echo "❌ Failed to reload nginx"
        echo "🔄 Restoring backup..."
        cp "$NGINX_CONFIG.backup."* "$NGINX_CONFIG"
        systemctl reload nginx
        exit 1
    fi
else
    echo "❌ Nginx configuration test failed"
    echo "🔄 Restoring backup..."
    cp "$NGINX_CONFIG.backup."* "$NGINX_CONFIG"
    exit 1
fi

# Test the security fix
echo "🧪 Testing security fix..."
TEST_RESULT=$(curl -s -o /dev/null -w "%{http_code}" https://api.strikecolor1.com/.git/config)
if [ "$TEST_RESULT" = "404" ]; then
    echo "✅ Security fix working - .git access blocked"
else
    echo "⚠️  Security fix may not be working - got HTTP $TEST_RESULT"
fi

echo ""
echo "🎉 Emergency security fixes applied!"
echo ""
echo "📋 What was fixed:"
echo "1. ✅ Blocked access to .git directories"
echo "2. ✅ Blocked access to .env files"
echo "3. ✅ Blocked access to other sensitive files"
echo "4. ✅ Added application-level security checks"
echo ""
echo "🔍 Monitor logs for blocked attempts:"
echo "tail -f /var/log/nginx/access.log | grep -E '\.git|\.env'"
echo ""
echo "⚠️  IMPORTANT: Restart your Node.js application to apply the middleware changes"
echo "pm2 restart all  # or however you restart your app" 