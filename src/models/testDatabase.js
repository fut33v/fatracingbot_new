// Simple test script to verify database connection and schema
require('dotenv').config();
const db = require('./database');

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await db.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Test creating a user
    console.log('Testing user creation...');
    const userResult = await db.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
      RETURNING *`,
      [123456789, 'testuser', 'Test', 'User']
    );
    console.log('✅ User creation successful:', userResult.rows[0]);
    
    // Test querying users
    const usersResult = await db.query('SELECT * FROM users WHERE telegram_id = $1', [123456789]);
    console.log('✅ User query successful:', usersResult.rows[0]);
    
    // Test creating a product
    console.log('Testing product creation...');
    const productResult = await db.query(`
      INSERT INTO products (name, description, price, currency, stock)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING *`,
      ['FATRACING T-Shirt', 'Official FATRACING cycling t-shirt', 1500.00, 'RUB', 10]
    );
    console.log('✅ Product creation successful:', productResult.rows[0] || 'Product already exists');
    
    // Test querying products
    const productsResult = await db.query('SELECT * FROM products');
    console.log('✅ Products query successful, found:', productsResult.rows.length, 'products');
    
    console.log('All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();