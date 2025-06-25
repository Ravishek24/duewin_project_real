const ppayProConfig = {
    mchNo: process.env.PPAYPRO_MCH_NO,
    appId: process.env.PPAYPRO_APP_ID,
    key: process.env.PPAYPRO_KEY,
    host: process.env.PPAYPRO_HOST || "https://pay.ppaypros.com"
};
module.exports = ppayProConfig; 