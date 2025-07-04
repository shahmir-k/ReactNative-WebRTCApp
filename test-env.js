const path = require('path');
const fs = require('fs');

console.log('Current directory:', __dirname);
console.log('.env file exists:', fs.existsSync(path.join(__dirname, '.env')));

// Test original .env file
console.log('\n=== Testing original .env file ===');
const result1 = require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log('Dotenv result:', result1);
console.log('SIGNALING_SERVER_URL:', process.env.SIGNALING_SERVER_URL);

// Clear process.env
delete process.env.SIGNALING_SERVER_URL;

// Test Unix line ending version
console.log('\n=== Testing .env.unix file ===');
const result2 = require('dotenv').config({ path: path.join(__dirname, '.env.unix') });
console.log('Dotenv result:', result2);
console.log('SIGNALING_SERVER_URL:', process.env.SIGNALING_SERVER_URL);

console.log('STUN_SERVER_URL:', process.env.STUN_SERVER_URL); 