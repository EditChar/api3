const redis = require('redis');

async function debugRedisMessages() {
  const client = redis.createClient({
    host: 'localhost',
    port: 7001
  });

  try {
    await client.connect();
    console.log('✅ Redis connected');

    const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
    const key = `chat:${roomId}:messages`;
    
    const messages = await client.lRange(key, 0, 2); // Get first 3 messages
    console.log(`📊 Found ${messages.length} messages`);

    messages.forEach((messageStr, index) => {
      console.log(`\n📨 Message ${index + 1}:`);
      console.log('Raw JSON:', messageStr);
      
      try {
        const message = JSON.parse(messageStr);
        console.log('Parsed object keys:', Object.keys(message));
        console.log('Parsed object:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    });

    await client.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugRedisMessages(); 