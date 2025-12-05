const { Pool } = require('pg');
require('dotenv').config();

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fatracing_bot',
  user: process.env.DB_USER || 'fatracingbot',
  password: process.env.DB_PASSWORD || 'fatracingbot228',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully');
  }
});

// Add event listeners for pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => {
    console.log('Executing query:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    return pool.query(text, params);
  },
  getClient: async () => pool.connect(),
  pool
};
