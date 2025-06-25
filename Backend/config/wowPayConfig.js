const wowPayConfig = {
    mchId: process.env.WOWPAY_MCH_ID,
    key: process.env.WOWPAY_KEY,
    host: process.env.WOWPAY_HOST || "https://test.wowpay.biz",
    signType: process.env.WOWPAY_SIGN_TYPE || "MD5"
};
module.exports = wowPayConfig; 