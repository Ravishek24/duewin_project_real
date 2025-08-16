const { getModels } = require('./models');
const { generateToken, generateRefreshToken } = require('./utils/jwt');
const createSessionService = require('./services/sessionService');

// Debug timing for login performance
const debugLoginTiming = async (phone_no, password) => {
    const timings = {};
    const startTime = process.hrtime.bigint();
    
    console.log('🔍 Starting detailed login performance analysis...');
    
    try {
        // 1. Model initialization timing
        const modelStart = process.hrtime.bigint();
        const models = await getModels();
        const sessionService = createSessionService(models);
        const User = models.User;
        const modelEnd = process.hrtime.bigint();
        timings.modelInit = Number(modelEnd - modelStart) / 1000000; // Convert to ms
        
        console.log(`📊 Model initialization: ${timings.modelInit.toFixed(2)}ms`);
        
        // 2. User query timing
        const queryStart = process.hrtime.bigint();
        const user = await User.findOne({
            where: { phone_no },
            attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified'],
            raw: false,
            benchmark: false,
            logging: false
        });
        const queryEnd = process.hrtime.bigint();
        timings.userQuery = Number(queryEnd - queryStart) / 1000000;
        
        console.log(`📊 User query: ${timings.userQuery.toFixed(2)}ms`);
        
        if (!user) {
            console.log('❌ User not found');
            return { error: 'User not found', timings };
        }
        
        if (user.is_blocked) {
            console.log('❌ User is blocked');
            return { error: 'User blocked', timings };
        }
        
        // 3. Password verification timing
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await user.checkPassword(password);
        const bcryptEnd = process.hrtime.bigint();
        timings.passwordCheck = Number(bcryptEnd - bcryptStart) / 1000000;
        
        console.log(`📊 Password verification: ${timings.passwordCheck.toFixed(2)}ms`);
        
        if (!isValidPassword) {
            console.log('❌ Invalid password');
            return { error: 'Invalid password', timings };
        }
        
        // 4. Session operations timing
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const deviceInfo = {
            userAgent: 'Debug-Test-Agent',
            ipAddress: '127.0.0.1',
            loginTime: now
        };
        
        const mockReq = {
            ip: '127.0.0.1',
            headers: { 'user-agent': 'Debug-Test-Agent' }
        };
        
        const session = await models.sequelize.transaction(async (t) => {
            // Create session with transaction
            const sessionResult = await sessionService.createSession(user.user_id, deviceInfo, mockReq, t);
            
            // Update last login info in the same transaction
            await user.update({ 
                last_login_at: now, 
                last_login_ip: '127.0.0.1'
            }, { transaction: t });
            
            return sessionResult;
        });
        
        const sessionEnd = process.hrtime.bigint();
        timings.sessionOps = Number(sessionEnd - sessionStart) / 1000000;
        
        console.log(`📊 Session operations: ${timings.sessionOps.toFixed(2)}ms`);
        
        // 5. JWT generation timing
        const jwtStart = process.hrtime.bigint();
        const accessToken = generateToken({
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        });
        const refreshToken = generateRefreshToken({
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        });
        const jwtEnd = process.hrtime.bigint();
        timings.jwtGeneration = Number(jwtEnd - jwtStart) / 1000000;
        
        console.log(`📊 JWT generation: ${timings.jwtGeneration.toFixed(2)}ms`);
        
        // Calculate total time
        const totalEnd = process.hrtime.bigint();
        timings.total = Number(totalEnd - startTime) / 1000000;
        
        console.log(`\n📈 PERFORMANCE SUMMARY:`);
        console.log(`├── Model Initialization: ${timings.modelInit.toFixed(2)}ms (${(timings.modelInit/timings.total*100).toFixed(1)}%)`);
        console.log(`├── User Query: ${timings.userQuery.toFixed(2)}ms (${(timings.userQuery/timings.total*100).toFixed(1)}%)`);
        console.log(`├── Password Check: ${timings.passwordCheck.toFixed(2)}ms (${(timings.passwordCheck/timings.total*100).toFixed(1)}%)`);
        console.log(`├── Session Operations: ${timings.sessionOps.toFixed(2)}ms (${(timings.sessionOps/timings.total*100).toFixed(1)}%)`);
        console.log(`├── JWT Generation: ${timings.jwtGeneration.toFixed(2)}ms (${(timings.jwtGeneration/timings.total*100).toFixed(1)}%)`);
        console.log(`└── TOTAL: ${timings.total.toFixed(2)}ms`);
        
        // Identify bottlenecks
        const bottlenecks = [];
        if (timings.modelInit > 50) bottlenecks.push('Model Initialization');
        if (timings.userQuery > 50) bottlenecks.push('Database Query');
        if (timings.passwordCheck > 150) bottlenecks.push('Password Verification');
        if (timings.sessionOps > 100) bottlenecks.push('Session Operations');
        if (timings.jwtGeneration > 20) bottlenecks.push('JWT Generation');
        
        if (bottlenecks.length > 0) {
            console.log(`\n⚠️  BOTTLENECKS DETECTED: ${bottlenecks.join(', ')}`);
        } else {
            console.log(`\n✅ No significant bottlenecks detected`);
        }
        
        return { 
            success: true, 
            timings,
            bottlenecks,
            user: {
                id: user.user_id,
                phone_no: user.phone_no,
                wallet_balance: user.wallet_balance
            },
            tokens: { accessToken, refreshToken },
            session: {
                deviceId: session.device_id,
                expiresAt: session.expires_at
            }
        };
        
    } catch (error) {
        const errorEnd = process.hrtime.bigint();
        timings.total = Number(errorEnd - startTime) / 1000000;
        console.error('❌ Login timing debug error:', error);
        return { error: error.message, timings };
    }
};

// Test with a sample user (you'll need to provide valid credentials)
const runTest = async () => {
    console.log('🚀 Login Performance Debug Tool');
    console.log('================================\n');
    
    // Replace these with actual test credentials
    const testPhone = process.argv[2] || '1234567890';
    const testPassword = process.argv[3] || 'testpassword';
    
    if (!process.argv[2] || !process.argv[3]) {
        console.log('Usage: node debug-login-timing.js <phone_number> <password>');
        console.log('Example: node debug-login-timing.js 1234567890 mypassword');
        process.exit(1);
    }
    
    const result = await debugLoginTiming(testPhone, testPassword);
    
    if (result.error) {
        console.log(`\n❌ Test failed: ${result.error}`);
    } else {
        console.log(`\n✅ Test completed successfully`);
    }
    
    console.log('\n📋 Raw timings object:', result.timings);
    
    process.exit(0);
};

// Run if called directly
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = { debugLoginTiming };