async function sendTestMessage() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI4LCJlbWFpbCI6ImVsaWZAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImVsaWYiLCJpZCI6MjgsImlhdCI6MTc1MTY1OTk1NywiZXhwIjoxNzUxNzQ2MzU3fQ.MpVwhlIvoLS4E-Ak4s1XzLdqyHFyCUEjW5AliC_AdiM";
  
  try {
    console.log('🚀 Sending test message...');
    
    const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
    const url = `http://localhost:3001/api/chat/rooms/${roomId}/messages`;
    
    const messageData = {
      message: `Test message from fix - ${new Date().toISOString()}`,
      messageType: 'text'
    };
    
    console.log('🔗 URL:', url);
    console.log('📝 Message:', messageData.message);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    console.log('📡 Response status:', response.status);
    const data = await response.json();
    console.log('📋 Response:', JSON.stringify(data, null, 2));
    
    if (data.data && data.data.id) {
      console.log(`📨 Message ID: ${data.data.id}`);
      console.log(`🏠 Room ID: ${data.data.roomId}`);
      console.log(`📊 Status: ${data.data.status}`);
      
      // Wait a bit for processing
      console.log('⏳ Waiting 5 seconds for message processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check Redis
      console.log('🔍 Checking Redis for the message...');
      const redis = require('redis');
      const client = redis.createClient({
        host: 'localhost',
        port: 7000
      });
      
      await client.connect();
      const messages = await client.lRange('chat:f304baf4-3dd3-48d0-8991-cb97b51b104f:messages', 0, -1);
      console.log(`📊 Messages in Redis: ${messages.length}`);
      
      if (messages.length > 0) {
        console.log('✅ Messages found in Redis:');
        messages.forEach((msg, i) => {
          const parsed = JSON.parse(msg);
          console.log(`${i+1}. ${parsed.content} (${parsed.status})`);
        });
      } else {
        console.log('❌ No messages found in Redis');
      }
      
      await client.disconnect();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendTestMessage(); 