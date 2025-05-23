# Horizontal Scaling Guide for Duewin Backend on AWS

This guide provides detailed steps to implement horizontal scaling for your Duewin backend application on AWS. Following these steps will create a robust, scalable infrastructure that can automatically adjust to varying loads.

## Prerequisites

- AWS account with sufficient permissions
- AWS CLI installed and configured
- Basic knowledge of AWS services: EC2, RDS, ElastiCache, ELB
- Your Duewin project code in a Git repository

## Option 1: Manual Setup

### Step 1: Set Up Amazon RDS for MySQL

1. **Create a MySQL RDS instance**:
   - Go to the AWS Management Console → RDS
   - Click "Create database"
   - Choose MySQL
   - Select DB instance size (start with db.t3.micro for development)
   - Set master username and password
   - Configure advanced settings (VPC, security groups, etc.)
   - Create database

2. **Configure Security Group for RDS**:
   - Allow inbound MySQL traffic (port 3306) only from your application security group

### Step 2: Set Up ElastiCache Redis

1. **Create a Redis cluster**:
   - Go to ElastiCache in AWS Console
   - Click "Create"
   - Select Redis
   - Configure cluster settings (cache.t3.micro recommended for starting)
   - Configure security groups to allow access from your application

### Step 3: Create a Launch Template for EC2 Instances

1. **Create a Launch Template**:
   - Go to EC2 → Launch Templates → Create launch template
   - Select Ubuntu AMI
   - Choose instance type (t2.micro or larger)
   - Add user data script that installs dependencies and sets up the application
   - Configure security group to allow inbound HTTP, HTTPS, and SSH traffic

2. **User Data Script Example**:
```bash
#!/bin/bash
# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y git

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Clone repository
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps
git clone https://github.com/your-username/duewin-project.git
cd duewin-project/Backend

# Create .env file with RDS and Redis endpoints
cat > .env << EOL
# Database Configuration
DB_USER=duewin_user
DB_PASS=your-secure-password
DB_NAME=duewin
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=3306

# Node Environment
NODE_ENV=production

# JWT Secret
JWT_SECRET=your-secure-jwt-secret

# Server Configuration
SERVER_PORT=3000

# Redis Configuration
REDIS_URL=your-redis-endpoint:6379
EOL

# Install dependencies
npm install

# Start the application with PM2
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
pm2 start index.js --name "duewin-backend-$INSTANCE_ID" -- --instance-id="$INSTANCE_ID"
pm2 startup
pm2 save
```

### Step 4: Create Target Group and Application Load Balancer

1. **Create a Target Group**:
   - Go to EC2 → Target Groups → Create target group
   - Select "Instances" as target type
   - Specify name, protocol (HTTP), port (3000)
   - Configure health checks (path: /health)
   - Create target group

2. **Create Application Load Balancer**:
   - Go to EC2 → Load Balancers → Create Load Balancer
   - Choose Application Load Balancer
   - Configure listeners (HTTP on port 80, optionally HTTPS on 443)
   - Configure security settings
   - Configure security groups
   - Select subnets (at least two for high availability)
   - Configure routing to the target group created earlier
   - Create load balancer

### Step 5: Create Auto Scaling Group

1. **Create Auto Scaling Group**:
   - Go to EC2 → Auto Scaling Groups → Create Auto Scaling Group
   - Select the Launch Template created earlier
   - Configure group size and scaling policies:
     - Minimum: 2 (for high availability)
     - Maximum: 10 (or appropriate for your workload)
     - Desired: 2 (starting capacity)
   - Configure scaling policies:
     - Target tracking policy: CPU utilization at 70%
   - Review and create

### Step 6: Update Application Code for Scaling

1. **Ensure WebSockets Use Redis Adapter**:
   - Install Redis adapter for socket.io: `npm install @socket.io/redis-adapter`
   - Update code to use Redis adapter as shown in our modified index.js

2. **Ensure Session Persistence**:
   - Move any session-related data to Redis
   - Ensure no server-local state that would be lost during scaling

## Option 2: Use CloudFormation Template

We've provided a CloudFormation template (`aws-scaling-infrastructure.yaml`) that automates the entire setup.

1. **Deploy the CloudFormation Stack**:
```bash
aws cloudformation create-stack \
  --stack-name duewin-scaling \
  --template-body file://aws-scaling-infrastructure.yaml \
  --parameters \
      ParameterKey=EnvironmentName,ParameterValue=prod \
      ParameterKey=InstanceType,ParameterValue=t2.small \
      ParameterKey=KeyName,ParameterValue=your-key-pair \
      ParameterKey=VpcId,ParameterValue=vpc-xxxxxxxx \
      ParameterKey=SubnetIds,ParameterValue=subnet-xxxxxxxx\\,subnet-yyyyyyyy \
      ParameterKey=DBName,ParameterValue=duewin \
      ParameterKey=DBUsername,ParameterValue=duewin_user \
      ParameterKey=DBPassword,ParameterValue=your-secure-password
```

2. **Monitor Stack Creation**:
   - Go to CloudFormation in AWS Console
   - Select your stack and monitor the "Events" tab
   - Wait for the stack status to change to "CREATE_COMPLETE"

3. **Get Stack Outputs**:
   - After successful creation, go to the "Outputs" tab
   - Note the LoadBalancerDNS, DatabaseEndpoint, and RedisEndpoint

## Important Considerations

### Database Migration

When switching from local MySQL to RDS:

1. **Export your local database**:
```bash
mysqldump -u root -p duewin > duewin_backup.sql
```

2. **Import to RDS**:
```bash
mysql -h your-rds-endpoint -u duewin_user -p duewin < duewin_backup.sql
```

### Handling WebSocket Connections

With multiple instances, ensure WebSocket connections work correctly:

1. Make sure Socket.IO uses the Redis adapter
2. Configure sticky sessions on the ALB if needed

### Cron Jobs

For scheduled tasks that should only run on one instance:

1. **Option 1**: Use a leader election mechanism with Redis
2. **Option 2**: Move scheduled tasks to AWS Lambda with EventBridge triggers

### Monitoring

Set up proper monitoring:

1. **CloudWatch Alarms**:
   - CPU utilization
   - Memory usage
   - Number of connections

2. **CloudWatch Dashboards**:
   - Create a dashboard for your application metrics
   - Monitor load balancer requests, target response times, etc.

## Testing Your Scaled Setup

1. **Verify Load Balancing**:
   - Make requests to the load balancer's DNS name
   - Confirm responses from different instances

2. **Test Auto Scaling**:
   - Generate load to trigger scale-out
   - Verify new instances are added automatically
   - Confirm traffic is distributed across all instances

3. **Test Failover**:
   - Terminate an instance to simulate failure
   - Verify the application continues working seamlessly

## Cost Optimization

1. **Use Reserved Instances** for baseline capacity
2. **Configure proper scaling thresholds** to avoid over-provisioning
3. **Select appropriate instance types** based on workload patterns
4. **Monitor and clean up** unused resources

## Security Best Practices

1. **Use Private Subnets** for database and Redis
2. **Implement least-privilege IAM roles**
3. **Enable VPC flow logs** for network monitoring
4. **Use security groups** with minimal required access
5. **Enable Enhanced Monitoring** for RDS instances

## Advanced Optimizations

1. **Content Delivery Network (CloudFront)**:
   - Set up CloudFront distribution for static assets
   - Configure proper cache policies

2. **Set up Route 53**:
   - Create DNS records pointing to your load balancer
   - Consider health checks and failover routing policies 