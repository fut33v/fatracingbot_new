// Script to initialize the database with the schema
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./database');

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`Found ${statements.length} statements to execute`);
    
    // Log first few statements for debugging
    console.log('First 3 statements:');
    for (let i = 0; i < Math.min(3, statements.length); i++) {
      console.log(`  ${i + 1}: ${statements[i].substring(0, 50)}...`);
    }
    
    // Separate CREATE TABLE statements from CREATE INDEX statements
    const tableStatements = [];
    const indexStatements = [];
    const otherStatements = [];
    
    for (const stmt of statements) {
      const upperStmt = stmt.toUpperCase();
      if (upperStmt.startsWith('CREATE TABLE')) {
        tableStatements.push(stmt);
      } else if (upperStmt.startsWith('CREATE INDEX')) {
        indexStatements.push(stmt);
      } else {
        otherStatements.push(stmt);
      }
    }
    
    console.log(`Found ${tableStatements.length} table statements`);
    console.log(`Found ${indexStatements.length} index statements`);
    console.log(`Found ${otherStatements.length} other statements`);
    
    // Execute table statements first
    console.log('Executing table creation statements...');
    for (let i = 0; i < tableStatements.length; i++) {
      const statement = tableStatements[i];
      if (statement.length === 0) continue;
      
      try {
        await db.query(statement);
        console.log(`✅ Executed table statement ${i + 1}/${tableStatements.length}:`, statement.substring(0, 50) + '...');
      } catch (error) {
        console.error(`❌ Error executing table statement ${i + 1}/${tableStatements.length}:`, statement.substring(0, 50) + '...', error.message);
        // Continue with other statements
      }
    }
    
    // Execute other statements (constraints, etc.)
    console.log('Executing other statements...');
    for (let i = 0; i < otherStatements.length; i++) {
      const statement = otherStatements[i];
      if (statement.length === 0) continue;
      
      try {
        await db.query(statement);
        console.log(`✅ Executed other statement ${i + 1}/${otherStatements.length}:`, statement.substring(0, 50) + '...');
      } catch (error) {
        console.error(`❌ Error executing other statement ${i + 1}/${otherStatements.length}:`, statement.substring(0, 50) + '...', error.message);
        // Continue with other statements
      }
    }
    
    // Execute index statements last
    console.log('Executing index creation statements...');
    for (let i = 0; i < indexStatements.length; i++) {
      const statement = indexStatements[i];
      if (statement.length === 0) continue;
      
      try {
        await db.query(statement);
        console.log(`✅ Executed index statement ${i + 1}/${indexStatements.length}:`, statement.substring(0, 50) + '...');
      } catch (error) {
        console.error(`❌ Error executing index statement ${i + 1}/${indexStatements.length}:`, statement.substring(0, 50) + '...', error.message);
        // Continue with other statements
      }
    }
    
    console.log('Database initialization completed!');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// Export the function for use as a module
module.exports = initDatabase;

// Keep the standalone execution for backward compatibility
if (require.main === module) {
  // Add a small delay to ensure database is ready
  setTimeout(() => {
    initDatabase();
  }, 5000);
}