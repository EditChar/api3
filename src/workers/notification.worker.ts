import kafkaService, { NotificationEvent } from '../services/kafkaService';
import { createNotification, sendPushNotification } from '../services/notificationService';
import redisClient from '../config/redis';
import SocketManager from '../config/socket';
import pool from '../config/database';

class NotificationWorker {
  private isRunning: boolean = false;
  private consumers: any[] = [];

  constructor() {
    console.log('🚀 Notification Worker initializing...');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Notification Worker is already running');
      return;
    }

    try {
      // Connect Kafka producer
      await kafkaService.connectProducer();
      
      // Start notification consumer
      await this.startNotificationConsumer();
      
      this.isRunning = true;
      console.log('✅ Notification Worker started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Notification Worker:', error);
      throw error;
    }
  }

  private async startNotificationConsumer(): Promise<void> {
    const consumer = kafkaService.createNotificationConsumer(
      'notification-processor',
      async (notification: NotificationEvent) => {
        try {
          await this.processNotification(notification);
        } catch (error) {
          console.error('❌ Error processing notification in worker:', error);
          throw error; // This will trigger retry mechanism
        }
      }
    );

    this.consumers.push(consumer);
    console.log('✅ Notification consumer started');
  }

  private async processNotification(notification: NotificationEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. Check if user exists and get preferences
      const userResult = await pool.query(
        'SELECT id, username, first_name, last_name, email, push_token, notification_preferences FROM users WHERE id = $1',
        [notification.userId]
      );

      if (userResult.rows.length === 0) {
        console.warn(`⚠️ User ${notification.userId} not found for notification`);
        return;
      }

      const user = userResult.rows[0];
      const preferences = user.notification_preferences || {};

      // 2. Check if user wants this type of notification
      if (!this.shouldSendNotification(notification.type, preferences)) {
        console.log(`📵 Notification skipped for user ${notification.userId} - disabled in preferences`);
        return;
      }

      // 3. Check rate limiting
      const rateLimitKey = `notification_rate_limit:${notification.userId}:${notification.type}`;
      const rateLimitCount = await redisClient.get(rateLimitKey);
      
      if (rateLimitCount && parseInt(rateLimitCount) >= this.getRateLimit(notification.type)) {
        console.log(`⏰ Rate limit exceeded for user ${notification.userId}, type ${notification.type}`);
        return;
      }

      // 4. Check if user is online for real-time delivery
      const isUserOnline = await redisClient.isUserOnline(notification.userId);
      const socketManager = SocketManager.getInstance();

      // 5. Send real-time notification if user is online
      if (isUserOnline) {
        socketManager.sendToUser(notification.userId, 'notification', {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          timestamp: notification.timestamp,
          isRealTime: true
        });
        console.log(`📱 Real-time notification sent to user ${notification.userId}`);
      }

      // 6. Save notification to database for persistence
      let notificationType: 'message_request' | 'room_ending_soon' | 'room_ended' | 'message_received';
      
      switch (notification.type) {
        case 'message':
          notificationType = 'message_received';
          break;
        case 'system':
          notificationType = 'room_ended';
          break;
        default:
          notificationType = 'message_received';
      }

      const dbNotification = await createNotification({
        user_id: notification.userId,
        type: notificationType,
        title: notification.title,
        message: notification.body,
        data: notification.data || {}
      });

      // 7. Send push notification if user is offline or prefers push
      if (!isUserOnline || preferences.push_enabled !== false) {
        if (user.push_token) {
          try {
            await sendPushNotification({
              token: user.push_token,
              title: notification.title,
              body: notification.body,
              data: {
                ...notification.data,
                notificationId: dbNotification.id,
                type: notification.type
              }
            });
            console.log(`🔔 Push notification sent to user ${notification.userId}`);
          } catch (pushError) {
            console.warn(`⚠️ Failed to send push notification to user ${notification.userId}:`, pushError);
          }
        } else {
          console.log(`📵 No push token for user ${notification.userId}`);
        }
      }

      // 8. Send email notification for important types
      if (this.shouldSendEmail(notification.type, preferences) && user.email) {
        try {
          await this.sendEmailNotification(user, notification);
          console.log(`📧 Email notification sent to user ${notification.userId}`);
        } catch (emailError) {
          console.warn(`⚠️ Failed to send email notification to user ${notification.userId}:`, emailError);
        }
      }

      // 9. Update rate limiting
      await this.updateRateLimit(notification.userId, notification.type);

      // 10. Analytics
      try {
        await kafkaService.sendAnalyticsEvent({
          userId: notification.userId,
          eventType: 'notification_sent',
          eventData: {
            notificationType: notification.type,
            deliveryMethods: {
              realTime: isUserOnline,
              push: !!user.push_token,
              email: this.shouldSendEmail(notification.type, preferences) && !!user.email
            },
            notificationId: dbNotification.id
          },
          timestamp: Date.now()
        });
      } catch (analyticsError) {
        console.warn('⚠️ Failed to send analytics event:', analyticsError);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Notification processed in ${processingTime}ms - User: ${notification.userId}, Type: ${notification.type}`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to process notification after ${processingTime}ms:`, error);
      throw error;
    }
  }

  private shouldSendNotification(type: string, preferences: any): boolean {
    // Default behavior: send all notifications unless explicitly disabled
    switch (type) {
      case 'message':
        return preferences.message_notifications !== false;
      case 'mention':
        return preferences.mention_notifications !== false;
      case 'system':
        return preferences.system_notifications !== false;
      case 'push':
        return preferences.push_enabled !== false;
      default:
        return true;
    }
  }

  private shouldSendEmail(type: string, preferences: any): boolean {
    // Only send emails for important notifications
    if (preferences.email_notifications === false) {
      return false;
    }

    switch (type) {
      case 'system':
      case 'security':
      case 'account':
        return true;
      case 'message':
        return preferences.email_for_messages === true;
      case 'mention':
        return preferences.email_for_mentions !== false;
      default:
        return false;
    }
  }

  private getRateLimit(type: string): number {
    // Rate limits per hour
    switch (type) {
      case 'message':
        return 100; // Max 100 message notifications per hour
      case 'mention':
        return 50;  // Max 50 mention notifications per hour
      case 'system':
        return 20;  // Max 20 system notifications per hour
      case 'push':
        return 200; // Max 200 push notifications per hour
      default:
        return 50;
    }
  }

  private async updateRateLimit(userId: number, type: string): Promise<void> {
    const rateLimitKey = `notification_rate_limit:${userId}:${type}`;
    const currentCount = await redisClient.get(rateLimitKey);
    
    if (currentCount) {
      await redisClient.set(rateLimitKey, (parseInt(currentCount) + 1).toString(), 3600);
    } else {
      await redisClient.set(rateLimitKey, '1', 3600); // 1 hour expiry
    }
  }

  private async sendEmailNotification(user: any, notification: NotificationEvent): Promise<void> {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll just log it
    console.log(`📧 Would send email to ${user.email}:`, {
      to: user.email,
      subject: notification.title,
      body: notification.body,
      type: notification.type,
      userId: user.id
    });

    // TODO: Implement actual email sending
    // Example with a hypothetical email service:
    /*
    await emailService.send({
      to: user.email,
      subject: notification.title,
      html: this.generateEmailTemplate(user, notification),
      text: notification.body
    });
    */
  }

  private generateEmailTemplate(user: any, notification: NotificationEvent): string {
    // Generate HTML email template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${notification.title}</title>
      </head>
      <body>
        <h2>Merhaba ${user.first_name}!</h2>
        <p>${notification.body}</p>
        <p>Tarih: ${new Date(notification.timestamp).toLocaleString('tr-TR')}</p>
        <hr>
        <p><small>Bu otomatik bir bildirimdir. Yanıtlamayınız.</small></p>
      </body>
      </html>
    `;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Notification Worker is not running');
      return;
    }

    try {
      // Disconnect all consumers
      for (const consumer of this.consumers) {
        await consumer.disconnect();
      }
      this.consumers = [];

      this.isRunning = false;
      console.log('✅ Notification Worker stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping Notification Worker:', error);
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

  // Utility methods for testing and monitoring
  public async getNotificationStats(userId: number): Promise<{
    rateLimits: { [key: string]: number };
    preferences: any;
    isOnline: boolean;
  }> {
    const user = await pool.query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [userId]
    );

    const rateLimits: { [key: string]: number } = {};
    const types = ['message', 'mention', 'system', 'push'];
    
    for (const type of types) {
      const rateLimitKey = `notification_rate_limit:${userId}:${type}`;
      const count = await redisClient.get(rateLimitKey);
      rateLimits[type] = count ? parseInt(count) : 0;
    }

    return {
      rateLimits,
      preferences: user.rows[0]?.notification_preferences || {},
      isOnline: await redisClient.isUserOnline(userId)
    };
  }
}

// Create singleton instance
const notificationWorker = new NotificationWorker();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down Notification Worker...');
  await notificationWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down Notification Worker...');
  await notificationWorker.stop();
  process.exit(0);
});

// Start the worker if this file is run directly
if (require.main === module) {
  notificationWorker.start().catch((error) => {
    console.error('❌ Failed to start Notification Worker:', error);
    process.exit(1);
  });
}

export default notificationWorker; 