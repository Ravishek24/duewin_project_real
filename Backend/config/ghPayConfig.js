// Load environment variables
require('dotenv').config();

const ghPayConfig = {
    mchId: process.env.GHPAY_MCH_ID || "<YOUR_MERCHANT_ID>", // Merchant ID for GH Pay
    key: process.env.GHPAY_KEY || "<YOUR_SECRET_KEY>",   // Secret key for GH Pay
    host: process.env.GHPAY_HOST || "https://api.ghpay.vip" // API base URL for GH Pay
};

module.exports = ghPayConfig; 