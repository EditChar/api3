const redis = require('redis');

async function testWorkerRedis() {
  console.log('🧪 Testing worker Redis save functionality...');
  
  const client = redis.createClient({
    host: 'localhost',
    port: 7000
  });

  try {
    await client.connect();
    console.log('✅ Redis connected');

    // Simulate a message from Kafka worker
    const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
    const message = {
      id: 'test-message-' + Date.now(),
      roomId: roomId,
      sender_id: 28,
      content: 'Test message from worker simulation',
      message_type: 'text',
      status: 'delivered',
      created_at: new Date().toISOString(),
      metadata: {}
    };

    console.log('💾 Saving test message to Redis...');
    const key = `chat:${roomId}:messages`;
    await client.lPush(key, JSON.stringify(message));
    console.log(`✅ Message saved to key: ${key}`);

    // Check if it was saved
    const messages = await client.lRange(key, 0, -1);
    console.log(`📊 Messages in Redis: ${messages.length}`);
    
    if (messages.length > 0) {
      console.log('📨 Messages found:');
      messages.forEach((msg, i) => {
        const parsed = JSON.parse(msg);
        console.log(`${i+1}. ${parsed.content} (${parsed.status})`);
      });
    }

    await client.disconnect();
    console.log('✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWorkerRedis(); 