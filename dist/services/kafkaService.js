"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseKafkaService = void 0;
const kafkajs_1 = require("kafkajs");
// Kafka Cluster Configuration
const KAFKA_BROKERS = [
    'localhost:9092',
    'localhost:9093',
    'localhost:9094'
];
const CLIENT_ID = 'e2-api-cluster';
// Topic Configurations for High Volume Messaging
const TOPICS_CONFIG = {
    CHAT_MESSAGES: {
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
    USER_EVENTS: {
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
    NOTIFICATIONS: {
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
    ANALYTICS: {
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
    DEAD_LETTER: {
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
};
class EnterpriseKafkaService {
    constructor() {
        this.producer = null;
        this.admin = null;
        this.consumers = new Map();
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.kafka = new kafkajs_1.Kafka({
            clientId: CLIENT_ID,
            brokers: KAFKA_BROKERS,
            logLevel: kafkajs_1.logLevel.INFO,
            retry: {
                initialRetryTime: 100,
                retries: 8,
                maxRetryTime: 30000,
                factor: 0.2,
                multiplier: 2,
                restartOnFailure: async (e) => {
                    console.error('Kafka restart on failure:', e);
                    return true;
                }
            },
            connectionTimeout: 10000,
            requestTimeout: 30000,
        });
        this.initializeAdmin();
    }
    async initializeAdmin() {
        try {
            this.admin = this.kafka.admin();
            await this.admin.connect();
            console.log('✅ Kafka Admin connected');
            await this.createTopics();
        }
        catch (error) {
            console.error('❌ Kafka Admin connection failed:', error);
            throw error;
        }
    }
    async createTopics() {
        if (!this.admin)
            return;
        try {
            const existingTopics = await this.admin.listTopics();
            const topicsToCreate = [];
            for (const [key, config] of Object.entries(TOPICS_CONFIG)) {
                if (!existingTopics.includes(config.topic)) {
                    topicsToCreate.push({
                        topic: config.topic,
                        numPartitions: config.numPartitions,
                        replicationFactor: config.replicationFactor,
                        configEntries: config.configEntries
                    });
                }
            }
            if (topicsToCreate.length > 0) {
                await this.admin.createTopics({
                    topics: topicsToCreate,
                    waitForLeaders: true,
                    timeout: 30000
                });
                console.log(`✅ Created ${topicsToCreate.length} Kafka topics`);
            }
            else {
                console.log('✅ All Kafka topics already exist');
            }
        }
        catch (error) {
            console.error('❌ Failed to create Kafka topics:', error);
            throw error;
        }
    }
    async connectProducer() {
        if (this.producer && this.isConnected) {
            return;
        }
        try {
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000,
                retry: {
                    initialRetryTime: 100,
                    retries: 5
                },
                metadataMaxAge: 300000, // 5 minutes
                allowAutoTopicCreation: false
            });
            await this.producer.connect();
            this.isConnected = true;
            this.retryCount = 0;
            console.log('✅ Kafka Producer connected successfully');
        }
        catch (error) {
            console.error('❌ Kafka Producer connection failed:', error);
            this.isConnected = false;
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                console.log(`🔄 Retrying producer connection (${this.retryCount}/${this.maxRetries})...`);
                setTimeout(() => this.connectProducer(), 5000 * this.retryCount);
            }
            else {
                throw error;
            }
        }
    }
    async disconnect() {
        try {
            if (this.producer) {
                await this.producer.disconnect();
                this.producer = null;
                console.log('🔌 Kafka Producer disconnected');
            }
            for (const [groupId, consumer] of this.consumers) {
                await consumer.disconnect();
                console.log(`🔌 Kafka Consumer (${groupId}) disconnected`);
            }
            this.consumers.clear();
            if (this.admin) {
                await this.admin.disconnect();
                this.admin = null;
                console.log('🔌 Kafka Admin disconnected');
            }
            this.isConnected = false;
        }
        catch (error) {
            console.error('❌ Error during Kafka disconnect:', error);
        }
    }
    // High-level message sending methods
    async sendChatMessage(message) {
        if (!this.producer || !this.isConnected) {
            throw new Error('Producer is not connected. Please call connectProducer() first.');
        }
        try {
            await this.producer.send({
                topic: TOPICS_CONFIG.CHAT_MESSAGES.topic,
                messages: [{
                        key: message.roomId, // Partition by room ID for ordering
                        value: JSON.stringify(message),
                        timestamp: message.timestamp.toString(),
                        headers: {
                            messageType: message.messageType,
                            userId: message.userId.toString(),
                            version: '1.0'
                        }
                    }],
                acks: -1, // Wait for all replicas
                timeout: 30000
            });
        }
        catch (error) {
            console.error('❌ Failed to send chat message:', error);
            // Send to dead letter queue
            await this.sendToDeadLetterQueue('chat-message', message, error);
            throw error;
        }
    }
    async sendUserEvent(event) {
        if (!this.producer || !this.isConnected) {
            throw new Error('Producer is not connected. Please call connectProducer() first.');
        }
        try {
            await this.producer.send({
                topic: TOPICS_CONFIG.USER_EVENTS.topic,
                messages: [{
                        key: event.userId.toString(), // Partition by user ID
                        value: JSON.stringify(event),
                        timestamp: event.timestamp.toString(),
                        headers: {
                            eventType: event.eventType,
                            userId: event.userId.toString(),
                            version: '1.0'
                        }
                    }],
                acks: -1,
                timeout: 30000
            });
        }
        catch (error) {
            console.error('❌ Failed to send user event:', error);
            await this.sendToDeadLetterQueue('user-event', event, error);
            throw error;
        }
    }
    async sendNotification(notification) {
        if (!this.producer || !this.isConnected) {
            throw new Error('Producer is not connected. Please call connectProducer() first.');
        }
        try {
            await this.producer.send({
                topic: TOPICS_CONFIG.NOTIFICATIONS.topic,
                messages: [{
                        key: notification.userId.toString(),
                        value: JSON.stringify(notification),
                        timestamp: notification.timestamp.toString(),
                        headers: {
                            notificationType: notification.type,
                            userId: notification.userId.toString(),
                            version: '1.0'
                        }
                    }],
                acks: -1,
                timeout: 30000
            });
        }
        catch (error) {
            console.error('❌ Failed to send notification:', error);
            await this.sendToDeadLetterQueue('notification', notification, error);
            throw error;
        }
    }
    async sendAnalyticsEvent(event) {
        if (!this.producer || !this.isConnected) {
            throw new Error('Producer is not connected. Please call connectProducer() first.');
        }
        try {
            await this.producer.send({
                topic: TOPICS_CONFIG.ANALYTICS.topic,
                messages: [{
                        key: event.userId.toString(),
                        value: JSON.stringify(event),
                        timestamp: event.timestamp.toString(),
                        headers: {
                            eventType: event.eventType,
                            userId: event.userId.toString(),
                            version: '1.0'
                        }
                    }],
                acks: -1, // 🔧 FIX: İdempotent producer için -1 (all) gerekli
                timeout: 10000
            });
        }
        catch (error) {
            console.error('⚠️ Failed to send analytics event (non-critical):', error);
            // Don't throw for analytics - it's non-critical
        }
    }
    async sendToDeadLetterQueue(originalTopic, message, error) {
        try {
            if (!this.producer)
                return;
            await this.producer.send({
                topic: TOPICS_CONFIG.DEAD_LETTER.topic,
                messages: [{
                        key: `${originalTopic}-${Date.now()}`,
                        value: JSON.stringify({
                            originalTopic,
                            originalMessage: message,
                            error: error.message,
                            timestamp: Date.now()
                        }),
                        headers: {
                            originalTopic,
                            errorType: error.constructor.name,
                            version: '1.0'
                        }
                    }],
                acks: -1,
                timeout: 30000
            });
            console.log(`📤 Message sent to dead letter queue from ${originalTopic}`);
        }
        catch (dlqError) {
            console.error('❌ Failed to send to dead letter queue:', dlqError);
        }
    }
    // Consumer creation and management
    createChatMessageConsumer(groupId, handler) {
        return this.createConsumer(groupId, [TOPICS_CONFIG.CHAT_MESSAGES.topic], async (payload) => {
            try {
                const message = JSON.parse(payload.message.value?.toString() || '');
                await handler(message);
            }
            catch (error) {
                console.error('❌ Error processing chat message:', error);
                throw error;
            }
        });
    }
    createUserEventConsumer(groupId, handler) {
        return this.createConsumer(groupId, [TOPICS_CONFIG.USER_EVENTS.topic], async (payload) => {
            try {
                const event = JSON.parse(payload.message.value?.toString() || '');
                await handler(event);
            }
            catch (error) {
                console.error('❌ Error processing user event:', error);
                throw error;
            }
        });
    }
    createNotificationConsumer(groupId, handler) {
        return this.createConsumer(groupId, [TOPICS_CONFIG.NOTIFICATIONS.topic], async (payload) => {
            try {
                const notification = JSON.parse(payload.message.value?.toString() || '');
                await handler(notification);
            }
            catch (error) {
                console.error('❌ Error processing notification:', error);
                throw error;
            }
        });
    }
    createConsumer(groupId, topics, messageHandler) {
        const consumer = this.kafka.consumer({
            groupId,
            sessionTimeout: 60000, // 🔧 60s'den fazla heartbeat kaybında rebalance
            rebalanceTimeout: 120000, // 🔧 Rebalance için daha fazla süre
            heartbeatInterval: 10000, // 🔧 10s'de bir heartbeat (daha az sık)
            metadataMaxAge: 300000,
            allowAutoTopicCreation: false,
            maxBytesPerPartition: 1048576, // 1MB
            minBytes: 1,
            maxBytes: 10485760, // 10MB
            maxWaitTimeInMs: 5000,
            retry: {
                initialRetryTime: 100,
                retries: 8
            },
            // 🔧 Rebalancing optimizasyonları
            readUncommitted: false
        });
        // Store consumer reference
        this.consumers.set(groupId, consumer);
        // Set up error handling
        consumer.on('consumer.crash', async (event) => {
            console.error(`❌ Consumer ${groupId} crashed:`, event.payload.error);
            // Attempt to restart consumer
            setTimeout(async () => {
                try {
                    await this.restartConsumer(groupId, topics, messageHandler);
                }
                catch (error) {
                    console.error(`❌ Failed to restart consumer ${groupId}:`, error);
                }
            }, 5000);
        });
        consumer.on('consumer.disconnect', () => {
            console.log(`🔌 Consumer ${groupId} disconnected`);
        });
        consumer.on('consumer.connect', () => {
            console.log(`✅ Consumer ${groupId} connected`);
        });
        // Subscribe and run
        (async () => {
            try {
                await consumer.connect();
                await consumer.subscribe({ topics, fromBeginning: false });
                await consumer.run({
                    partitionsConsumedConcurrently: 3,
                    eachMessage: async (payload) => {
                        try {
                            await messageHandler(payload);
                            // Manual commit for better control
                            await consumer.commitOffsets([{
                                    topic: payload.topic,
                                    partition: payload.partition,
                                    offset: (parseInt(payload.message.offset) + 1).toString()
                                }]);
                        }
                        catch (error) {
                            console.error(`❌ Error processing message in ${groupId}:`, error);
                            // Could implement retry logic or send to DLQ here
                            throw error;
                        }
                    }
                });
            }
            catch (error) {
                console.error(`❌ Consumer ${groupId} setup failed:`, error);
                throw error;
            }
        })();
        return consumer;
    }
    async restartConsumer(groupId, topics, messageHandler) {
        try {
            // Remove old consumer
            const oldConsumer = this.consumers.get(groupId);
            if (oldConsumer) {
                await oldConsumer.disconnect();
                this.consumers.delete(groupId);
            }
            // Create new consumer
            this.createConsumer(groupId, topics, messageHandler);
            console.log(`✅ Consumer ${groupId} restarted successfully`);
        }
        catch (error) {
            console.error(`❌ Failed to restart consumer ${groupId}:`, error);
            throw error;
        }
    }
    // Health check and monitoring
    async getTopicMetadata() {
        if (!this.admin) {
            throw new Error('Admin client not connected');
        }
        try {
            const metadata = await this.admin.fetchTopicMetadata({
                topics: Object.values(TOPICS_CONFIG).map(config => config.topic)
            });
            return metadata;
        }
        catch (error) {
            console.error('❌ Failed to fetch topic metadata:', error);
            throw error;
        }
    }
    async getConsumerGroupInfo(groupId) {
        if (!this.admin) {
            throw new Error('Admin client not connected');
        }
        try {
            const groupInfo = await this.admin.describeGroups([groupId]);
            return groupInfo;
        }
        catch (error) {
            console.error(`❌ Failed to get consumer group info for ${groupId}:`, error);
            throw error;
        }
    }
    isProducerConnected() {
        return this.isConnected && this.producer !== null;
    }
    getActiveConsumers() {
        return Array.from(this.consumers.keys());
    }
    async healthCheck() {
        const health = {
            producer: this.isProducerConnected(),
            admin: this.admin !== null,
            consumers: {},
            topics: []
        };
        // Check consumers
        for (const [groupId, consumer] of this.consumers) {
            try {
                // Simple way to check if consumer is alive
                health.consumers[groupId] = true;
            }
            catch (error) {
                health.consumers[groupId] = false;
            }
        }
        // Get topics
        try {
            if (this.admin) {
                health.topics = await this.admin.listTopics();
            }
        }
        catch (error) {
            console.error('❌ Failed to list topics for health check:', error);
        }
        return health;
    }
}
exports.EnterpriseKafkaService = EnterpriseKafkaService;
// Singleton instance
const kafkaService = new EnterpriseKafkaService();
// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down Kafka service...');
    await kafkaService.disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down Kafka service...');
    await kafkaService.disconnect();
    process.exit(0);
});
exports.default = kafkaService;
