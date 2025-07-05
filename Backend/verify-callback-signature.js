// Load environment variables first
require('dotenv').config();

// Debug environment variables
console.log('🔧 Environment Variables Debug:');
console.log(`PPAYPRO_MCH_NO: ${process.env.PPAYPRO_MCH_NO || 'NOT SET'}`);
console.log(`PPAYPRO_APP_ID: ${process.env.PPAYPRO_APP_ID || 'NOT SET'}`);
console.log(`PPAYPRO_KEY: ${process.env.PPAYPRO_KEY ? 'SET (hidden)' : 'NOT SET'}`);
console.log(`PPAYPRO_HOST: ${process.env.PPAYPRO_HOST || 'NOT SET'}`);
console.log('');

const crypto = require('crypto');
const ppayProConfig = require('./config/ppayProConfig');

// Generate PPayPro signature (MD5, uppercase)
function generatePpayProSignature(params, privateKey = ppayProConfig.key) {
    // 1. Filter out undefined/null/empty values and 'sign' key
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    
    // 3. Join as key=value&key=value
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    
    // 4. Append &key=PRIVATE_KEY
    const stringToSign = `${joined}&key=${privateKey}`;
    
    // 5. MD5 hash, uppercase
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

// Test the actual callback data we received
function testCallbackSignature() {
    console.log('🔍 Verifying PPayPro Callback Signature...\n');
    
    // The actual callback data we received
    const receivedCallbackData = {
        payOrderId: 'P1939717303078371329',
        mchOrderNo: 'PIPP175129961715113',
        amount: '100000',
        state: '2',
        currency: 'INR',
        createdAt: '1751299618097',
        successTime: '1751299618097',
        sign: 'E1420259C03173B51C0F8869ACE0F5C7'
    };
    
    console.log('📥 Received Callback Data:');
    console.log(JSON.stringify(receivedCallbackData, null, 2));
    
    // Extract the received signature
    const receivedSignature = receivedCallbackData.sign;
    console.log(`\n🔐 Received Signature: ${receivedSignature}`);
    
    // Calculate our expected signature
    const calculatedSignature = generatePpayProSignature(receivedCallbackData);
    console.log(`🔐 Calculated Signature: ${calculatedSignature}`);
    
    // Compare signatures
    console.log('\n📊 Signature Comparison:');
    console.log('='.repeat(50));
    
    if (receivedSignature === calculatedSignature) {
        console.log('✅ SUCCESS: Signatures match!');
        console.log('✅ The callback signature is valid');
    } else {
        console.log('❌ FAILED: Signatures do not match!');
        console.log('❌ This explains why the callback was not processed');
        
        // Show signature generation details
        console.log('\n🔍 Signature Generation Details:');
        const filtered = Object.entries(receivedCallbackData)
            .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
            .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
        
        const sortedKeys = Object.keys(filtered).sort();
        const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
        const stringToSign = `${joined}&key=${ppayProConfig.key}`;
        
        console.log('Filtered params:', filtered);
        console.log('Sorted keys:', sortedKeys);
        console.log('String to sign:', stringToSign);
    }
    
    // Check PPayPro config
    console.log('\n🔧 PPayPro Configuration:');
    console.log(`- mchNo: ${ppayProConfig.mchNo}`);
    console.log(`- appId: ${ppayProConfig.appId}`);
    console.log(`- key: ${ppayProConfig.key ? 'Present' : 'Missing'}`);
    console.log(`- host: ${ppayProConfig.host}`);
}

// Test with different signature generation methods
function testAlternativeSignatures() {
    console.log('\n🧪 Testing Alternative Signature Methods...\n');
    
    const callbackData = {
        payOrderId: 'P1939717303078371329',
        mchOrderNo: 'PIPP175129961715113',
        amount: '100000',
        state: '2',
        currency: 'INR',
        createdAt: '1751299618097',
        successTime: '1751299618097'
    };
    
    const expectedSignature = 'E1420259C03173B51C0F8869ACE0F5C7';
    
    // Method 1: Our current method
    const signature1 = generatePpayProSignature(callbackData);
    console.log(`Method 1 (Current): ${signature1} - ${signature1 === expectedSignature ? '✅' : '❌'}`);
    
    // Method 2: Without filtering empty values
    const signature2 = crypto.createHash('md5')
        .update(`amount=100000&createdAt=1751299618097&currency=INR&mchOrderNo=PIPP175129961715113&payOrderId=P1939717303078371329&state=2&successTime=1751299618097&key=${ppayProConfig.key}`)
        .digest('hex').toUpperCase();
    console.log(`Method 2 (Direct): ${signature2} - ${signature2 === expectedSignature ? '✅' : '❌'}`);
    
    // Method 3: Different key order
    const signature3 = crypto.createHash('md5')
        .update(`createdAt=1751299618097&currency=INR&mchOrderNo=PIPP175129961715113&payOrderId=P1939717303078371329&state=2&successTime=1751299618097&amount=100000&key=${ppayProConfig.key}`)
        .digest('hex').toUpperCase();
    console.log(`Method 3 (Different order): ${signature3} - ${signature3 === expectedSignature ? '✅' : '❌'}`);
}

// Main function
function main() {
    console.log('🚀 PPayPro Callback Signature Verification\n');
    
    testCallbackSignature();
    testAlternativeSignatures();
    
    console.log('\n✅ Signature verification completed!');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    generatePpayProSignature,
    testCallbackSignature
}; 