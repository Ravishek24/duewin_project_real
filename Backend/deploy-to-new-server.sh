#!/bin/bash

# 🚀 Deploy DueWin Backend to New Server
# This script helps deploy your backend to the new server

echo "🚀 Deploying DueWin Backend to New Server..."

# Configuration
NEW_SERVER_IP="YOUR_NEW_SERVER_IP"
NEW_SERVER_USER="root"
BACKEND_DIR="/var/www/duewin-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if server IP is configured
if [ "$NEW_SERVER_IP" = "YOUR_NEW_SERVER_IP" ]; then
    print_error "Please update NEW_SERVER_IP in this script first!"
    exit 1
fi

print_status "Starting deployment to $NEW_SERVER_IP..."

# Step 1: Create backup of current backend
print_status "Creating backup of current backend..."
BACKUP_FILE="duewin-backend-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" --exclude=node_modules --exclude=.git --exclude=logs .

# Step 2: Upload files to new server
print_status "Uploading files to new server..."
scp -r . "$NEW_SERVER_USER@$NEW_SERVER_IP:$BACKEND_DIR"

# Step 3: Upload setup scripts
print_status "Uploading setup scripts..."
scp setup-nginx-new-server.sh "$NEW_SERVER_USER@$NEW_SERVER_IP:/tmp/"
scp NEW_SERVER_SETUP_GUIDE.md "$NEW_SERVER_USER@$NEW_SERVER_IP:/tmp/"

# Step 4: Execute setup commands on new server
print_status "Setting up environment on new server..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    # Create backend directory if it doesn't exist
    mkdir -p /var/www/duewin-backend
    
    # Move uploaded files to correct location
    if [ -d "/tmp/Backend" ]; then
        cp -r /tmp/Backend/* /var/www/duewin-backend/
    fi
    
    # Set proper permissions
    chown -R www-data:www-data /var/www/duewin-backend
    chmod -R 755 /var/www/duewin-backend
    
    # Install Node.js if not already installed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    fi
    
    # Install PM2 if not already installed
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2..."
        npm install -g pm2
    fi
    
    # Navigate to backend directory
    cd /var/www/duewin-backend
    
    # Install dependencies
    echo "Installing dependencies..."
    npm install --production
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo "Creating .env file..."
        cp .env.example .env 2>/dev/null || echo "# DueWin Backend Environment Variables" > .env
        echo "Please edit .env file with your configuration"
    fi
    
    echo "Backend files uploaded successfully!"
EOF

# Step 5: Run Nginx setup
print_status "Setting up Nginx..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    # Make setup script executable
    chmod +x /tmp/setup-nginx-new-server.sh
    
    # Run Nginx setup
    /tmp/setup-nginx-new-server.sh
EOF

# Step 6: Setup SSL certificate
print_status "Setting up SSL certificate..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    # Install Certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        apt install -y certbot python3-certbot-nginx
    fi
    
    # Obtain SSL certificate
    echo "Obtaining SSL certificate..."
    certbot --nginx -d api.strikecolor1.com --non-interactive --agree-tos --email admin@strikecolor1.com
EOF

# Step 7: Start the application
print_status "Starting the application..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    cd /var/www/duewin-backend
    
    # Start with PM2
    pm2 start ecosystem.config.js || pm2 start index.js --name "duewin-backend"
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup
EOF

# Step 8: Test the deployment
print_status "Testing deployment..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    echo "Testing local health endpoint..."
    curl -I http://localhost:8000/health
    
    echo "Testing domain health endpoint..."
    curl -I https://api.strikecolor1.com/health
    
    echo "Checking PM2 status..."
    pm2 status
EOF

# Step 9: Cleanup
print_status "Cleaning up temporary files..."
ssh "$NEW_SERVER_USER@$NEW_SERVER_IP" << 'EOF'
    rm -f /tmp/setup-nginx-new-server.sh
    rm -f /tmp/NEW_SERVER_SETUP_GUIDE.md
EOF

# Remove local backup
rm -f "$BACKUP_FILE"

print_status "Deployment completed!"
echo ""
echo "🎉 Your DueWin backend has been deployed to the new server!"
echo ""
echo "📋 Next steps:"
echo "1. SSH to your new server: ssh $NEW_SERVER_USER@$NEW_SERVER_IP"
echo "2. Edit environment variables: nano /var/www/duewin-backend/.env"
echo "3. Run database migrations: cd /var/www/duewin-backend && npm run migrate"
echo "4. Test your API: curl https://api.strikecolor1.com/health"
echo ""
echo "🔍 Useful commands:"
echo "- Check PM2 status: pm2 status"
echo "- View logs: pm2 logs"
echo "- Restart app: pm2 restart all"
echo "- Monitor system: /usr/local/bin/monitor-logs.sh"
echo ""
echo "⚠️  Don't forget to:"
echo "- Update your DNS records to point to the new server IP"
echo "- Configure your database connection in .env"
echo "- Test all API endpoints"
echo "- Setup monitoring and alerts" 