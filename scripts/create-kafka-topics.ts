import kafkaService from '../src/services/kafkaService';

async function createTopics() {
  console.log('🚀 Creating Kafka topics...');
  
  try {
    await kafkaService.connectProducer();
    console.log('✅ Kafka topics created successfully');
    await kafkaService.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create Kafka topics:', error);
    process.exit(1);
  }
}

createTopics(); 