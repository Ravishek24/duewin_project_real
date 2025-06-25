const dotenv = require('dotenv');
dotenv.config();

const usdtwgPayConfig = {
  baseUrl: process.env.USDTWG_PAY_BASE_URL || 'https://api.tkusdtapi.com',
  accessKey: process.env.USDTWG_PAY_ACCESS_KEY,
  accessSecret: process.env.USDTWG_PAY_ACCESS_SECRET,
  channelCode: process.env.USDTWG_PAY_CHANNEL_CODE,
  notifyUrl: process.env.USDTWG_PAY_NOTIFY_URL,
  payoutNotifyUrl: process.env.USDTWG_PAY_PAYOUT_NOTIFY_URL,
};

module.exports = usdtwgPayConfig; 