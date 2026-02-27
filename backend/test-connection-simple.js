require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  console.log('Configuration:');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Port: ${process.env.DB_PORT}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : 'NOT SET'}`);
  console.log('');

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('Running test query...');
    const result = await client.query('SELECT NOW(), version()');
    console.log('✅ Query executed successfully!');
    console.log(`   Timestamp: ${result.rows[0].now}`);
    console.log(`   PostgreSQL: ${result.rows[0].version.split(',')[0]}`);

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check if the hostname is correct');
      console.error('   - Verify the RDS instance is running');
      console.error('   - Check if you need VPN/network access');
      console.error('   - Verify security group allows your IP');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check security group inbound rules');
      console.error('   - Verify RDS is publicly accessible (if needed)');
      console.error('   - Check if firewall is blocking port 5432');
    } else if (error.message.includes('authentication')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Verify username and password');
      console.error('   - Check database name is correct');
    }
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed');
  }
}

testConnection();
