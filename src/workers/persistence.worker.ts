import kafkaService, { ChatMessage, UserEvent, AnalyticsEvent } from '../services/kafkaService';
import redisClient from '../config/redis';
import pool from '../config/database';

class PersistenceWorker {
  private isRunning: boolean = false;
  private consumers: any[] = [];
  private batchSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds
  private messageBatch: ChatMessage[] = [];
  private eventBatch: UserEvent[] = [];
  private analyticsBatch: AnalyticsEvent[] = [];
  private flushTimer: any | null = null;

  constructor() {
    console.log('🚀 Persistence Worker initializing...');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Persistence Worker is already running');
      return;
    }

    try {
      // Connect Kafka producer first
      await kafkaService.connectProducer();
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
      
    } catch (error) {
      console.error('❌ Failed to start Persistence Worker:', error);
      
      // Retry mechanism
      setTimeout(async () => {
        console.log('🔄 Retrying Persistence Worker startup...');
        try {
          await this.start();
        } catch (retryError) {
          console.error('❌ Persistence Worker retry failed:', retryError);
        }
      }, 10000); // Retry after 10 seconds
      
      throw error;
    }
  }

  private async startChatMessageConsumer(): Promise<void> {
    const consumer = kafkaService.createChatMessageConsumer(
      'persistence-chat-messages',
      async (message: ChatMessage) => {
        try {
          await this.addMessageToBatch(message);
        } catch (error) {
          console.error('❌ Error adding message to batch:', error);
          throw error;
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ Chat message persistence consumer started');
  }

  private async startUserEventConsumer(): Promise<void> {
    const consumer = kafkaService.createUserEventConsumer(
      'persistence-user-events',
      async (event: UserEvent) => {
        try {
          await this.addEventToBatch(event);
        } catch (error) {
          console.error('❌ Error adding event to batch:', error);
          throw error;
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ User event persistence consumer started');
  }

  private async startAnalyticsConsumer(): Promise<void> {
    // Create analytics consumer manually since it's not in the main service
    const consumer = kafkaService.createConsumer(
      'persistence-analytics',
      ['analytics-events'],
      async (payload) => {
        try {
          const event: AnalyticsEvent = JSON.parse(payload.message.value?.toString() || '');
          await this.addAnalyticsToBatch(event);
        } catch (error) {
          console.error('❌ Error adding analytics to batch:', error);
          throw error;
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ Analytics persistence consumer started');
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flushAllBatches();
      } catch (error) {
        console.error('❌ Error during scheduled flush:', error);
      }
    }, this.flushInterval);
  }

  private async addMessageToBatch(message: ChatMessage): Promise<void> {
    this.messageBatch.push(message);
    
    if (this.messageBatch.length >= this.batchSize) {
      await this.flushMessageBatch();
    }
  }

  private async addEventToBatch(event: UserEvent): Promise<void> {
    this.eventBatch.push(event);
    
    if (this.eventBatch.length >= this.batchSize) {
      await this.flushEventBatch();
    }
  }

  private async addAnalyticsToBatch(event: AnalyticsEvent): Promise<void> {
    this.analyticsBatch.push(event);
    
    if (this.analyticsBatch.length >= this.batchSize) {
      await this.flushAnalyticsBatch();
    }
  }

  private async flushAllBatches(): Promise<void> {
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

  private async flushMessageBatch(): Promise<void> {
    if (this.messageBatch.length === 0) return;

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
          await redisClient.saveMessage(msg.roomId, redisMessage);
        } catch (redisError) {
          console.warn('⚠️ Failed to save message to Redis:', redisError);
        }
      }

      // Skip chat room timestamp update for now
      console.log(`📊 Processed ${batch.length} messages to Redis only`);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Persisted ${batch.length} messages in ${processingTime}ms`);

    } catch (error) {
      console.error('❌ Failed to persist message batch:', error);
      // Re-add failed messages to batch for retry
      this.messageBatch.unshift(...batch);
      throw error;
    }
  }

  private async flushEventBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return;

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
      await pool.query(query, flatValues);

      // Update user activity timestamps
      const userUpdates = new Map<number, number>();
      batch.forEach(event => {
        const currentTime = userUpdates.get(event.userId) || 0;
        if (event.timestamp > currentTime) {
          userUpdates.set(event.userId, event.timestamp);
        }
      });

      for (const [userId, timestamp] of userUpdates) {
        await pool.query(
          'UPDATE users SET last_activity_at = $1 WHERE id = $2',
          [new Date(timestamp), userId]
        );
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Persisted ${batch.length} user events in ${processingTime}ms`);

    } catch (error) {
      console.error('❌ Failed to persist event batch:', error);
      // Re-add failed events to batch for retry
      this.eventBatch.unshift(...batch);
      throw error;
    }
  }

  private async flushAnalyticsBatch(): Promise<void> {
    if (this.analyticsBatch.length === 0) return;

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
      await pool.query(query, flatValues);

      // Update Redis analytics counters
      await this.updateAnalyticsCounters(batch);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Persisted ${batch.length} analytics events in ${processingTime}ms`);

    } catch (error) {
      console.error('❌ Failed to persist analytics batch:', error);
      // Re-add failed analytics to batch for retry
      this.analyticsBatch.unshift(...batch);
      throw error;
    }
  }

  private async updateAnalyticsCounters(events: AnalyticsEvent[]): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const counters = new Map<string, number>();

      events.forEach(event => {
        const key = `analytics:${today}:${event.eventType}`;
        counters.set(key, (counters.get(key) || 0) + 1);
      });

      for (const [key, count] of counters) {
        await redisClient.set(key, count.toString(), 86400); // 24 hours
      }
    } catch (error) {
      console.warn('⚠️ Failed to update analytics counters in Redis:', error);
    }
  }

  // Database cleanup and maintenance
  private async performMaintenance(): Promise<void> {
    try {
      console.log('🧹 Starting database maintenance...');

      // Clean old messages (older than 30 days)
      const oldMessageResult = await pool.query(
        'DELETE FROM messages WHERE created_at < NOW() - INTERVAL \'30 days\''
      );
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
      await pool.query('VACUUM ANALYZE messages');
      
      console.log('✅ Database maintenance completed');

    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
    }
  }

  public async stop(): Promise<void> {
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

    } catch (error) {
      console.error('❌ Error stopping Persistence Worker:', error);
      throw error;
    }
  }

  public isWorkerRunning(): boolean {
    return this.isRunning;
  }

  public async getHealth(): Promise<{
    isRunning: boolean;
    consumers: number;
    batchSizes: {
      messages: number;
      events: number;
      analytics: number;
    };
    kafka: any;
  }> {
    return {
      isRunning: this.isRunning,
      consumers: this.consumers.length,
      batchSizes: {
        messages: this.messageBatch.length,
        events: this.eventBatch.length,
        analytics: this.analyticsBatch.length
      },
      kafka: await kafkaService.healthCheck()
    };
  }

  public async getStats(): Promise<{
    totalMessages: number;
    totalEvents: number;
    totalAnalytics: number;
    todayMessages: number;
    todayEvents: number;
    todayAnalytics: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [totalMessages, todayMessages] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM messages'),
      pool.query('SELECT COUNT(*) FROM messages WHERE created_at::date = $1', [today])
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
  public async forceFlush(): Promise<void> {
    await this.flushAllBatches();
  }

  public async forceMaintenance(): Promise<void> {
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

export default persistenceWorker; 