const mysql = require('mysql2/promise');

async function checkWowPayTransactions() {
    console.log('🔍 Checking WowPay Transactions (Direct SQL)');
    console.log('============================================');
    
    let connection;
    
    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: 'database-1.chw2iae8s9ej.eu-north-1.rds.amazonaws.com',
            port: 3306,
            user: 'admin',
            password: process.env.DB_PASS,
            database: 'duewin'
        });
        
        console.log('✅ Connected to database');
        
        // 1. Check wallet_recharges table structure
        console.log('\n1. Table Structure:');
        console.log('-------------------');
        const [columns] = await connection.execute('DESCRIBE wallet_recharges');
        console.log('Available columns:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        
        // 2. Check recent WowPay transactions
        console.log('\n2. Recent WowPay-related Transactions:');
        console.log('-------------------------------------');
        
        const [transactions] = await connection.execute(`
            SELECT 
                id, user_id, amount, order_id, transaction_id, 
                payment_gateway_id, status, created_at, updated_at
            FROM wallet_recharges 
            WHERE order_id LIKE '%TPOLY%' OR order_id LIKE '%PIWO%'
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        if (transactions.length === 0) {
            console.log('❌ No WowPay transactions found');
        } else {
            console.log(`✅ Found ${transactions.length} WowPay transactions:`);
            console.log('');
            
            transactions.forEach((tx, index) => {
                console.log(`${index + 1}. Order ID: ${tx.order_id}`);
                console.log(`   Transaction ID: ${tx.transaction_id}`);
                console.log(`   Amount: ${tx.amount}`);
                console.log(`   Status: ${tx.status}`);
                console.log(`   User ID: ${tx.user_id}`);
                console.log(`   Gateway ID: ${tx.payment_gateway_id}`);
                console.log(`   Created: ${tx.created_at}`);
                console.log(`   Updated: ${tx.updated_at}`);
                console.log('   ---');
            });
        }
        
        // 3. Check for your specific test order
        console.log('\n3. Your Test Order Check:');
        console.log('-------------------------');
        
        const [specificOrder] = await connection.execute(`
            SELECT * FROM wallet_recharges 
            WHERE order_id LIKE '%TPOLY2025062800013%' 
            OR transaction_id LIKE '%TPOLY2025062800013%'
        `);
        
        if (specificOrder.length > 0) {
            const order = specificOrder[0];
            console.log('✅ Found your test order:');
            console.log(`   Order ID: ${order.order_id}`);
            console.log(`   Transaction ID: ${order.transaction_id}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   Amount: ${order.amount}`);
            console.log(`   User ID: ${order.user_id}`);
            console.log(`   Created: ${order.created_at}`);
            console.log(`   Updated: ${order.updated_at}`);
            
            if (order.status === 'completed') {
                console.log('🎉 Payment completed successfully!');
            } else if (order.status === 'pending') {
                console.log('⏳ Payment still pending');
            } else {
                console.log(`⚠️ Payment status: ${order.status}`);
            }
        } else {
            console.log('❌ Your test order not found in database');
        }
        
        // 4. Check payment gateway info
        console.log('\n4. Payment Gateway Information:');
        console.log('-------------------------------');
        
        const [gateways] = await connection.execute(`
            SELECT * FROM payment_gateways 
            WHERE code = 'WOWPAY' OR name LIKE '%wow%'
        `);
        
        if (gateways.length > 0) {
            gateways.forEach(gw => {
                console.log(`Gateway: ${gw.name} (${gw.code})`);
                console.log(`  ID: ${gw.gateway_id}`);
                console.log(`  Active: ${gw.is_active}`);
            });
        }
        
        // 5. Check transaction counts by status
        console.log('\n5. Transaction Status Summary:');
        console.log('------------------------------');
        
        const [statusCounts] = await connection.execute(`
            SELECT status, COUNT(*) as count 
            FROM wallet_recharges 
            WHERE order_id LIKE '%TPOLY%' OR order_id LIKE '%PIWO%'
            GROUP BY status
        `);
        
        if (statusCounts.length > 0) {
            statusCounts.forEach(stat => {
                console.log(`  ${stat.status}: ${stat.count} transactions`);
            });
        } else {
            console.log('  No WowPay transactions found');
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('💡 Check database credentials');
        } else if (error.code === 'ENOTFOUND') {
            console.log('💡 Check database host connection');
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Database connection closed');
        }
    }
}

checkWowPayTransactions().catch(console.error); 