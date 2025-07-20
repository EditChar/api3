const redis = require('redis');

async function checkMessages() {
  const client = redis.createClient({
    host: 'localhost',
    port: 7000
  });

  try {
    await client.connect();
    console.log('✅ Redis connected');

    const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
    const key = `chat:${roomId}:messages`;
    
    console.log(`🔍 Checking messages for room: ${roomId}`);
    console.log(`📋 Redis key: ${key}`);

    const messages = await client.lRange(key, 0, -1);
    console.log(`📊 Total messages in Redis: ${messages.length}`);

    if (messages.length > 0) {
      console.log('\n📨 Messages:');
      messages.forEach((messageStr, index) => {
        try {
          const message = JSON.parse(messageStr);
          console.log(`${index + 1}. [${message.created_at}] ${message.sender_id}: ${message.content} (${message.status || 'no-status'})`);
        } catch (e) {
          console.log(`${index + 1}. [Parse Error] ${messageStr}`);
        }
      });
    } else {
      console.log('❌ No messages found in Redis');
    }

    await client.disconnect();
  } catch (error) {
    console.error('❌ Redis error:', error);
  }
}

checkMessages(); 