const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { processPpayProDepositCallback, processPpayProWithdrawalCallback } = require('../services/ppayProService');
const rateLimiters = require('../middleware/rateLimiter');

// Utility: Write callback logs to a file
function logPpayProCallback(data) {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const logFile = path.join(logDir, 'ppaypro-callbacks.log');
  const logEntry = `\n[${new Date().toISOString()}] PPayPro Callback Received\nHeaders: ${JSON.stringify(data.headers)}\nBody: ${JSON.stringify(data.body)}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.log(logEntry); // Also log to console
}

// PPayPro deposit callback route - Rate limited
router.post('/payin-callback', rateLimiters.ppaypro, (req, res, next) => {
  // Log the callback
  logPpayProCallback({ headers: req.headers, body: req.body });
  next();
}, async (req, res) => {
  const callbackData = req.body;
  const result = await processPpayProDepositCallback(callbackData);
  if (result.success) {
    return res.send('success');
  } else {
    return res.status(400).send('fail');
  }
});

// PPayPro withdrawal callback route - Rate limited
router.post('/payout-callback', rateLimiters.ppaypro, (req, res, next) => {
  // Log the callback
  logPpayProCallback({ headers: req.headers, body: req.body });
  next();
}, async (req, res) => {
  const callbackData = req.body;
  const result = await processPpayProWithdrawalCallback(callbackData);
  if (result.success) {
    return res.send('success');
  } else {
    return res.status(400).send('fail');
  }
});

module.exports = router; 