const solPayConfig = {
    merchantCode: process.env.SOLPAY_MERCHANT_CODE,
    privateKey: process.env.SOLPAY_PRIVATE_KEY,
    platformPublicKey: process.env.SOLPAY_PLATFORM_PUBLIC_KEY,
    host: process.env.SOLPAY_HOST || "https://openapi.solpay.link"
};
module.exports = solPayConfig; 