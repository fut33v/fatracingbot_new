// Script to check if all required environment variables are set
require('dotenv').config();

const requiredEnvVars = [
  'BOT_TOKEN',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

console.log('Checking environment variables...');

let allSet = true;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    allSet = false;
  } else {
    console.log(`✅ ${envVar} is set`);
  }
}

if (process.env.ADMIN_USER_IDS) {
  console.log(`✅ ADMIN_USER_IDS is set: ${process.env.ADMIN_USER_IDS}`);
} else {
  console.log(`⚠️  ADMIN_USER_IDS is not set (optional)`);
}

if (process.env.FATRACING_CHANNEL_ID) {
  console.log(`✅ FATRACING_CHANNEL_ID is set: ${process.env.FATRACING_CHANNEL_ID}`);
} else {
  console.log(`⚠️  FATRACING_CHANNEL_ID is not set (optional)`);
}

if (allSet) {
  console.log('✅ All required environment variables are set!');
  process.exit(0);
} else {
  console.error('❌ Some required environment variables are missing!');
  process.exit(1);
}