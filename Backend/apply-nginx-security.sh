#!/bin/bash

# 🔒 Nginx Security Configuration Update Script
# This script updates nginx configuration to preserve security headers

echo "🔒 Updating Nginx Configuration for Security Headers..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Backup current configuration
echo "📋 Creating backup of current configuration..."
cp /etc/nginx/sites-available/api.strikecolor1.com /etc/nginx/sites-available/api.strikecolor1.com.backup.$(date +%Y%m%d_%H%M%S)

# Copy new configuration
echo "📝 Applying new security configuration..."
cp nginx-security-config.conf /etc/nginx/sites-available/api.strikecolor1.com

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration test passed"
else
    echo "❌ Nginx configuration test failed"
    echo "🔄 Restoring backup..."
    cp /etc/nginx/sites-available/api.strikecolor1.com.backup.* /etc/nginx/sites-available/api.strikecolor1.com
    exit 1
fi

# Reload nginx
echo "🔄 Reloading nginx..."
if systemctl reload nginx; then
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Failed to reload nginx"
    echo "🔄 Restoring backup..."
    cp /etc/nginx/sites-available/api.strikecolor1.com.backup.* /etc/nginx/sites-available/api.strikecolor1.com
    systemctl reload nginx
    exit 1
fi

echo ""
echo "🎉 Security headers configuration applied successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Test your API endpoint: curl -I https://api.strikecolor1.com/health"
echo "2. Check security headers: curl -I https://api.strikecolor1.com/security-test"
echo "3. Run security scan again to verify headers are now visible"
echo ""
echo "🔍 To verify headers are working:"
echo "curl -I https://api.strikecolor1.com/health | grep -E '(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy)'" 