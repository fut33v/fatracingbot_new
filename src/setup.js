// Setup script to initialize database and seed with sample data
require('dotenv').config();
const { spawn } = require('child_process');

console.log('🚀 Starting FATRACING Bot setup...');

// Function to run a command and wait for it to complete
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, { 
      stdio: 'inherit',
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Main setup function
async function setup() {
  try {
    // Check environment variables
    console.log('🔍 Checking environment variables...');
    await runCommand('node', ['src/checkEnv.js']);
    
    // Initialize database
    console.log('🗄️  Initializing database...');
    await runCommand('node', ['src/models/initDb.js']);
    
    // Seed database with sample data
    console.log('🌱 Seeding database with sample data...');
    await runCommand('node', ['src/models/seed.js']);
    
    // Run health check
    console.log('✅ Running health check...');
    await runCommand('node', ['src/healthCheck.js']);
    
    console.log('🎉 Setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Make sure your bot token is correct in the .env file');
    console.log('   2. Run "npm start" to start the bot');
    console.log('   3. Run "npm run start:admin" to start the admin panel');
    console.log('   4. Or run "npm run start-all" to start both services');
    console.log('   5. Access the admin panel at http://localhost:3004');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();