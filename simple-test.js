const axios = require('axios');

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';

const testUser = { userId: 28, email: "elif@example.com", username: "elif", id: 28 };
const TOKEN = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

async function testHealth() {
  try {
    console.log('🧪 Testing Media Health...');
    const response = await axios.get('http://localhost:3001/api/media/health', {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('✅ Success:', response.status, response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testHealth(); 