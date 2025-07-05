const fs = require('fs');
const path = require('path');

// View PPayPro deposit order logs
function viewDepositOrderLogs() {
    console.log('📋 PPayPro Deposit Order Logs\n');
    
    const logFile = path.join(__dirname, 'logs', 'ppaypro-deposit-orders.log');
    
    if (!fs.existsSync(logFile)) {
        console.log('❌ No PPayPro deposit order log file found');
        console.log('Expected location:', logFile);
        console.log('\n💡 To generate logs, initiate a PPayPro deposit order');
        return;
    }
    
    try {
        const logContent = fs.readFileSync(logFile, 'utf8');
        console.log('✅ Found PPayPro deposit order log file');
        
        // Parse and display logs
        const logEntries = logContent.split('\n[').filter(entry => entry.trim());
        
        console.log(`📊 Total deposit orders: ${logEntries.length}\n`);
        
        logEntries.forEach((entry, index) => {
            try {
                const timestamp = entry.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
                const jsonStart = entry.indexOf('{');
                const jsonContent = entry.substring(jsonStart);
                const data = JSON.parse(jsonContent);
                
                console.log(`\n${'='.repeat(80)}`);
                console.log(`📅 Order ${index + 1} - ${timestamp ? timestamp[1] : 'Unknown time'}`);
                console.log(`${'='.repeat(80)}`);
                
                // Display key information
                console.log('🎯 Order Information:');
                console.log(`  - User ID: ${data.orderInfo?.userId}`);
                console.log(`  - Your Order ID: ${data.orderInfo?.orderId}`);
                console.log(`  - PPayPro Order ID: ${data.orderInfo?.payOrderId}`);
                console.log(`  - Amount: ₹${data.orderInfo?.amountRupees} (${data.orderInfo?.amountPaisa} paisa)`);
                console.log(`  - Gateway ID: ${data.orderInfo?.gatewayId}`);
                
                console.log('\n🔗 Callback Information:');
                console.log(`  - Callback URL: ${data.callbackInfo?.callbackUrl}`);
                console.log(`  - Expected Signature: ${data.callbackInfo?.expectedCallbackData?.sign}`);
                
                console.log('\n📤 Expected Callback Payload:');
                console.log(JSON.stringify(data.callbackInfo?.expectedCallbackData, null, 2));
                
                console.log('\n📝 cURL Command:');
                const callbackData = data.callbackInfo?.expectedCallbackData;
                if (callbackData) {
                    const curlCmd = `curl -X POST "${data.callbackInfo.callbackUrl}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "payOrderId=${callbackData.payOrderId}&mchOrderNo=${callbackData.mchOrderNo}&amount=${callbackData.amount}&state=2&currency=INR&createdAt=${Date.now()}&successTime=${Date.now()}&sign=${callbackData.sign}"`;
                    console.log(curlCmd);
                }
                
                console.log('\n📝 Postman Body (x-www-form-urlencoded):');
                if (callbackData) {
                    console.log(`payOrderId=${callbackData.payOrderId}`);
                    console.log(`mchOrderNo=${callbackData.mchOrderNo}`);
                    console.log(`amount=${callbackData.amount}`);
                    console.log(`state=2`);
                    console.log(`currency=INR`);
                    console.log(`createdAt=${Date.now()}`);
                    console.log(`successTime=${Date.now()}`);
                    console.log(`sign=${callbackData.sign}`);
                }
                
            } catch (parseError) {
                console.log(`❌ Error parsing log entry ${index + 1}:`, parseError.message);
                console.log('Raw entry:', entry.substring(0, 200) + '...');
            }
        });
        
        console.log(`\n${'='.repeat(80)}`);
        console.log('✅ Log analysis completed!');
        console.log(`📄 Full log file: ${logFile}`);
        
    } catch (error) {
        console.error('❌ Error reading log file:', error.message);
    }
}

// Show latest order only
function showLatestOrder() {
    console.log('📋 Latest PPayPro Deposit Order\n');
    
    const logFile = path.join(__dirname, 'logs', 'ppaypro-deposit-orders.log');
    
    if (!fs.existsSync(logFile)) {
        console.log('❌ No PPayPro deposit order log file found');
        return;
    }
    
    try {
        const logContent = fs.readFileSync(logFile, 'utf8');
        const logEntries = logContent.split('\n[').filter(entry => entry.trim());
        
        if (logEntries.length === 0) {
            console.log('❌ No deposit orders found in log');
            return;
        }
        
        const latestEntry = logEntries[logEntries.length - 1];
        const jsonStart = latestEntry.indexOf('{');
        const jsonContent = latestEntry.substring(jsonStart);
        const data = JSON.parse(jsonContent);
        
        console.log('🎯 Latest Order Details:');
        console.log(`  - User ID: ${data.orderInfo?.userId}`);
        console.log(`  - Your Order ID: ${data.orderInfo?.orderId}`);
        console.log(`  - PPayPro Order ID: ${data.orderInfo?.payOrderId}`);
        console.log(`  - Amount: ₹${data.orderInfo?.amountRupees} (${data.orderInfo?.amountPaisa} paisa)`);
        
        console.log('\n📤 Callback Details:');
        console.log(`  - URL: ${data.callbackInfo?.callbackUrl}`);
        console.log(`  - Payload:`, JSON.stringify(data.callbackInfo?.expectedCallbackData, null, 2));
        
    } catch (error) {
        console.error('❌ Error reading latest order:', error.message);
    }
}

// Main function
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--latest') || args.includes('-l')) {
        showLatestOrder();
    } else {
        viewDepositOrderLogs();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    viewDepositOrderLogs,
    showLatestOrder
}; 