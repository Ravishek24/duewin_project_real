# DueWin API Fixes - Deployment Checklist

## Files to Update on Server

- [x] models/WalletRecharge.js - Fixed model fields to match database schema
- [x] models/WalletWithdrawal.js - Added back transaction_id field to match database
- [x] services/walletServices.js - Fixed field names for database compatibility
- [x] controllers/paymentController.js - Added proper OKPAY integration
- [x] services/okPayService.js - Created new service for OKPAY integration
- [x] routes/paymentRoutes.js - Updated to use the new OKPAY callback controller

## Environment Variables to Check

- [ ] OKPAY_MCH_ID - Should be set to merchant ID provided by OKPAY (default: 1000 for testing)
- [ ] OKPAY_KEY - Should be set to API key provided by OKPAY (default: eb6080dbc8dc429ab86a1cd1c337975d for testing)
- [ ] OKPAY_HOST - Should be set to API host (default: sandbox.wpay.one for testing)
- [ ] FRONTEND_URL - Should be set to the URL where users will be redirected after payment

## Testing Steps

1. Check database connection
   ```
   node scripts/verify-db-connection.js
   ```

2. Verify model definitions match database schema
   ```
   node scripts/verify-models.js
   ```

3. Test wallet balance API
   ```
   node scripts/test-wallet-balance.js
   ```

4. Test payment gateway APIs and OKPAY integration
   ```
   node scripts/test-okpay.js
   ```

5. Restart the application after all changes
   ```
   pm2 restart duewin-backend
   ```

6. Monitor application logs for any errors
   ```
   pm2 logs duewin-backend
   ```

## Troubleshooting

If there are still issues after deployment:

1. Check route paths:
   - Make sure the payment gateway routes are correctly defined in routes/index.js
   - Verify that the API paths in test scripts match actual routes

2. Check OKPAY configuration:
   - Verify merchant ID and API key are correct
   - Test with both sandbox and production environments if needed

3. Check network connectivity:
   - Server needs to be able to connect to OKPAY API servers
   - For sandbox: sandbox.wpay.one
   - For production: api.wpay.one

4. Review error logs:
   - Check pm2 logs for detailed error messages
   - Look for connection issues, schema mismatches, or API errors

## Security Notes

- OKPAY API key should be kept secure and only set via environment variables
- In production, use HTTPS for all API endpoints
- Make sure callback URLs are properly secured
- Consider IP restrictions for OKPAY callbacks (whitelist OKPAY IPs) 