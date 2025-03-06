import axios from 'axios';
import { paymentConfig } from '../config/paymentConfig.js';
import { generateSignature } from '../utils/generateSignature.js';

/**
 * Creates a PayIn order (deposit)
 * @param {string} orderId - Unique order number
 * @param {string} payType - Payment method (JAZZCASH or EASYPAISA)
 * @param {number} amount - Amount in PKR (Integer)
 * @param {string} notifyUrl - Callback URL for notifications
 * @returns {Object} - API response
 */
export const createPayInOrder = async (orderId, payType, amount, notifyUrl) => {
  const requestData = {
    mchId: paymentConfig.mchId,
    currency: "INR",
    out_trade_no: orderId,
    pay_type: payType,
    money: amount,
    attach: "additional_data",
    notify_url: notifyUrl,
    returnUrl: "https://www.google.com",
  };

  // Generate the signature
  requestData.sign = generateSignature(requestData);

  try {
    const response = await axios.post(`${paymentConfig.host}/v1/Collect`, requestData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating PayIn order:", error.message);
    throw new Error("Failed to create PayIn order");
  }
};
