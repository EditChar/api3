const { Kafka } = require('kafkajs');

async function testWorkerDirect() {
  console.log('🚀 Testing Kafka worker connection directly...');

  const kafka = new Kafka({
    clientId: 'test-worker',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
    retry: {
      retries: 3,
      initialRetryTime: 1000,
    }
  });

  const consumer = kafka.consumer({ 
    groupId: 'test-worker-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
  });

  try {
    console.log('🔌 Connecting consumer...');
    await consumer.connect();
    console.log('✅ Consumer connected');

    console.log('📋 Subscribing to chat-messages topic...');
    await consumer.subscribe({ topic: 'chat-messages', fromBeginning: true });
    console.log('✅ Subscribed to topic');

    console.log('🎧 Starting to consume messages...');
    
    let messageCount = 0;
    const timeout = setTimeout(() => {
      console.log(`⏰ Timeout reached. Processed ${messageCount} messages.`);
      process.exit(0);
    }, 15000); // 15 second timeout

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        clearTimeout(timeout);
        
        try {
          const messageData = JSON.parse(message.value.toString());
          console.log(`📨 Message ${messageCount} received:`);
          console.log(`  📍 Partition: ${partition}`);
          console.log(`  🕐 Timestamp: ${new Date(Number(message.timestamp))}`);
          console.log(`  💬 Content: ${messageData.content}`);
          console.log(`  👤 Sender: ${messageData.userId}`);
          console.log(`  🏠 Room: ${messageData.roomId}`);
          console.log(`  📊 Status: ${messageData.status}`);
          console.log('  ---');

          // Simulate Redis save
          console.log('💾 Would save to Redis here...');
          
        } catch (e) {
          console.log(`❌ Parse error for message ${messageCount}:`, e.message);
          console.log(`📝 Raw message: ${message.value.toString()}`);
        }

        // Reset timeout for each message
        setTimeout(() => {
          console.log(`✅ Processed ${messageCount} messages. Exiting...`);
          process.exit(0);
        }, 3000);
      },
    });

  } catch (error) {
    console.error('❌ Kafka worker test error:', error);
    process.exit(1);
  }
}

console.log('🚀 Starting direct worker test...');
testWorkerDirect(); 