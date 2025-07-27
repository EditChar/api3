const axios = require('axios');
const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';
const testUser = { userId: 54, email: "test@example.com", username: "testuser", id: 54 };
const TOKEN = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

// MediaId from logs
const MEDIA_ID = 'dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba';

async function testMediaDelete() {
  console.log('🧪 Testing Media Delete...');
  console.log('   MediaId:', MEDIA_ID);
  console.log('   UserId:', testUser.userId);
  
  try {
    const response = await axios.delete(`${BASE_URL}/api/media/${MEDIA_ID}`, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Media delete successful:', response.status, response.data);
    
  } catch (error) {
    console.error('❌ Media delete failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    console.error('   Headers:', error.response?.headers);
    
    if (error.response?.data?.details) {
      console.error('   Validation errors:');
      error.response.data.details.forEach(err => {
        console.error(`     - ${err.param}: ${err.msg} (value: ${err.value})`);
      });
    }
  }
}

// Also test UUID validation
function testUUID() {
  console.log('\n🔍 UUID Validation Test:');
  console.log('   MediaId:', MEDIA_ID);
  console.log('   Is valid UUID format?', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(MEDIA_ID));
  console.log('   Length:', MEDIA_ID.length);
  console.log('   Contains dashes at positions:', MEDIA_ID.split('').map((char, i) => char === '-' ? i : null).filter(x => x !== null));
}

testUUID();
testMediaDelete(); 