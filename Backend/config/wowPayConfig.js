// Load environment variables
require('dotenv').config();

const wowPayConfig = {
    mchId: process.env.WOWPAY_MCH_ID || "<YOUR_MERCHANT_ID>",
    key: process.env.WOWPAY_KEY || "<YOUR_SECRET_KEY>",
    host: process.env.WOWPAY_HOST || "https://test.wowpay.biz", // Test environment
    // For production: https://api.wowpay.biz
    signType: process.env.WOWPAY_SIGN_TYPE || "MD5"
};

module.exports = wowPayConfig; 