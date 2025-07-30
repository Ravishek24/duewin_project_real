const { connectDB, sequelize, getSequelizeInstance } = require('./config/db');

async function testDbConnection() {
    console.log('🚀 [DB_CONNECTION] Testing database connection...');
    
    try {
        // Test 1: Check initial state
        console.log('\n📊 Test 1: Initial state');
        console.log('Sequelize getter type:', typeof sequelize);
        console.log('Initial sequelize value:', sequelize);
        
        // Test 2: Connect to database
        console.log('\n📊 Test 2: Connect to database');
        await connectDB();
        console.log('✅ connectDB completed');
        
        // Test 3: Check sequelize after connection
        console.log('\n📊 Test 3: Sequelize after connection');
        const sequelizeInstance = sequelize;
        console.log('Sequelize type:', typeof sequelizeInstance);
        console.log('Sequelize value:', sequelizeInstance ? 'exists' : 'null');
        
        if (sequelizeInstance) {
            console.log('Sequelize constructor:', sequelizeInstance.constructor.name);
            console.log('Has transaction method:', typeof sequelizeInstance.transaction === 'function');
        }
        
        // Test 4: Test transaction creation
        console.log('\n📊 Test 4: Transaction creation');
        if (sequelizeInstance && typeof sequelizeInstance.transaction === 'function') {
            try {
                const transaction = await sequelizeInstance.transaction();
                console.log('✅ Transaction created successfully');
                await transaction.commit();
                console.log('✅ Transaction committed successfully');
            } catch (error) {
                console.log('❌ Transaction creation failed:', error.message);
            }
        } else {
            console.log('❌ Sequelize or transaction method not available');
        }
        
        // Test 5: Test authentication
        console.log('\n📊 Test 5: Database authentication');
        if (sequelizeInstance && typeof sequelizeInstance.authenticate === 'function') {
            try {
                await sequelizeInstance.authenticate();
                console.log('✅ Database authentication successful');
            } catch (error) {
                console.log('❌ Database authentication failed:', error.message);
            }
        } else {
            console.log('❌ Sequelize or authenticate method not available');
        }
        
        // Test 6: Test getSequelizeInstance function
        console.log('\n📊 Test 6: getSequelizeInstance function');
        try {
            const sequelizeFromFunction = await getSequelizeInstance();
            console.log('✅ getSequelizeInstance returned:', typeof sequelizeFromFunction, sequelizeFromFunction ? 'exists' : 'null');
            
            if (sequelizeFromFunction && typeof sequelizeFromFunction.transaction === 'function') {
                const transaction = await sequelizeFromFunction.transaction();
                await transaction.commit();
                console.log('✅ Transaction from getSequelizeInstance: SUCCESS');
            } else {
                console.log('❌ Transaction from getSequelizeInstance: FAILED');
            }
        } catch (error) {
            console.log('❌ getSequelizeInstance failed:', error.message);
        }
        
        // Summary
        console.log('\n📋 DB CONNECTION SUMMARY:');
        console.log('├─ connectDB function: Available');
        console.log('├─ sequelize getter: Available');
        console.log('├─ sequelize instance: ' + (sequelizeInstance ? 'Available' : 'Not available'));
        console.log('├─ transaction method: ' + (sequelizeInstance && typeof sequelizeInstance.transaction === 'function' ? 'Available' : 'Not available'));
        console.log('└─ authentication: ' + (sequelizeInstance && typeof sequelizeInstance.authenticate === 'function' ? 'Available' : 'Not available'));
        
        if (sequelizeInstance && typeof sequelizeInstance.transaction === 'function') {
            console.log('\n✅ DB CONNECTION: All tests passed!');
        } else {
            console.log('\n❌ DB CONNECTION: Issues detected');
        }
        
    } catch (error) {
        console.error('❌ [DB_CONNECTION] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testDbConnection().then(() => {
    console.log('\n🏁 [DB_CONNECTION] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [DB_CONNECTION] Test failed:', error);
    process.exit(1);
}); 