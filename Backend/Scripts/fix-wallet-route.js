/**
 * Script to fix wallet route issues
 * Run with: node fix-wallet-route.js
 */

const { sequelize } = require('../config/db');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Token from your login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A';

async function fixWalletRoute() {
  console.log('Starting wallet route fix...');
  
  try {
    // 1. Verify database connection
    await sequelize.authenticate();
    console.log('✅ Database connection: OK');
    
    // 2. Check if user exists
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decodedToken.id;
    
    console.log(`Looking for user with ID: ${userId}`);
    const user = await User.findByPk(userId);
    
    if (!user) {
      console.log('❌ User not found, creating test user...');
      
      // Create a test user if not exists
      await sequelize.query(`
        INSERT INTO users (
          user_id, 
          user_name, 
          email, 
          phone_no, 
          password, 
          is_phone_verified,
          wallet_balance,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          'testuser',
          'test@example.com',
          '9876543210',
          '$2a$10$SAMPLE_HASH_FOR_TEST_USER',
          true,
          0.00,
          NOW(),
          NOW()
        )
      `);
      
      console.log('✅ Test user created successfully');
    } else {
      console.log('✅ User found:', {
        user_id: user.user_id,
        email: user.email,
        user_name: user.user_name,
        wallet_balance: user.wallet_balance
      });
    }
    
    // 3. Check wallet routes file
    const walletRoutesPath = path.join(__dirname, '..', 'routes', 'walletRoutes.js');
    const walletControllerPath = path.join(__dirname, '..', 'controllers', 'walletController.js');
    const walletServicesPath = path.join(__dirname, '..', 'services', 'walletServices.js');
    
    let routesExist = fs.existsSync(walletRoutesPath);
    let controllerExists = fs.existsSync(walletControllerPath);
    let servicesExist = fs.existsSync(walletServicesPath);
    
    console.log('\nChecking wallet route files:');
    console.log(`- walletRoutes.js: ${routesExist ? '✅ Found' : '❌ Not found'}`);
    console.log(`- walletController.js: ${controllerExists ? '✅ Found' : '❌ Not found'}`);
    console.log(`- walletServices.js: ${servicesExist ? '✅ Found' : '❌ Not found'}`);
    
    // 4. Check if routes are correctly exported and mounted in index.js
    const indexRoutesPath = path.join(__dirname, '..', 'routes', 'index.js');
    
    if (fs.existsSync(indexRoutesPath)) {
      const indexRoutes = fs.readFileSync(indexRoutesPath, 'utf8');
      const hasWalletRoutes = indexRoutes.includes('walletRoutes');
      
      console.log(`\nWallet routes mounted in index.js: ${hasWalletRoutes ? '✅ Yes' : '❌ No'}`);
      
      if (!hasWalletRoutes) {
        console.log('⚠️ The wallet routes might not be properly mounted in index.js');
        console.log('Please check if the following code exists in routes/index.js:');
        console.log('```');
        console.log('const walletRoutes = require(\'./walletRoutes\');');
        console.log('router.use(\'/wallet\', walletRoutes);');
        console.log('```');
      }
    } else {
      console.log('❌ routes/index.js not found');
    }
    
    // 5. Check for middleware issues
    if (fs.existsSync(walletRoutesPath)) {
      const walletRoutes = fs.readFileSync(walletRoutesPath, 'utf8');
      const hasAuthMiddleware = walletRoutes.includes('auth');
      
      console.log(`\nAuth middleware used in wallet routes: ${hasAuthMiddleware ? '✅ Yes' : '❌ No'}`);
      
      if (hasAuthMiddleware) {
        console.log('Checking auth middleware implementation...');
        
        const authMiddlewarePath = path.join(__dirname, '..', 'middlewares', 'authMiddleware.js');
        
        if (fs.existsSync(authMiddlewarePath)) {
          const authMiddleware = fs.readFileSync(authMiddlewarePath, 'utf8');
          
          // Check for common issues in auth middleware
          const userIdCheck = authMiddleware.includes('req.user.user_id') || 
                           authMiddleware.includes('req.user.id');
          
          console.log(`Auth middleware references user ID: ${userIdCheck ? '✅ Yes' : '❌ No'}`);
          
          if (!userIdCheck) {
            console.log('⚠️ There might be inconsistency in how user ID is referenced:');
            console.log('- Check if JWT payload stores ID as "id" but code expects "user_id"');
            console.log('- Or vice versa');
          }
          
          // Check JWT decode method
          const jwtVerify = authMiddleware.includes('jwt.verify');
          console.log(`JWT verify used: ${jwtVerify ? '✅ Yes' : '❌ No'}`);
        } else {
          console.log('❌ authMiddleware.js not found');
        }
      }
    }
    
    console.log('\n✅ Wallet route check completed');
    console.log('If issues persist, please consider these fixes:');
    console.log('1. Ensure middleware attaches user info with correct property names');
    console.log('2. Check if wallet service correctly identifies user with user_id/id');
    console.log('3. Ensure routes are properly mounted in express app');
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing wallet route:', error);
    return false;
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run if executed directly
if (require.main === module) {
  fixWalletRoute()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 