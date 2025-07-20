async function testMessagesAPI() {
  try {
    console.log('🚀 Testing messages API...');
    
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI4LCJlbWFpbCI6ImVsaWZAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImVsaWYiLCJpZCI6MjgsImlhdCI6MTc1MDcxNjUwNywiZXhwIjoxNzUwODAyOTA3fQ.tKSAcNn94zoSn8b3fXQq6ckkGZ3xkTVSwL10byf8NF4";
    
    const timestamp = Date.now();
    const url = `http://localhost:3001/api/chat/rooms/f304baf4-3dd3-48d0-8991-cb97b51b104f/messages?_t=${timestamp}`;
    console.log('🔗 Request URL:', url);
    console.log('🔑 Token (first 50 chars):', token.substring(0, 50) + '...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    
    console.log('✅ Response received:');
    console.log('📊 Status:', response.status);
    console.log('📋 Data:', JSON.stringify(data, null, 2));

    if (data.messages) {
      console.log(`📊 Total messages: ${data.messages.length}`);
      data.messages.forEach((msg, i) => {
        console.log(`${i+1}. ID: ${msg.id}, Content: ${msg.content || msg.message}, Type: ${msg.message_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing messages API:', error.message);
  }
}

testMessagesAPI(); 