const redis = require('redis');

async function testRedisConnection() {
  console.log('🔌 Testing Redis connection...');
  
  const client = redis.createClient({
    host: 'localhost',
    port: 7000,
    // Add a timeout to prevent hanging
    socket: {
      connectTimeout: 5000
    }
  });

  client.on('error', (err) => console.error('❌ Redis Client Error', err));

  try {
    await client.connect();
    console.log('✅ Redis connected successfully');

    // Test the specific key we're looking for
    await checkMessageCount(client);

    await client.disconnect();
    console.log('✅ Redis test completed');

  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    if (client.isOpen) {
      await client.disconnect();
    }
  }
}

async function checkMessageCount(client) {
    const wasClientProvided = !!client;
    if (!client) {
        client = redis.createClient({
            host: 'localhost',
            port: 7000,
            socket: { connectTimeout: 5000 }
        });
        await client.connect();
    }
    
    try {
        const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
        const key = `chat:${roomId}:messages`;
        
        const messages = await client.lRange(key, 0, -1);
        console.log(`📊 Messages in Redis: ${messages.length}`);
        
        if (messages.length > 0) {
          console.log('✅ Last message content:', JSON.parse(messages[0]).content);
        }

    } catch(err) {
        console.error("Error checking message count:", err)
    } finally {
        if (!wasClientProvided && client.isOpen) {
            await client.disconnect();
        }
    }
}


// Allow running from command line or being required
if (require.main === module) {
  testRedisConnection();
} else {
  module.exports = { testRedisConnection, checkMessageCount };
} 