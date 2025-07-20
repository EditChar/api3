const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test kullanıcısı için token (gerçek sistemde auth'dan alınır)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTYzOTU4NDAwMCwiZXhwIjoxNjM5NjcwNDAwfQ.example';

async function testSendMessage() {
  try {
    console.log('🧪 Testing message sending system...\n');

    // Test room ID (gerçek sistemde var olan bir room kullanın)
    const roomId = 'test-room-123';
    const message = `Test message - ${new Date().toISOString()}`;

    console.log(`📤 Sending message to room ${roomId}: "${message}"`);

    const response = await axios.post(
      `${API_BASE}/chat/rooms/${roomId}/messages`,
      {
        message: message,
        message_type: 'text'
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message sent successfully!');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));

    // Wait a bit then check if message appears in Redis
    console.log('\n⏳ Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to get messages from the room
    try {
      const messagesResponse = await axios.get(
        `${API_BASE}/chat/rooms/${roomId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`
          }
        }
      );

      console.log('📨 Messages in room:');
      console.log(JSON.stringify(messagesResponse.data, null, 2));
    } catch (getError) {
      console.log('⚠️ Could not retrieve messages:', getError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run test
testSendMessage(); 