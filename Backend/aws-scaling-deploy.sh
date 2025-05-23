#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting AWS horizontal scaling deployment process..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js and npm if not installed
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js and npm..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    sudo npm install -g pm2
fi

# Ensure application directory exists
mkdir -p /home/ubuntu/apps/duewin-project
cd /home/ubuntu/apps/duewin-project

# Pull latest code or clone if not exists
if [ -d "Backend" ]; then
    cd Backend
    echo "📥 Pulling latest code..."
    git pull
else
    echo "📥 Cloning repository..."
    git clone https://github.com/your-username/duewin-project.git .
    cd Backend
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Database Configuration - Use RDS endpoint for horizontal scaling
DB_USER=${DB_USER:-duewin_user}
DB_PASS=${DB_PASS:-your_secure_password}
DB_NAME=${DB_NAME:-duewin}
DB_HOST=${DB_HOST:-your-rds-endpoint.region.rds.amazonaws.com}
DB_PORT=${DB_PORT:-3306}

# Node Environment
NODE_ENV=production

# JWT Secret
JWT_SECRET=${JWT_SECRET:-your_jwt_secret_key}

# Server Configuration
SERVER_PORT=${SERVER_PORT:-3000}

# Redis Configuration (for session and WebSocket scaling)
REDIS_URL=${REDIS_URL:-your-elasticache-endpoint:6379}

# Other settings
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://your-domain.com,https://www.your-domain.com}
EOL
    echo "⚠️ Please update the .env file with your actual credentials!"
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Wait for DB to be available (important for RDS)
echo "🔄 Waiting for database to be available..."
max_attempts=30
attempt=0
while ! mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --silent &>/dev/null; do
    attempt=$((attempt+1))
    if [ "$attempt" -ge "$max_attempts" ]; then
        echo "❌ Failed to connect to database after $max_attempts attempts"
        exit 1
    fi
    echo "🔄 Waiting for database connection... (Attempt $attempt/$max_attempts)"
    sleep 5
done

# Run database migrations if this is the primary instance
# We use an environment variable to control this to avoid multiple instances running migrations
if [ "${PRIMARY_INSTANCE:-false}" = "true" ]; then
    echo "🔄 Running database migrations..."
    npx sequelize-cli db:migrate
fi

# Generate instance ID for unique identification
INSTANCE_ID=$(hostname)
echo "📝 Instance ID: $INSTANCE_ID"

# Start the application with PM2
echo "🚀 Starting the application..."
pm2 start index.js --name "duewin-backend-$INSTANCE_ID" -- --instance-id="$INSTANCE_ID"

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

echo "✅ Deployment completed successfully!"
echo "📝 Instance health check: curl http://localhost:${SERVER_PORT:-3000}/health" 