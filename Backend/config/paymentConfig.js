const paymentConfig = {
    mchId: "1000",  // Merchant ID
    key: "eb6080dbc8dc429ab86a1cd1c337975d",  // Secret key
    host: "https://sandbox.wpay.one",  // API base URL for sandbox
};

// 101pay Gateway Configuration Template
const pay101Config = {
    accessKey: process.env.PAY101_ACCESS_KEY || '',
    accessSecret: process.env.PAY101_ACCESS_SECRET || '',
    apiBaseUrl: process.env.PAY101_API_BASE_URL || 'https://api.101pay.com',
    notifyUrl: process.env.PAY101_NOTIFY_URL || '',
    jumpUrl: process.env.PAY101_JUMP_URL || '',
};

module.exports = {
    ...paymentConfig,
    pay101Config: pay101Config,
};
  