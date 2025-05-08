// config/mxPayConfig.js
const dotenv = require('dotenv');

dotenv.config();

const mxPayConfig = {
  // API base URLs
  baseUrl: process.env.MXPAY_BASE_URL || 'https://admin.mx-pay.com',
  
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
  memberCode: process.env.MXPAY_MEMBER_CODE || '170522208687003',
  secretKey: process.env.MXPAY_SECRET_KEY || 'b17f24ff026d40949c85a24f4f375d42',
  
  // Default channels
  defaultCollectionChannel: process.env.MXPAY_DEFAULT_COLLECTION_CHANNEL || 'paystack001',
  defaultTransferChannel: process.env.MXPAY_DEFAULT_TRANSFER_CHANNEL || 'moonpay001',
  
  // Default bank code for transfers
  defaultBankCode: process.env.MXPAY_DEFAULT_BANK_CODE || 'IDPT0001',
  
  // Default currency
  currency: 'INR',
  
  // Webhook URLs (to be set in environment variables)
  notifyUrl: process.env.MXPAY_NOTIFY_URL || '',
  callbackUrl: process.env.MXPAY_CALLBACK_URL || ''
};

module.exports = mxPayConfig;