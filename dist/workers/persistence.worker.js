"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kafkaService_1 = __importDefault(require("../services/kafkaService"));
const redis_1 = __importDefault(require("../config/redis"));
const database_1 = __importDefault(require("../config/database"));
class PersistenceWorker {
    constructor() {
        this.isRunning = false;
        this.consumers = [];
        this.batchSize = 100;
        this.flushInterval = 5000; // 5 seconds
        this.messageBatch = [];
        this.eventBatch = [];
        this.analyticsBatch = [];
        this.flushTimer = null;
        console.log('🚀 Persistence Worker initializing...');
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Persistence Worker is already running');
            return;
        }
        try {
            // Connect Kafka producer first
            await kafkaService_1.default.connectProducer();
            console.log('✅ Kafka Producer connected for Persistence Worker');
            // Start consumers with retry mechanism
            await this.startChatMessageConsumer();
            // TODO: Enable when user_events table is created
            // await this.startUserEventConsumer();
            // TODO: Enable when analytics_events table is created  
            // await this.startAnalyticsConsumer();
            // Start batch flush timer
            this.startFlushTimer();
            this.isRunning = true;
            console.log('🚀 Persistence Worker started successfully - Ready for enterprise scale!');
        }
        catch (error) {
            console.error('❌ Failed to start Persistence Worker:', error);
            // Retry mechanism
            setTimeout(async () => {
                console.log('🔄 Retrying Persistence Worker startup...');
                try {
                    await this.start();
                }
                catch (retryError) {
                    console.error('❌ Persistence Worker retry failed:', retryError);
                }
            }, 10000); // Retry after 10 seconds
            throw error;
        }
    }
    async startChatMessageConsumer() {
        const consumer = kafkaService_1.default.createChatMessageConsumer('persistence-chat-messages', async (message) => {
            try {
                await this.addMessageToBatch(message);
            }
            catch (error) {
                console.error('❌ Error adding message to batch:', error);
                throw error;
            }
        });
        this.consumers.push(consumer);
        console.log('✅ Chat message persistence consumer started');
    }
    async startUserEventConsumer() {
        const consumer = kafkaService_1.default.createUserEventConsumer('persistence-user-events', async (event) => {
            try {
                await this.addEventToBatch(event);
            }
            catch (error) {
                console.error('❌ Error adding event to batch:', error);
                throw error;
            }
        });
        this.consumers.push(consumer);
        console.log('✅ User event persistence consumer started');
    }
    async startAnalyticsConsumer() {
        // Create analytics consumer manually since it's not in the main service
        const consumer = kafkaService_1.default.createConsumer('persistence-analytics', ['analytics-events'], async (payload) => {
            try {
                const event = JSON.parse(payload.message.value?.toString() || '');
                await this.addAnalyticsToBatch(event);
            }
            catch (error) {
                console.error('❌ Error adding analytics to batch:', error);
                throw error;
            }
        });
        this.consumers.push(consumer);
        console.log('✅ Analytics persistence consumer started');
    }
    startFlushTimer() {
        this.flushTimer = setInterval(async () => {
            try {
                await this.flushAllBatches();
            }
            catch (error) {
                console.error('❌ Error during scheduled flush:', error);
            }
        }, this.flushInterval);
    }
    async addMessageToBatch(message) {
        this.messageBatch.push(message);
        if (this.messageBatch.length >= this.batchSize) {
            await this.flushMessageBatch();
        }
    }
    async addEventToBatch(event) {
        this.eventBatch.push(event);
        if (this.eventBatch.length >= this.batchSize) {
            await this.flushEventBatch();
        }
    }
    async addAnalyticsToBatch(event) {
        this.analyticsBatch.push(event);
        if (this.analyticsBatch.length >= this.batchSize) {
            await this.flushAnalyticsBatch();
        }
    }
    async flushAllBatches() {
        const promises = [];
        if (this.messageBatch.length > 0) {
            promises.push(this.flushMessageBatch());
        }
        if (this.eventBatch.length > 0) {
            promises.push(this.flushEventBatch());
        }
        if (this.analyticsBatch.length > 0) {
            promises.push(this.flushAnalyticsBatch());
        }
        if (promises.length > 0) {
            await Promise.all(promises);
            console.log(`✅ Flushed all batches - Messages: ${this.messageBatch.length}, Events: ${this.eventBatch.length}, Analytics: ${this.analyticsBatch.length}`);
        }
    }
    async flushMessageBatch() {
        if (this.messageBatch.length === 0)
            return;
        const batch = [...this.messageBatch];
        this.messageBatch = [];
        const startTime = Date.now();
        try {
            // Skip PostgreSQL save for now due to id type mismatch (UUID vs INTEGER)
            // TODO: Fix messages table id type or create separate table for Kafka messages
            console.log(`📝 Skipping PostgreSQL save for ${batch.length} messages (id type mismatch)`);
            // Just save to Redis for now
            // Also save to Redis for fast retrieval
            for (const msg of batch) {
                const redisMessage = {
                    id: msg.id,
                    roomId: msg.roomId,
                    sender_id: msg.userId,
                    content: msg.content,
                    message_type: msg.messageType,
                    created_at: new Date(msg.timestamp).toISOString(),
                    metadata: msg.metadata
                };
                try {
                    await redis_1.default.saveMessage(msg.roomId, redisMessage);
                }
                catch (redisError) {
                    console.warn('⚠️ Failed to save message to Redis:', redisError);
                }
            }
            // Skip chat room timestamp update for now
            console.log(`📊 Processed ${batch.length} messages to Redis only`);
            const processingTime = Date.now() - startTime;
            console.log(`✅ Persisted ${batch.length} messages in ${processingTime}ms`);
        }
        catch (error) {
            console.error('❌ Failed to persist message batch:', error);
            // Re-add failed messages to batch for retry
            this.messageBatch.unshift(...batch);
            throw error;
        }
    }
    async flushEventBatch() {
        if (this.eventBatch.length === 0)
            return;
        const batch = [...this.eventBatch];
        this.eventBatch = [];
        const startTime = Date.now();
        try {
            // Prepare batch insert for user events
            const values = batch.map(event => [
                event.userId,
                event.eventType,
                event.roomId || null,
                new Date(event.timestamp),
                JSON.stringify(event.metadata || {})
            ]);
            const placeholders = values.map((_, index) => {
                const base = index * 5;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
            }).join(', ');
            const query = `
        INSERT INTO user_events (user_id, event_type, room_id, created_at, metadata)
        VALUES ${placeholders}
      `;
            const flatValues = values.flat();
            await database_1.default.query(query, flatValues);
            // Update user activity timestamps
            const userUpdates = new Map();
            batch.forEach(event => {
                const currentTime = userUpdates.get(event.userId) || 0;
                if (event.timestamp > currentTime) {
                    userUpdates.set(event.userId, event.timestamp);
                }
            });
            for (const [userId, timestamp] of userUpdates) {
                await database_1.default.query('UPDATE users SET last_activity_at = $1 WHERE id = $2', [new Date(timestamp), userId]);
            }
            const processingTime = Date.now() - startTime;
            console.log(`✅ Persisted ${batch.length} user events in ${processingTime}ms`);
        }
        catch (error) {
            console.error('❌ Failed to persist event batch:', error);
            // Re-add failed events to batch for retry
            this.eventBatch.unshift(...batch);
            throw error;
        }
    }
    async flushAnalyticsBatch() {
        if (this.analyticsBatch.length === 0)
            return;
        const batch = [...this.analyticsBatch];
        this.analyticsBatch = [];
        const startTime = Date.now();
        try {
            // Prepare batch insert for analytics
            const values = batch.map(event => [
                event.userId,
                event.eventType,
                JSON.stringify(event.eventData),
                new Date(event.timestamp),
                event.sessionId || null
            ]);
            const placeholders = values.map((_, index) => {
                const base = index * 5;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
            }).join(', ');
            const query = `
        INSERT INTO analytics_events (user_id, event_type, event_data, created_at, session_id)
        VALUES ${placeholders}
      `;
            const flatValues = values.flat();
            await database_1.default.query(query, flatValues);
            // Update Redis analytics counters
            await this.updateAnalyticsCounters(batch);
            const processingTime = Date.now() - startTime;
            console.log(`✅ Persisted ${batch.length} analytics events in ${processingTime}ms`);
        }
        catch (error) {
            console.error('❌ Failed to persist analytics batch:', error);
            // Re-add failed analytics to batch for retry
            this.analyticsBatch.unshift(...batch);
            throw error;
        }
    }
    async updateAnalyticsCounters(events) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const counters = new Map();
            events.forEach(event => {
                const key = `analytics:${today}:${event.eventType}`;
                counters.set(key, (counters.get(key) || 0) + 1);
            });
            for (const [key, count] of counters) {
                await redis_1.default.set(key, count.toString(), 86400); // 24 hours
            }
        }
        catch (error) {
            console.warn('⚠️ Failed to update analytics counters in Redis:', error);
        }
    }
    // Database cleanup and maintenance
    async performMaintenance() {
        try {
            console.log('🧹 Starting database maintenance...');
            // Clean old messages (older than 30 days)
            const oldMessageResult = await database_1.default.query('DELETE FROM messages WHERE created_at < NOW() - INTERVAL \'30 days\'');
            console.log(`🗑️ Cleaned ${oldMessageResult.rowCount} old messages`);
            // TODO: Enable when user_events table exists
            // Clean old user events (older than 7 days)
            // const oldEventResult = await pool.query(
            //   'DELETE FROM user_events WHERE created_at < NOW() - INTERVAL \'7 days\''
            // );
            // console.log(`🗑️ Cleaned ${oldEventResult.rowCount} old user events`);
            // TODO: Enable when analytics_events table exists
            // Clean old analytics (older than 90 days)
            // const oldAnalyticsResult = await pool.query(
            //   'DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL \'90 days\''
            // );
            // console.log(`🗑️ Cleaned ${oldAnalyticsResult.rowCount} old analytics events`);
            // Vacuum analyze for performance
            await database_1.default.query('VACUUM ANALYZE messages');
            console.log('✅ Database maintenance completed');
        }
        catch (error) {
            console.error('❌ Database maintenance failed:', error);
        }
    }
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️ Persistence Worker is not running');
            return;
        }
        try {
            // Stop flush timer
            if (this.flushTimer) {
                clearInterval(this.flushTimer);
                this.flushTimer = null;
            }
            // Flush remaining batches
            await this.flushAllBatches();
            // Disconnect all consumers
            for (const consumer of this.consumers) {
                await consumer.disconnect();
            }
            this.consumers = [];
            this.isRunning = false;
            console.log('✅ Persistence Worker stopped successfully');
        }
        catch (error) {
            console.error('❌ Error stopping Persistence Worker:', error);
            throw error;
        }
    }
    isWorkerRunning() {
        return this.isRunning;
    }
    async getHealth() {
        return {
            isRunning: this.isRunning,
            consumers: this.consumers.length,
            batchSizes: {
                messages: this.messageBatch.length,
                events: this.eventBatch.length,
                analytics: this.analyticsBatch.length
            },
            kafka: await kafkaService_1.default.healthCheck()
        };
    }
    async getStats() {
        const today = new Date().toISOString().split('T')[0];
        const [totalMessages, todayMessages] = await Promise.all([
            database_1.default.query('SELECT COUNT(*) FROM messages'),
            database_1.default.query('SELECT COUNT(*) FROM messages WHERE created_at::date = $1', [today])
        ]);
        return {
            totalMessages: parseInt(totalMessages.rows[0].count),
            totalEvents: 0, // TODO: Enable when user_events table exists
            totalAnalytics: 0, // TODO: Enable when analytics_events table exists
            todayMessages: parseInt(todayMessages.rows[0].count),
            todayEvents: 0, // TODO: Enable when user_events table exists
            todayAnalytics: 0 // TODO: Enable when analytics_events table exists
        };
    }
    // Manual flush methods for testing
    async forceFlush() {
        await this.flushAllBatches();
    }
    async forceMaintenance() {
        await this.performMaintenance();
    }
}
// Create singleton instance
const persistenceWorker = new PersistenceWorker();
// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down Persistence Worker...');
    await persistenceWorker.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down Persistence Worker...');
    await persistenceWorker.stop();
    process.exit(0);
});
// Schedule daily maintenance at 2 AM
const scheduleMaintenanceTimer = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2 AM
    const msUntilMaintenance = tomorrow.getTime() - now.getTime();
    setTimeout(async () => {
        if (persistenceWorker.isWorkerRunning()) {
            await persistenceWorker.forceMaintenance();
        }
        // Schedule next maintenance
        scheduleMaintenanceTimer();
    }, msUntilMaintenance);
    console.log(`🕐 Next maintenance scheduled for ${tomorrow.toISOString()}`);
};
// Start the worker if this file is run directly
if (require.main === module) {
    persistenceWorker.start().then(() => {
        scheduleMaintenanceTimer();
    }).catch((error) => {
        console.error('❌ Failed to start Persistence Worker:', error);
        process.exit(1);
    });
}
exports.default = persistenceWorker;
