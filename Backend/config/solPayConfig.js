const solPayConfig = {
    merchantCode: process.env.SOLPAY_MERCHANT_CODE || "S820250509125213000",
    privateKey: process.env.SOLPAY_PRIVATE_KEY || "keghdfjsdgfjsdgdfjkaessfvsddkjhasdjghjksdgfkluidfhdjkghdksjgdjyvghjcbvbgyffsetqweiwptoerfgkmf",
    platformPublicKey: process.env.SOLPAY_PLATFORM_PUBLIC_KEY || "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCABwdjVHNcp+NWCOikKtBkgyubtyCloIEghVA8d5mdUCMnsfowgO5KwM3JH5NgZfzEGVNAmQAWHjtq7qrLqRHSc1aI2DF/hGZCn3clq0IQ+dJZtVkq1m58HiLb3QNRzs0elEDcBQdHJXqX1GmV3yH1v03j4UJUyGD3EdgxWHEXzwIDAQAB",
    host: process.env.SOLPAY_HOST || "https://openapi.solpay.link"
};
module.exports = solPayConfig; 