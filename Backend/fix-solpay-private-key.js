const crypto = require('crypto');
require('dotenv').config();

console.log('🔧 Fixing SolPay Private Key Format');
console.log('===================================');

// Current SolPay Configuration
const currentPrivateKey = process.env.SOLPAY_PRIVATE_KEY || "keghdfjsdgfjsdgdfjkaessfvsddkjhasdjghjksdgfkluidfhdjkghdksjgdjyvghjcbvbgyffsetqweiwptoerfgkmf";

console.log('\n📋 Current Private Key:');
console.log('=======================');
console.log('Length:', currentPrivateKey.length);
console.log('Format:', currentPrivateKey.includes('BEGIN') ? 'PEM' : 'Base64/Raw');
console.log('Key (first 50 chars):', currentPrivateKey.substring(0, 50) + '...');

// Test different private key formats
function testPrivateKeyFormats() {
  console.log('\n🧪 Testing Private Key Formats');
  console.log('==============================');
  
  const testParams = {
    merchantCode: 'S820250509125213000',
    queryType: 'BALANCE_QUERY'
  };
  
  const formats = [
    {
      name: '1️⃣ Current Key (Raw)',
      key: currentPrivateKey
    },
    {
      name: '2️⃣ PEM Format (PKCS#8)',
      key: '-----BEGIN PRIVATE KEY-----\n' + currentPrivateKey + '\n-----END PRIVATE KEY-----'
    },
    {
      name: '3️⃣ PEM Format (RSA)',
      key: '-----BEGIN RSA PRIVATE KEY-----\n' + currentPrivateKey + '\n-----END RSA PRIVATE KEY-----'
    },
    {
      name: '4️⃣ Base64 Decoded (if possible)',
      key: Buffer.from(currentPrivateKey, 'base64').toString('utf8')
    }
  ];
  
  for (const format of formats) {
    console.log(`\n${format.name}:`);
    try {
      // Test if the key can be used for signing
      const filtered = Object.entries(testParams)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
      
      const sortedKeys = Object.keys(filtered).sort();
      const strX = sortedKeys.map(key => String(filtered[key])).join('');
      
      const signer = crypto.createSign('RSA-SHA1');
      signer.update(strX, 'utf8');
      signer.end();
      
      const signature = signer.sign(format.key, 'base64');
      console.log(`✅ Success: Signature generated (${signature.length} chars)`);
      console.log(`   Signature: ${signature.substring(0, 50)}...`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (error.code === 'ERR_OSSL_UNSUPPORTED') {
        console.log(`   🔧 This is the format causing the DECODER error!`);
      }
    }
  }
}

// Generate a test private key to verify the signing process works
function testWithValidKey() {
  console.log('\n🔧 Testing with Valid RSA Key');
  console.log('=============================');
  
  try {
    // Generate a test RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    console.log('✅ Generated test RSA key pair');
    
    const testParams = {
      merchantCode: 'S820250509125213000',
      queryType: 'BALANCE_QUERY'
    };
    
    // Test signing with valid key
    const filtered = Object.entries(testParams)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    
    const sortedKeys = Object.keys(filtered).sort();
    const strX = sortedKeys.map(key => String(filtered[key])).join('');
    
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(strX, 'utf8');
    signer.end();
    
    const signature = signer.sign(privateKey, 'base64');
    console.log('✅ Valid key signing successful');
    console.log('Signature:', signature);
    
    // Test verification
    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(strX, 'utf8');
    verifier.end();
    
    const isValid = verifier.verify(publicKey, signature, 'base64');
    console.log('✅ Signature verification:', isValid ? 'PASSED' : 'FAILED');
    
  } catch (error) {
    console.log('❌ Test key generation failed:', error.message);
  }
}

// Provide solutions
function provideSolutions() {
  console.log('\n💡 Solutions for SolPay Private Key Issue');
  console.log('==========================================');
  
  console.log('\n🔧 Issue Identified:');
  console.log('The private key format is causing the "DECODER routines::unsupported" error.');
  console.log('This happens when the private key is not in a valid RSA format.');
  
  console.log('\n📋 Possible Solutions:');
  console.log('1. Get the correct private key from SolPay support');
  console.log('2. Convert the key to proper PEM format');
  console.log('3. Use a different key format (PKCS#1 vs PKCS#8)');
  
  console.log('\n🔧 Quick Fix - Try these formats:');
  console.log(`
// Option 1: PKCS#8 PEM Format
const privateKey = \`-----BEGIN PRIVATE KEY-----
${currentPrivateKey}
-----END PRIVATE KEY-----\`;

// Option 2: RSA PEM Format  
const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
${currentPrivateKey}
-----END RSA PRIVATE KEY-----\`;

// Option 3: If it's base64 encoded, decode it first
const privateKey = Buffer.from('${currentPrivateKey}', 'base64').toString('utf8');
  `);
  
  console.log('\n📞 Next Steps:');
  console.log('1. Contact SolPay support for the correct private key format');
  console.log('2. Ask for a PEM-formatted private key');
  console.log('3. Verify the key works with their test environment');
  console.log('4. Update your .env file with the correct key');
}

async function main() {
  console.log('🔍 Node.js Version:', process.version);
  console.log('🔍 OpenSSL Version:', process.versions.openssl);
  
  testPrivateKeyFormats();
  testWithValidKey();
  provideSolutions();
}

main().catch(console.error); 