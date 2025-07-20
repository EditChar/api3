const { Kafka } = require('kafkajs');
const redis = require('redis');

async function debugWorker() {
  console.log('🔧 Debug Worker Starting...');

  // Setup Kafka
  const kafka = new Kafka({
    clientId: 'debug-worker',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
    retry: {
      retries: 3,
      initialRetryTime: 1000,
    }
  });

  // Setup Redis
  const redisClient = redis.createClient({
    host: 'localhost',
    port: 7000
  });

  try {
    // Connect Redis
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Connect Kafka Consumer
    const consumer = kafka.consumer({ 
      groupId: 'debug-persistence-worker',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    await consumer.subscribe({ topic: 'chat-messages', fromBeginning: false });
    console.log('✅ Subscribed to chat-messages topic');

    console.log('🎧 Listening for messages...');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          console.log('\n📨 Message received from Kafka:');
          console.log('  💬 Content:', messageData.content);
          console.log('  👤 User ID:', messageData.userId);
          console.log('  🏠 Room ID:', messageData.roomId);
          console.log('  📊 Status:', messageData.status);
          console.log('  🕐 Timestamp:', new Date(messageData.timestamp));

          // Save to Redis
          const redisMessage = {
            id: messageData.id,
            roomId: messageData.roomId,
            sender_id: messageData.userId,
            content: messageData.content,
            message_type: messageData.messageType,
            status: 'delivered',
            created_at: new Date(messageData.timestamp).toISOString(),
            metadata: messageData.metadata || {}
          };

          const key = `chat:${messageData.roomId}:messages`;
          await redisClient.lPush(key, JSON.stringify(redisMessage));
          console.log('  ✅ Saved to Redis with key:', key);

          // Check Redis
          const count = await redisClient.lLen(key);
          console.log('  📊 Total messages in Redis for this room:', count);

        } catch (error) {
          console.error('  ❌ Error processing message:', error);
        }
      },
    });

  } catch (error) {
    console.error('❌ Debug worker error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down debug worker...');
  process.exit(0);
});

debugWorker(); 