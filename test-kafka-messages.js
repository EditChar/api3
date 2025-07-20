const { Kafka } = require('kafkajs');

async function checkKafkaMessages() {
  const kafka = new Kafka({
    clientId: 'test-consumer',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
    retry: {
      retries: 3,
      initialRetryTime: 1000,
    }
  });

  const consumer = kafka.consumer({ 
    groupId: 'test-group-' + Date.now(),
    sessionTimeout: 30000,
    heartbeatInterval: 3000
  });

  try {
    console.log('🔌 Connecting to Kafka...');
    await consumer.connect();
    console.log('✅ Kafka connected');

    console.log('📋 Subscribing to chat-messages topic...');
    await consumer.subscribe({ topic: 'chat-messages', fromBeginning: true });

    console.log('🎧 Starting to consume messages...');
    
    let messageCount = 0;
    const timeout = setTimeout(() => {
      console.log(`⏰ Timeout reached. Found ${messageCount} messages.`);
      process.exit(0);
    }, 10000); // 10 second timeout

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        clearTimeout(timeout);
        
        try {
          const messageData = JSON.parse(message.value.toString());
          console.log(`📨 Message ${messageCount}:`);
          console.log(`  📍 Partition: ${partition}`);
          console.log(`  🕐 Timestamp: ${new Date(Number(message.timestamp))}`);
          console.log(`  💬 Content: ${messageData.content}`);
          console.log(`  👤 Sender: ${messageData.sender_id}`);
          console.log(`  🏠 Room: ${messageData.roomId}`);
          console.log(`  📊 Status: ${messageData.status}`);
          console.log('  ---');
        } catch (e) {
          console.log(`❌ Parse error for message ${messageCount}:`, e.message);
          console.log(`📝 Raw message: ${message.value.toString()}`);
        }

        // Reset timeout for each message
        setTimeout(() => {
          console.log(`✅ Processed ${messageCount} messages. Exiting...`);
          process.exit(0);
        }, 2000);
      },
    });

  } catch (error) {
    console.error('❌ Kafka error:', error);
    process.exit(1);
  }
}

console.log('🚀 Starting Kafka message check...');
checkKafkaMessages(); 