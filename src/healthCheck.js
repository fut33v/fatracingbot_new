// Health check script to verify all services are working
require('dotenv').config();
const db = require('./models/database');

async function healthCheck() {
  console.log('Running health check...');
  
  try {
    // Check database connection
    console.log('Checking database connection...');
    const dbResult = await db.query('SELECT NOW() as time');
    console.log('✅ Database connected successfully at:', dbResult.rows[0].time);
    
    // Check if tables exist
    console.log('Checking if required tables exist...');
    const tables = [
      'users', 'products', 'product_variants', 'orders', 
      'order_items', 'promo_codes', 'broadcasts', 
      'channel_membership', 'cart_items'
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table ${table} exists with ${result.rows[0].count} rows`);
      } catch (error) {
        console.log(`⚠️  Table ${table} might not exist or is inaccessible:`, error.message);
      }
    }
    
    console.log('Health check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();