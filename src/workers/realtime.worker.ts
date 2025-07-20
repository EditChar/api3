import kafkaService, { ChatMessage, UserEvent } from '../services/kafkaService';
import redisClient from '../config/redis';
import SocketManager from '../config/socket';
import pool from '../config/database';

class RealtimeWorker {
  private isRunning: boolean = false;
  private consumers: any[] = [];

  constructor() {
    console.log('🚀 Realtime Worker initializing...');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Realtime Worker is already running');
      return;
    }

    try {
      // Connect Kafka producer
      await kafkaService.connectProducer();
      
      // Start consumers
      await this.startChatMessageConsumer();
      await this.startUserEventConsumer();
      
      this.isRunning = true;
      console.log('✅ Realtime Worker started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Realtime Worker:', error);
      throw error;
    }
  }

  private async startChatMessageConsumer(): Promise<void> {
    const consumer = kafkaService.createChatMessageConsumer(
      'realtime-chat-processor',
      async (message: ChatMessage) => {
        try {
          await this.processChatMessage(message);
        } catch (error) {
          console.error('❌ Error processing chat message in realtime worker:', error);
          throw error; // This will trigger retry mechanism
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ Chat message consumer started');
  }

  private async startUserEventConsumer(): Promise<void> {
    const consumer = kafkaService.createUserEventConsumer(
      'realtime-user-events',
      async (event: UserEvent) => {
        try {
          await this.processUserEvent(event);
        } catch (error) {
          console.error('❌ Error processing user event in realtime worker:', error);
          throw error; // This will trigger retry mechanism
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ User event consumer started');
  }

  private async processChatMessage(message: ChatMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get room participants for real-time delivery
      const roomResult = await pool.query(
        'SELECT user1_id, user2_id FROM chats WHERE id = $1 AND status = $2',
        [message.roomId, 'active']
      );

      if (roomResult.rows.length === 0) {
        console.warn(`⚠️ Room ${message.roomId} not found or inactive`);
        return;
      }

      const room = roomResult.rows[0];
      const receiverId = room.user1_id === message.userId ? room.user2_id : room.user1_id;

      // Get sender information for UI
      const senderResult = await pool.query(
        'SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = $1',
        [message.userId]
      );

      const sender = senderResult.rows[0];

      // Prepare real-time message payload (ChatScreen format)
      const realtimePayload = {
        id: message.id,
        sender_id: message.userId,
        content: message.content,
        message_type: message.messageType,
        created_at: new Date(message.timestamp).toISOString(),
        sender: sender
      };

      // Send via Socket.IO to room participants
      try {
        // 🔧 WAIT for SocketManager if not ready yet
        let socketManager = SocketManager.getInstance();
        let retryCount = 0;
        while (!socketManager && retryCount < 5) {
          console.log(`⏳ Waiting for SocketManager... (${retryCount + 1}/5)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          socketManager = SocketManager.getInstance(); // Yeniden dene
          retryCount++;
        }
        
        if (socketManager) {
          // Send to room (both users)
          socketManager.sendToRoom(message.roomId, 'new_message', realtimePayload);

          // 🚀 CHAT LIST REAL-TIME UPDATE: Her iki kullanıcıya da chat listesi güncellemesi gönder
          const chatListUpdate = {
            roomId: message.roomId,
            last_message: message.content,
            last_message_at: new Date(message.timestamp).toISOString(),
            sender_id: message.userId,
            message_type: message.messageType
          };
          
          socketManager.sendToUser(message.userId, 'chat_list_update', chatListUpdate);
          socketManager.sendToUser(receiverId, 'chat_list_update', chatListUpdate);
          console.log(`📋 Chat list update sent to both users for room ${message.roomId}`);
        } else {
          console.warn('⚠️ SocketManager not available, skipping real-time delivery');
        }
      } catch (socketError) {
        console.warn('⚠️ Socket.IO delivery failed:', socketError);
      }

      console.log(`✅ Chat message sent to room in ${Date.now() - startTime}ms - Room: ${message.roomId}`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to process chat message after ${processingTime}ms:`, error);
      throw error;
    }
  }

  private async processUserEvent(event: UserEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // 🔧 WAIT for SocketManager if not ready yet
      let socketManager = SocketManager.getInstance();
      let retryCount = 0;
      while (!socketManager && retryCount < 3) {
        console.log(`⏳ Waiting for SocketManager in UserEvent... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        socketManager = SocketManager.getInstance(); // Yeniden dene
        retryCount++;
      }
      
      if (!socketManager) {
        console.warn('⚠️ SocketManager not available after retries, skipping user event processing');
        return;
      }

      switch (event.eventType) {
        case 'online':
          await redisClient.setUserOnline(event.userId);
          
          // Notify friends/contacts about online status
          socketManager.broadcastUserStatus(event.userId, 'online');
          
          // Analytics
          await kafkaService.sendAnalyticsEvent({
            userId: event.userId,
            eventType: 'user_online',
            eventData: { timestamp: event.timestamp },
            timestamp: Date.now()
          });
          break;

        case 'offline':
          await redisClient.setUserOffline(event.userId);
          
          // Notify friends/contacts about offline status
          socketManager.broadcastUserStatus(event.userId, 'offline');
          
          // Analytics
          await kafkaService.sendAnalyticsEvent({
            userId: event.userId,
            eventType: 'user_offline',
            eventData: { timestamp: event.timestamp },
            timestamp: Date.now()
          });
          break;

        case 'typing':
          if (event.roomId && event.metadata?.otherUserId) {
            // Send typing indicator to other user in real-time
            socketManager.sendToUser(event.metadata.otherUserId, 'typing_indicator', {
              roomId: event.roomId,
              userId: event.userId,
              isTyping: event.metadata.isTyping || true,
              timestamp: event.timestamp
            });

            // Set typing status in Redis with short TTL
            if (event.metadata.isTyping) {
              await redisClient.set(
                `typing:${event.roomId}:${event.userId}`, 
                'true', 
                10 // 10 seconds
              );
            } else {
              await redisClient.del(`typing:${event.roomId}:${event.userId}`);
            }
          }
          break;



        case 'join_room':
          if (event.roomId) {
            // Update user's current room
            await redisClient.set(
              `user:${event.userId}:current_room`, 
              event.roomId, 
              3600 // 1 hour
            );

            // Notify other user about room join
            if (event.metadata?.otherUserId) {
              socketManager.sendToUser(event.metadata.otherUserId, 'user_joined_room', {
                roomId: event.roomId,
                userId: event.userId,
                timestamp: event.timestamp
              });
            }

            // Analytics
            await kafkaService.sendAnalyticsEvent({
              userId: event.userId,
              eventType: 'room_joined',
              eventData: { 
                roomId: event.roomId,
                roomType: event.metadata?.roomType || 'chat'
              },
              timestamp: Date.now()
            });
          }
          break;

        case 'leave_room':
          if (event.roomId) {
            // Remove user's current room
            await redisClient.del(`user:${event.userId}:current_room`);

            // Notify other user about room leave
            if (event.metadata?.otherUserId) {
              socketManager.sendToUser(event.metadata.otherUserId, 'user_left_room', {
                roomId: event.roomId,
                userId: event.userId,
                reason: event.metadata.reason || 'unknown',
                timestamp: event.timestamp
              });
            }

            // Analytics
            await kafkaService.sendAnalyticsEvent({
              userId: event.userId,
              eventType: 'room_left',
              eventData: { 
                roomId: event.roomId,
                reason: event.metadata?.reason || 'unknown'
              },
              timestamp: Date.now()
            });
          }
          break;

        default:
          console.warn(`⚠️ Unknown user event type: ${event.eventType}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ User event processed in ${processingTime}ms - Type: ${event.eventType}, User: ${event.userId}`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to process user event after ${processingTime}ms:`, error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Realtime Worker is not running');
      return;
    }

    try {
      // Disconnect all consumers
      for (const consumer of this.consumers) {
        await consumer.disconnect();
      }
      this.consumers = [];

      // Disconnect Kafka service
      await kafkaService.disconnect();

      this.isRunning = false;
      console.log('✅ Realtime Worker stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping Realtime Worker:', error);
      throw error;
    }
  }

  public isWorkerRunning(): boolean {
    return this.isRunning;
  }

  public async getHealth(): Promise<{
    isRunning: boolean;
    consumers: number;
    kafka: any;
  }> {
    return {
      isRunning: this.isRunning,
      consumers: this.consumers.length,
      kafka: await kafkaService.healthCheck()
    };
  }
}

// Create singleton instance
const realtimeWorker = new RealtimeWorker();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down Realtime Worker...');
  await realtimeWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down Realtime Worker...');
  await realtimeWorker.stop();
  process.exit(0);
});

// Start the worker if this file is run directly
if (require.main === module) {
  realtimeWorker.start().catch((error) => {
    console.error('❌ Failed to start Realtime Worker:', error);
    process.exit(1);
  });
}

export default realtimeWorker; 