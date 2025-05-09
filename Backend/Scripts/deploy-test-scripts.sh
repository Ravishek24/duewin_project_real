#!/bin/bash

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="strike.atsproduct.in"
SERVER_DIR="~/duewin_project_real-main/backend/scripts"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A"

# Script files to deploy
SCRIPTS=(
  "testWalletBalance.js"
  "testPaymentGateway.js"
)

# Display info
echo "=== Deploying test scripts to $SERVER_HOST ==="

# Copy files to server
for script in "${SCRIPTS[@]}"; do
  echo "Copying $script to server..."
  scp "$script" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"
done

echo "=== Files deployed successfully ==="

# Ask which test to run
echo ""
echo "Which test would you like to run on the server?"
echo "1) Wallet Balance Test"
echo "2) Payment Gateway Test"
echo "3) Both Tests"
echo "4) None (just deploy files)"
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    echo "=== Running Wallet Balance Test ==="
    ssh "$SERVER_USER@$SERVER_HOST" "cd $(dirname $SERVER_DIR) && node scripts/testWalletBalance.js '$AUTH_TOKEN'"
    ;;
  2)
    echo "=== Running Payment Gateway Test ==="
    ssh "$SERVER_USER@$SERVER_HOST" "cd $(dirname $SERVER_DIR) && node scripts/testPaymentGateway.js '$AUTH_TOKEN'"
    ;;
  3)
    echo "=== Running All Tests ==="
    echo "=== Wallet Balance Test ==="
    ssh "$SERVER_USER@$SERVER_HOST" "cd $(dirname $SERVER_DIR) && node scripts/testWalletBalance.js '$AUTH_TOKEN'"
    echo "=== Payment Gateway Test ==="
    ssh "$SERVER_USER@$SERVER_HOST" "cd $(dirname $SERVER_DIR) && node scripts/testPaymentGateway.js '$AUTH_TOKEN'"
    ;;
  4)
    echo "Files deployed but no tests run."
    ;;
  *)
    echo "Invalid option selected."
    ;;
esac

echo "=== Deployment and testing completed ===" 