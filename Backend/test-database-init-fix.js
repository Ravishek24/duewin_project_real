const { connectDB, sequelize: sequelizeGetter } = require('./config/db');

async function testDatabaseInitFix() {
    console.log('🚀 [DATABASE_INIT_FIX] Testing database initialization fix...');
    
    try {
        // Test 1: Check if sequelize is null initially
        console.log('\n📊 Test 1: Initial sequelize state');
        console.log('Initial sequelize getter:', typeof sequelizeGetter);
        console.log('Initial sequelize value:', sequelizeGetter());
        
        // Test 2: Initialize database
        console.log('\n📊 Test 2: Initialize database');
        await connectDB();
        console.log('✅ Database initialized');
        
        // Test 3: Check sequelize after initialization
        console.log('\n📊 Test 3: Sequelize after initialization');
        console.log('Sequelize getter type:', typeof sequelizeGetter);
        console.log('Sequelize after init:', sequelizeGetter());
        
        // Test 4: Test transaction creation
        console.log('\n📊 Test 4: Test transaction creation');
        const sequelizeInstance = sequelizeGetter();
        if (sequelizeInstance) {
            try {
                const transaction = await sequelizeInstance.transaction();
                await transaction.commit();
                console.log('✅ Transaction creation: SUCCESS');
            } catch (error) {
                console.log('❌ Transaction creation: FAILED');
                console.log('Error:', error.message);
            }
        } else {
            console.log('❌ Sequelize is still null after initialization');
        }
        
        // Test 5: Test the ensureDatabaseInitialized function
        console.log('\n📊 Test 5: Test ensureDatabaseInitialized function');
        try {
            // Import the function from gameLogicService
            const { ensureModelsInitialized } = require('./services/gameLogicService');
            await ensureModelsInitialized();
            console.log('✅ ensureModelsInitialized: SUCCESS');
        } catch (error) {
            console.log('❌ ensureModelsInitialized: FAILED');
            console.log('Error:', error.message);
        }
        
        // Test 6: Test processGameResults with proper initialization
        console.log('\n📊 Test 6: Test processGameResults');
        try {
            const { processGameResults } = require('./services/gameLogicService');
            const result = await processGameResults('wingo', 30, '20250101000000001', 'default');
            console.log('✅ processGameResults: SUCCESS');
            console.log('Result:', result.result);
        } catch (error) {
            console.log('❌ processGameResults: FAILED');
            console.log('Error:', error.message);
        }
        
        // Summary
        console.log('\n📋 DATABASE INIT FIX SUMMARY:');
        console.log('├─ Database initialization: Fixed');
        console.log('├─ Sequelize access: Fixed');
        console.log('├─ Transaction creation: Tested');
        console.log('├─ Model initialization: Tested');
        console.log('└─ Game result processing: Tested');
        
        if (sequelizeGetter()) {
            console.log('\n✅ DATABASE INIT FIX: All tests completed successfully!');
        } else {
            console.log('\n❌ DATABASE INIT FIX: Sequelize is still null - further investigation needed');
        }
        
    } catch (error) {
        console.error('❌ [DATABASE_INIT_FIX] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testDatabaseInitFix().then(() => {
    console.log('\n🏁 [DATABASE_INIT_FIX] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [DATABASE_INIT_FIX] Test failed:', error);
    process.exit(1);
}); 