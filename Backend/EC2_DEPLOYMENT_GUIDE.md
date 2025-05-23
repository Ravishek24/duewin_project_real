# EC2 Deployment Guide

This guide will help you deploy the Duewin backend application to an EC2 instance.

## Prerequisites

1. An EC2 instance running Ubuntu (recommended: t2.micro or larger)
2. Security group configured with:
   - SSH (Port 22)
   - HTTP (Port 80)
   - HTTPS (Port 443)
   - Your application port (default: 3000)
3. SSH access to your EC2 instance

## Step 1: Connect to Your EC2 Instance

```bash
ssh -i /path/to/your-key.pem ubuntu@your-ec2-ip
```

## Step 2: Update System and Install Dependencies

```bash
# Update system packages
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt-get install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Install PM2 globally
sudo npm install -g pm2
```

## Step 3: Secure MySQL Installation

```bash
# Run MySQL secure installation
sudo mysql_secure_installation

# Create a new MySQL user and database
sudo mysql
```

In the MySQL prompt:
```sql
CREATE DATABASE duewin;
CREATE USER 'duewin_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON duewin.* TO 'duewin_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Step 4: Clone and Setup the Application

```bash
# Create application directory
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps

# Clone your repository (replace with your actual repository URL)
git clone https://github.com/your-username/duewin-project.git
cd duewin-project/Backend

# Create .env file
cat > .env << EOL
# Database Configuration
DB_USER=duewin_user
DB_PASS=your_secure_password
DB_NAME=duewin
DB_HOST=localhost
DB_PORT=3306

# Node Environment
NODE_ENV=production

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Server Configuration
PORT=3000
EOL

# Install dependencies
npm install
```

## Step 5: Run Database Migrations

```bash
# Run migrations
npx sequelize-cli db:migrate
```

## Step 6: Start the Application with PM2

```bash
# Start the application
pm2 start index.js --name "duewin-backend"

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## Step 7: Configure Nginx (Optional but Recommended)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/duewin
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/duewin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 8: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Monitoring and Maintenance

### View Application Logs
```bash
pm2 logs duewin-backend
```

### Monitor Application
```bash
pm2 monit
```

### Restart Application
```bash
pm2 restart duewin-backend
```

### Update Application
```bash
# Pull latest changes
git pull

# Install new dependencies
npm install

# Run migrations if needed
npx sequelize-cli db:migrate

# Restart the application
pm2 restart duewin-backend
```

## Troubleshooting

### Check Application Status
```bash
pm2 status
```

### Check Nginx Status
```bash
sudo systemctl status nginx
```

### Check MySQL Status
```bash
sudo systemctl status mysql
```

### View Nginx Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

## Security Considerations

1. Keep your system updated:
```bash
sudo apt-get update && sudo apt-get upgrade -y
```

2. Configure firewall (UFW):
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

3. Regularly backup your database:
```bash
mysqldump -u duewin_user -p duewin > backup.sql
```

4. Monitor system resources:
```bash
htop
```

## Backup and Restore

### Backup Database
```bash
mysqldump -u duewin_user -p duewin > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
mysql -u duewin_user -p duewin < backup.sql
```

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Node.js Documentation](https://nodejs.org/en/docs/) 