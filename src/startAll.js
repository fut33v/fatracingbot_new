// Script to start both the bot and admin panel
require('dotenv').config();
const { spawn } = require('child_process');

console.log('Starting FATRACING Bot and Admin Panel...');

// Start the bot
const bot = spawn('node', ['src/bot/index.js'], { stdio: 'inherit' });

bot.on('error', (error) => {
  console.error('Failed to start bot:', error);
});

bot.on('close', (code) => {
  console.log(`Bot process exited with code ${code}`);
});

// Start the admin panel
const admin = spawn('node', ['src/admin/server.js'], { stdio: 'inherit' });

admin.on('error', (error) => {
  console.error('Failed to start admin panel:', error);
});

admin.on('close', (code) => {
  console.log(`Admin panel process exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  bot.kill();
  admin.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  bot.kill();
  admin.kill();
  process.exit(0);
});