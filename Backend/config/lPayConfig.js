const dotenv = require('dotenv');

dotenv.config();

const lPayConfig = {
  baseUrl: process.env.LPAY_BASE_URL || 'https://admin.tpaycloud.com',
  // Collection (deposit) endpoints
  collectionEndpoint: '/v1/inorder/addInOrder',
  collectionStatusEndpoint: '/v1/inorder/status',
  collectionMemberStatusEndpoint: '/v1/inorder/memberStatus',
  // Transfer (withdrawal) endpoints
  transferEndpoint: '/v1/outorder/addOutOrder',
  // Other endpoints
  bankListEndpoint: '/v1/outorder/bankList',
  memberBalanceEndpoint: '/v1/member/amount',
  // Merchant credentials
  memberCode: process.env.LPAY_MEMBER_CODE,
  secretKey: process.env.LPAY_SECRET_KEY,
  // Default channels
  defaultCollectionChannel: process.env.LPAY_DEFAULT_COLLECTION_CHANNEL || 'paystack001',
  defaultTransferChannel: process.env.LPAY_DEFAULT_TRANSFER_CHANNEL || 'moonpay001',
  // Default bank code for transfers
  defaultBankCode: process.env.LPAY_DEFAULT_BANK_CODE || 'IDPT0001',
  // Default currency
  currency: 'INR',
  // Webhook URLs
  notifyUrl: process.env.LPAY_NOTIFY_URL || '',
  callbackUrl: process.env.LPAY_CALLBACK_URL || ''
};

module.exports = lPayConfig; 