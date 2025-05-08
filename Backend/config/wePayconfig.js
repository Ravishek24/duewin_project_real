// config/wePayConfig.js
const dotenv = require('dotenv');

dotenv.config();

const wePayConfig = {
  // API Base URLs
  collectUrl: 'https://api.wepayglobal.com/pay/web',
  transferUrl: 'https://api.wepayglobal.com/pay/transfer',
  
  // Merchant Details
  mchId: process.env.WEPAY_MCH_ID || "999100111", // Test merchant ID, replace with env var
  
  // Keys
  collectKey: process.env.WEPAY_COLLECT_KEY || "04e1266332d24d428e9ee6400d6da643", // Test collect key
  transferKey: process.env.WEPAY_TRANSFER_KEY || "ABCDEFGHIJKLMNOPQRSTUVWXYZ", // Test transfer key
  
  // Default payment channel code for India
  payType: process.env.WEPAY_PAY_TYPE || "151", // Category II A
  
  // Bank code for transfers (fixed for Indian banks)
  bankCode: "IDPT0001",
  
  // Default version
  version: "1.0",
  
  // Signature type
  signType: "MD5"
};

module.exports = wePayConfig;