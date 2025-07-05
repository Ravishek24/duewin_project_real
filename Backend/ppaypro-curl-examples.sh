#!/bin/bash

# PPayPro Callback Test Examples using cURL
# Make sure to replace the signature with a properly generated one

echo "🚀 PPayPro Callback Test Examples"
echo "=================================="

# Example 1: Successful Deposit Callback
echo -e "\n1️⃣ Successful Deposit Callback:"
curl -X POST "https://api.strikecolor1.com/api/payments/ppaypro/payin-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payOrderId=PPAY123456789&mchOrderNo=ORDER123456&amount=10000&state=2&currency=INR&createdAt=$(date +%s)000&successTime=$(date +%s)000&sign=YOUR_GENERATED_SIGNATURE"

echo -e "\n\n2️⃣ Failed Deposit Callback:"
curl -X POST "https://api.strikecolor1.com/api/payments/ppaypro/payin-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payOrderId=PPAY123456790&mchOrderNo=ORDER123457&amount=5000&state=3&currency=INR&createdAt=$(date +%s)000&sign=YOUR_GENERATED_SIGNATURE"

echo -e "\n\n3️⃣ Successful Withdrawal Callback:"
curl -X POST "https://api.strikecolor1.com/api/payments/ppaypro/payout-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "transferId=TRANS123456789&mchOrderNo=WITHDRAW123456&amount=20000&state=2&voucher=UTR123456789&createdAt=$(date +%s)000&successTime=$(date +%s)000&sign=YOUR_GENERATED_SIGNATURE"

echo -e "\n\n✅ All examples sent!"
echo "Note: Replace 'YOUR_GENERATED_SIGNATURE' with actual MD5 signature" 