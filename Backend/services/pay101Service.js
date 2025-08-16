// Service for 101pay gateway integration
const axios = require('axios');
const crypto = require('crypto');
const { pay101Config } = require('../config/paymentConfig');
const Transaction = require('../models/Transaction');

function generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret }) {
    const baseString = `${method}&${url}&${accessKey}&${timestamp}&${nonce}`;
    const hmac = crypto.createHmac('sha256', accessSecret);
    hmac.update(baseString);
    return hmac.digest('base64');
}

async function createDepositOrder({ merchantOrderNo, channelCode, amount, currency, notifyUrl, jumpUrl }) {
    try {
        const method = 'POST';
        const url = '/mcapi/receive/create';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });

        const headers = {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const body = {
            merchantOrderNo,
            channelCode,
            amount: amount.toString(),
            currency,
            notifyUrl,
            jumpUrl
        };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.post(apiUrl, body, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

async function queryDepositOrder({ orderNo, merchantOrderNo }) {
    try {
        const method = 'POST';
        const url = '/mcapi/receive/query';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });
        const headers = {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const body = { orderNo, merchantOrderNo };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.post(apiUrl, body, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

async function queryDepositByUTR({ utr }) {
    try {
        const method = 'POST';
        const url = '/mcapi/receive/utr-query';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });
        const headers = {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const body = { utr };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.post(apiUrl, body, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

async function createWithdrawalOrder({ merchantOrderNo, beneficiary, bankName, bankAccount, ifsc, currency, channelCode, amount, address, notifyUrl }) {
    try {
        const method = 'POST';
        const url = '/mcapi/send/create';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });
        const headers = {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const body = {
            merchantOrderNo,
            beneficiary,
            bankName,
            bankAccount,
            ifsc,
            currency,
            channelCode,
            amount,
            address,
            notifyUrl
        };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.post(apiUrl, body, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

async function queryWithdrawalOrder({ orderNo, merchantOrderNo }) {
    try {
        const method = 'POST';
        const url = '/mcapi/send/query';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });
        const headers = {
            'Accept-Language': 'en',
            'Content-Type': 'application/json',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const body = { orderNo, merchantOrderNo };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.post(apiUrl, body, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

async function queryBalance() {
    try {
        const method = 'GET';
        const url = '/mcapi/quota';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(100000 + Math.random() * 900000).toString();
        const accessKey = pay101Config.accessKey;
        const accessSecret = pay101Config.accessSecret;
        const sign = generateSignature({ method, url, accessKey, timestamp, nonce, accessSecret });
        const headers = {
            'Accept-Language': 'en',
            accessKey,
            timestamp,
            nonce,
            sign
        };
        const apiUrl = pay101Config.apiBaseUrl + url;
        const response = await axios.get(apiUrl, { headers });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

module.exports = {
    createDepositOrder,
    queryDepositOrder,
    queryDepositByUTR,
    createWithdrawalOrder,
    queryWithdrawalOrder,
    queryBalance
}; 
