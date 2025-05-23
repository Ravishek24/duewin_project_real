#!/bin/bash

# Script to update OKPAY payment credentials in production
# This will ensure all configuration files use the same values

# Set your production credentials here
MERCHANT_ID="1285"
API_KEY="your_production_key_here"  # Replace with actual production key
HOST="sandbox.wpay.one"

# Run the update script
echo "Updating payment credentials..."
node scripts/update-payment-config.js $MERCHANT_ID $API_KEY $HOST

# Restart the application (uncomment one of these)
# pm2 restart app-name
# systemctl restart app-service

echo ""
echo "To verify the changes:"
echo "node scripts/check-payment-credentials.js"
echo ""
echo "Note: Make sure to restart your application after updating credentials" 