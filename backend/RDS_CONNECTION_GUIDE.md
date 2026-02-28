# RDS Connection Troubleshooting Guide

## Current Issue
```
Error: getaddrinfo ENOTFOUND ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com
```

This means the hostname cannot be resolved. The RDS instance is not reachable from your current network.

## Possible Causes & Solutions

### 1. RDS is Not Publicly Accessible ⚠️ MOST COMMON

**Check:**
```bash
# In AWS Console:
RDS → Databases → ywhatsupdoc-db → Connectivity & security
Look for: "Publicly accessible: No"
```

**Solution A: Make RDS Publicly Accessible (NOT RECOMMENDED for production)**
1. Go to RDS Console
2. Select your database instance
3. Click "Modify"
4. Under "Connectivity", set "Public access" to "Yes"
5. Click "Continue" → "Apply immediately"
6. Wait 5-10 minutes for changes to apply

**Solution B: Use Bastion Host / Jump Server (RECOMMENDED)**
```bash
# SSH tunnel through bastion
ssh -i your-key.pem -L 5432:ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com:5432 ec2-user@your-bastion-ip

# Then connect to localhost:5432
# Update .env:
DB_HOST=localhost
```

**Solution C: Use AWS VPN**
- Connect to your AWS VPN
- Then run the application

### 2. Security Group Not Allowing Your IP

**Check:**
```bash
# In AWS Console:
RDS → Databases → ywhatsupdoc-db → Connectivity & security → VPC security groups
Click on the security group → Inbound rules
```

**Solution:**
1. Add inbound rule:
   - Type: PostgreSQL
   - Protocol: TCP
   - Port: 5432
   - Source: Your IP address (get from https://whatismyip.com)
   - Description: "My development machine"

### 3. RDS Instance is Stopped

**Check:**
```bash
# In AWS Console:
RDS → Databases → Look for status
Status should be: "Available" (green)
```

**Solution:**
1. If status is "Stopped", click "Actions" → "Start"
2. Wait 5-10 minutes for instance to start

### 4. Wrong Hostname

**Verify the correct endpoint:**
```bash
# In AWS Console:
RDS → Databases → ywhatsupdoc-db → Connectivity & security
Copy the "Endpoint" value exactly
```

Current hostname in .env:
```
ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com
```

### 5. Network/Firewall Issues

**Test DNS resolution:**
```bash
# Check if hostname resolves
nslookup ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com

# Check if port is reachable
nc -zv ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com 5432

# Or use telnet
telnet ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com 5432
```

## Quick Test Commands

### Test 1: DNS Resolution
```bash
nslookup ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com
```
Expected: Should return an IP address

### Test 2: Port Connectivity
```bash
nc -zv ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com 5432
```
Expected: "Connection succeeded"

### Test 3: PostgreSQL Connection
```bash
psql -h ywhatsupdoc-db.c32g6ggkm4n9.ap-south-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d whatsupdoc-db
```
Expected: PostgreSQL prompt

## Recommended Architecture for Development

### Option 1: SSH Tunnel (Most Secure)
```bash
# Terminal 1: Create tunnel
ssh -i key.pem -L 5432:rds-endpoint:5432 ec2-user@bastion-ip

# Terminal 2: Update .env
DB_HOST=localhost
DB_PORT=5432

# Terminal 3: Run application
npm start
```

### Option 2: VPN Connection
1. Connect to AWS VPN
2. Use private RDS endpoint
3. Run application normally

### Option 3: Public Access (Development Only)
1. Make RDS publicly accessible
2. Whitelist your IP in security group
3. Use public endpoint

## Alternative: Local PostgreSQL for Testing

If you can't access RDS right now, set up local PostgreSQL:

```bash
# Install PostgreSQL with PostGIS
brew install postgresql postgis  # macOS
# or
sudo apt-get install postgresql postgis  # Linux

# Start PostgreSQL
brew services start postgresql  # macOS
# or
sudo service postgresql start  # Linux

# Create database
createdb whatsupdoc-local

# Enable PostGIS
psql whatsupdoc-local -c "CREATE EXTENSION postgis;"

# Update .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsupdoc-local
DB_USER=your_username
DB_PASSWORD=your_password
```

Then import a sample of the hospital data for testing.

## Next Steps

1. **Identify the issue** using the checks above
2. **Apply the appropriate solution**
3. **Test connection** using `node test-connection-simple.js`
4. **Run full test** using `node test-db.js`
5. **Start the server** using `npm start`

## Contact Your DevOps/AWS Admin

If you don't have access to AWS Console, contact your admin and ask:
1. "Is the RDS instance publicly accessible?"
2. "What's my IP address that needs to be whitelisted?"
3. "Do I need VPN access to reach the database?"
4. "Can you provide bastion host details for SSH tunnel?"

## Current Status

❌ Cannot connect to RDS from your machine
✅ Backend code is ready
✅ Frontend code is ready
⏳ Waiting for network/access configuration
