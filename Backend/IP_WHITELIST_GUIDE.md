# IP Whitelist Guide for Admin Access

## 🔍 **Current Configuration**

The admin exposure system uses IP whitelisting for security. Here's how to configure it:

## 📋 **Step 1: Find Your IP Address**

### Method 1: Check Your Public IP
```bash
# On Windows
curl https://api.ipify.org

# On Linux/Mac
curl ifconfig.me

# Or visit: https://whatismyipaddress.com
```

### Method 2: Check Local IP
```bash
# On Windows
ipconfig

# On Linux/Mac
ifconfig
# or
ip addr show
```

## ⚙️ **Step 2: Configure Environment Variables**

### Option 1: Add to .env file
```bash
# Add to Backend/.env file
ADMIN_IP_WHITELIST=127.0.0.1,::1,YOUR_PUBLIC_IP_HERE
ENABLE_ADMIN_IP_CHECK=true
```

### Option 2: Set Environment Variables
```bash
# Linux/Mac
export ADMIN_IP_WHITELIST="127.0.0.1,::1,YOUR_PUBLIC_IP_HERE"
export ENABLE_ADMIN_IP_CHECK=true

# Windows (PowerShell)
$env:ADMIN_IP_WHITELIST="127.0.0.1,::1,YOUR_PUBLIC_IP_HERE"
$env:ENABLE_ADMIN_IP_CHECK="true"
```

### Option 3: Production Server (PM2)
```bash
# Add to ecosystem.config.js
module.exports = {
  apps: [{
    name: 'backend',
    script: 'index.js',
    env: {
      ADMIN_IP_WHITELIST: '127.0.0.1,::1,YOUR_PUBLIC_IP_HERE',
      ENABLE_ADMIN_IP_CHECK: 'true'
    }
  }]
}
```

## 🔧 **Step 3: IP Whitelist Examples**

### For Local Development
```bash
ADMIN_IP_WHITELIST=127.0.0.1,::1
ENABLE_ADMIN_IP_CHECK=true
```

### For Production with Multiple Admins
```bash
ADMIN_IP_WHITELIST=127.0.0.1,::1,203.0.113.1,198.51.100.1,192.168.1.100
ENABLE_ADMIN_IP_CHECK=true
```

### For Testing (Allow All IPs)
```bash
ADMIN_IP_WHITELIST=*
ENABLE_ADMIN_IP_CHECK=true
```

### Disable IP Check (Not Recommended for Production)
```bash
ENABLE_ADMIN_IP_CHECK=false
```

## 🧪 **Step 4: Test Your Configuration**

### Test Script
```bash
# Run the test script
cd Backend
node test-ip-whitelist.js
```

### Manual Test
```bash
# Test admin login
curl -X POST http://localhost:8000/api/admin/direct-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'

# Test exposure endpoint (replace TOKEN with actual token)
curl http://localhost:8000/api/admin/exposure/all \
  -H "Authorization: Bearer TOKEN"
```

## 🚨 **Common Issues & Solutions**

### Issue 1: 403 Forbidden Error
**Symptoms:** `Access denied. Your IP is not authorized for admin access.`

**Solutions:**
1. Add your IP to `ADMIN_IP_WHITELIST`
2. Restart the server after changing environment variables
3. Check if `ENABLE_ADMIN_IP_CHECK=true`

### Issue 2: Dynamic IP Address
**Problem:** Your IP changes frequently

**Solutions:**
1. Use a static IP from your ISP
2. Use a VPN with static IP
3. Temporarily disable IP check: `ENABLE_ADMIN_IP_CHECK=false`

### Issue 3: Behind Proxy/Load Balancer
**Problem:** Server sees proxy IP instead of client IP

**Solutions:**
1. Configure proxy to forward real IP
2. Add proxy IPs to whitelist
3. Trust proxy headers in nginx/apache

## 📊 **Current Whitelist Status**

### Check Current Configuration
```bash
# On server, check environment variables
echo $ADMIN_IP_WHITELIST
echo $ENABLE_ADMIN_IP_CHECK

# Check server logs for IP access attempts
tail -f logs/app.log | grep "Admin access attempt"
```

### View Allowed IPs
```javascript
// In your Node.js app
console.log('Whitelisted IPs:', process.env.ADMIN_IP_WHITELIST?.split(','));
console.log('IP Check Enabled:', process.env.ENABLE_ADMIN_IP_CHECK);
```

## 🔒 **Security Best Practices**

### 1. Use Specific IPs
```bash
# Good - Specific IPs
ADMIN_IP_WHITELIST=203.0.113.1,198.51.100.1

# Bad - Too broad
ADMIN_IP_WHITELIST=203.0.113.*
```

### 2. Regular IP Updates
```bash
# Check your IP regularly
curl https://api.ipify.org

# Update whitelist when IP changes
```

### 3. Monitor Access Logs
```bash
# Check for unauthorized access attempts
grep "Unauthorized admin access" logs/app.log
```

### 4. Use VPN for Remote Access
```bash
# Connect to VPN first, then access admin panel
# Add VPN IP to whitelist
ADMIN_IP_WHITELIST=127.0.0.1,::1,VPN_IP_HERE
```

## 🎯 **Quick Setup Commands**

### For Local Development
```bash
# Add to .env file
echo "ADMIN_IP_WHITELIST=127.0.0.1,::1" >> .env
echo "ENABLE_ADMIN_IP_CHECK=true" >> .env

# Restart server
pm2 restart backend
```

### For Production
```bash
# Get your current IP
CURRENT_IP=$(curl -s https://api.ipify.org)

# Add to environment
echo "ADMIN_IP_WHITELIST=127.0.0.1,::1,$CURRENT_IP" >> .env
echo "ENABLE_ADMIN_IP_CHECK=true" >> .env

# Restart server
pm2 restart backend
```

## ✅ **Verification Checklist**

- [ ] Your IP is in `ADMIN_IP_WHITELIST`
- [ ] `ENABLE_ADMIN_IP_CHECK=true`
- [ ] Server restarted after changes
- [ ] Admin login works
- [ ] Exposure endpoints accessible
- [ ] No 403 errors in logs

## 🆘 **Emergency Access**

If you're locked out:

### Temporary Disable IP Check
```bash
# Set environment variable
export ENABLE_ADMIN_IP_CHECK=false

# Restart server
pm2 restart backend
```

### Add Your IP Immediately
```bash
# Get your current IP
curl https://api.ipify.org

# Add to whitelist
export ADMIN_IP_WHITELIST="127.0.0.1,::1,$(curl -s https://api.ipify.org)"

# Restart server
pm2 restart backend
```

## 📞 **Need Help?**

If you're still having issues:

1. **Check server logs:** `tail -f logs/app.log`
2. **Verify environment:** `echo $ADMIN_IP_WHITELIST`
3. **Test connection:** `curl -I http://localhost:8000/health`
4. **Check IP detection:** Look for "Admin access attempt from IP" in logs

The IP whitelist is a security feature to prevent unauthorized admin access. Make sure to add your IP address to the whitelist before accessing the admin exposure system. 