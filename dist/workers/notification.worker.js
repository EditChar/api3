"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kafkaService_1 = __importDefault(require("../services/kafkaService"));
const notificationService_1 = require("../services/notificationService");
const redis_1 = __importDefault(require("../config/redis"));
const socket_1 = __importDefault(require("../config/socket"));
const database_1 = __importDefault(require("../config/database"));
class NotificationWorker {
    constructor() {
        this.isRunning = false;
        this.consumers = [];
        console.log('🚀 Notification Worker initializing...');
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Notification Worker is already running');
            return;
        }
        try {
            // Connect Kafka producer
            await kafkaService_1.default.connectProducer();
            // Start notification consumer
            await this.startNotificationConsumer();
            this.isRunning = true;
            console.log('✅ Notification Worker started successfully');
        }
        catch (error) {
            console.error('❌ Failed to start Notification Worker:', error);
            throw error;
        }
    }
    async startNotificationConsumer() {
        const consumer = kafkaService_1.default.createNotificationConsumer('notification-processor', async (notification) => {
            try {
                await this.processNotification(notification);
            }
            catch (error) {
                console.error('❌ Error processing notification in worker:', error);
                throw error; // This will trigger retry mechanism
            }
        });
        this.consumers.push(consumer);
        console.log('✅ Notification consumer started');
    }
    async processNotification(notification) {
        const startTime = Date.now();
        try {
            // 1. Check if user exists and get preferences
            const userResult = await database_1.default.query('SELECT id, username, first_name, last_name, email, push_token, notification_preferences FROM users WHERE id = $1', [notification.userId]);
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
            const rateLimitCount = await redis_1.default.get(rateLimitKey);
            if (rateLimitCount && parseInt(rateLimitCount) >= this.getRateLimit(notification.type)) {
                console.log(`⏰ Rate limit exceeded for user ${notification.userId}, type ${notification.type}`);
                return;
            }
            // 4. Check if user is online for real-time delivery
            const isUserOnline = await redis_1.default.isUserOnline(notification.userId);
            const socketManager = socket_1.default.getInstance();
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
            let notificationType;
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
            const dbNotification = await (0, notificationService_1.createNotification)({
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
                        await (0, notificationService_1.sendPushNotification)({
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
                    }
                    catch (pushError) {
                        console.warn(`⚠️ Failed to send push notification to user ${notification.userId}:`, pushError);
                    }
                }
                else {
                    console.log(`📵 No push token for user ${notification.userId}`);
                }
            }
            // 8. Send email notification for important types
            if (this.shouldSendEmail(notification.type, preferences) && user.email) {
                try {
                    await this.sendEmailNotification(user, notification);
                    console.log(`📧 Email notification sent to user ${notification.userId}`);
                }
                catch (emailError) {
                    console.warn(`⚠️ Failed to send email notification to user ${notification.userId}:`, emailError);
                }
            }
            // 9. Update rate limiting
            await this.updateRateLimit(notification.userId, notification.type);
            // 10. Analytics
            try {
                await kafkaService_1.default.sendAnalyticsEvent({
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
            }
            catch (analyticsError) {
                console.warn('⚠️ Failed to send analytics event:', analyticsError);
            }
            const processingTime = Date.now() - startTime;
            console.log(`✅ Notification processed in ${processingTime}ms - User: ${notification.userId}, Type: ${notification.type}`);
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Failed to process notification after ${processingTime}ms:`, error);
            throw error;
        }
    }
    shouldSendNotification(type, preferences) {
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
    shouldSendEmail(type, preferences) {
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
    getRateLimit(type) {
        // Rate limits per hour
        switch (type) {
            case 'message':
                return 100; // Max 100 message notifications per hour
            case 'mention':
                return 50; // Max 50 mention notifications per hour
            case 'system':
                return 20; // Max 20 system notifications per hour
            case 'push':
                return 200; // Max 200 push notifications per hour
            default:
                return 50;
        }
    }
    async updateRateLimit(userId, type) {
        const rateLimitKey = `notification_rate_limit:${userId}:${type}`;
        const currentCount = await redis_1.default.get(rateLimitKey);
        if (currentCount) {
            await redis_1.default.set(rateLimitKey, (parseInt(currentCount) + 1).toString(), 3600);
        }
        else {
            await redis_1.default.set(rateLimitKey, '1', 3600); // 1 hour expiry
        }
    }
    async sendEmailNotification(user, notification) {
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
    generateEmailTemplate(user, notification) {
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
    async stop() {
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
        }
        catch (error) {
            console.error('❌ Error stopping Notification Worker:', error);
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
            kafka: await kafkaService_1.default.healthCheck()
        };
    }
    // Utility methods for testing and monitoring
    async getNotificationStats(userId) {
        const user = await database_1.default.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
        const rateLimits = {};
        const types = ['message', 'mention', 'system', 'push'];
        for (const type of types) {
            const rateLimitKey = `notification_rate_limit:${userId}:${type}`;
            const count = await redis_1.default.get(rateLimitKey);
            rateLimits[type] = count ? parseInt(count) : 0;
        }
        return {
            rateLimits,
            preferences: user.rows[0]?.notification_preferences || {},
            isOnline: await redis_1.default.isUserOnline(userId)
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
exports.default = notificationWorker;
