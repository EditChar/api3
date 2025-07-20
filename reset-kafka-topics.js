const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'topic-reset-client',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
  retry: {
    retries: 3,
    initialRetryTime: 1000,
  }
});

const admin = kafka.admin();

const TOPICS_TO_RESET = [
  'chat-messages',
  'user-events', 
  'notifications',
  'analytics-events',
  'dead-letter-queue'
];

async function resetTopics() {
  try {
    console.log('🔌 Connecting to Kafka Admin...');
    await admin.connect();
    console.log('✅ Kafka Admin connected');

    // List existing topics
    const existingTopics = await admin.listTopics();
    console.log('📋 Existing topics:', existingTopics);

    // Delete existing topics
    const topicsToDelete = TOPICS_TO_RESET.filter(topic => existingTopics.includes(topic));
    
    if (topicsToDelete.length > 0) {
      console.log(`🗑️ Deleting ${topicsToDelete.length} topics...`);
      await admin.deleteTopics({
        topics: topicsToDelete,
        timeout: 30000
      });
      console.log('✅ Topics deleted successfully');
      
      // Wait a bit for deletion to complete
      console.log('⏳ Waiting for deletion to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('ℹ️ No topics to delete');
    }

    // Create new topics with gzip compression
    const topicsToCreate = [
      {
        topic: 'chat-messages',
        numPartitions: 24,
        replicationFactor: 3,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'segment.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '2' },
          { name: 'max.message.bytes', value: '1000000' } // 1MB
        ]
      },
      {
        topic: 'user-events',
        numPartitions: 12,
        replicationFactor: 3,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '86400000' }, // 1 day
          { name: 'segment.ms', value: '3600000' }, // 1 hour
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '2' }
        ]
      },
      {
        topic: 'notifications',
        numPartitions: 12,
        replicationFactor: 3,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '259200000' }, // 3 days
          { name: 'segment.ms', value: '3600000' }, // 1 hour
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '2' }
        ]
      },
      {
        topic: 'analytics-events',
        numPartitions: 6,
        replicationFactor: 3,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'segment.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '2' }
        ]
      },
      {
        topic: 'dead-letter-queue',
        numPartitions: 3,
        replicationFactor: 3,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'segment.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '2' }
        ]
      }
    ];

    console.log(`🚀 Creating ${topicsToCreate.length} topics with gzip compression...`);
    await admin.createTopics({
      topics: topicsToCreate,
      waitForLeaders: true,
      timeout: 30000
    });
    console.log('✅ Topics created successfully with gzip compression');

    // Verify topics
    const newTopics = await admin.listTopics();
    console.log('📋 New topics:', newTopics);

    await admin.disconnect();
    console.log('✅ Kafka Admin disconnected');
    console.log('🎉 Topic reset completed successfully!');

  } catch (error) {
    console.error('❌ Error resetting topics:', error);
    process.exit(1);
  }
}

console.log('🚀 Starting Kafka topic reset...');
resetTopics(); 