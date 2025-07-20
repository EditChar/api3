const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate a test token
const ACCESS_TOKEN_SECRET = 'your_current_jwt_secret_or_a_new_strong_one';

const testUser = {
  userId: 28,
  email: "elif@example.com",
  username: "elif",
  id: 28
};

const token = jwt.sign(testUser, ACCESS_TOKEN_SECRET, { expiresIn: '24h' });

console.log('🔑 Test JWT Token:');
console.log(token);
console.log('\n📋 Token Details:');
console.log('User ID:', testUser.userId);
console.log('Email:', testUser.email);
console.log('Username:', testUser.username);
console.log('\n🚀 Usage:');
console.log('Authorization: Bearer ' + token);

// Also decode to verify
try {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
  console.log('\n✅ Token verified successfully');
  console.log('Decoded:', decoded);
} catch (error) {
  console.log('\n❌ Token verification failed:', error.message);
} 