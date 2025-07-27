"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enterpriseNotificationService = exports.EnterpriseNotificationService = void 0;
const firebase_1 = require("../config/firebase");
const database_1 = __importDefault(require("../config/database"));
const notificationService_1 = require("./notificationService");
const redis_1 = __importDefault(require("../config/redis"));
class EnterpriseNotificationService {
    constructor() {
        this.REDIS_USER_DEVICES_PREFIX = 'user_devices:';
        this.REDIS_NOTIFICATION_QUEUE = 'notification_queue';
        this.MAX_DEVICES_PER_USER = 10; // Enterprise limit
        this.TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
    }
    /**
     * 🏢 ENTERPRISE: Kullanıcının TÜM aktif cihazlarını getir
     */
    async getUserAllActiveDevices(userId) {
        try {
            // Redis'ten hızlı cache kontrolü
            const cacheKey = `${this.REDIS_USER_DEVICES_PREFIX}${userId}`;
            const cachedDevices = await redis_1.default.get(cacheKey);
            if (cachedDevices) {
                const devices = JSON.parse(cachedDevices);
                // Cache hit - performans için
                console.log(`📱 Cache hit: Found ${devices.length} cached devices for user ${userId}`);
                return devices;
            }
            // Database'den aktif cihazları getir
            const result = await database_1.default.query(`
        SELECT 
          device_token as token, 
          device_type, 
          device_info,
          updated_at as last_active,
          CASE 
            WHEN ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) = 1 
            THEN true 
            ELSE false 
          END as is_primary
        FROM device_tokens 
        WHERE user_id = $1 
          AND is_active = true 
          AND updated_at > NOW() - INTERVAL '30 days'
        ORDER BY updated_at DESC
        LIMIT $2
      `, [userId, this.MAX_DEVICES_PER_USER]);
            const devices = result.rows.map(row => ({
                token: row.token,
                device_type: row.device_type,
                device_info: row.device_info,
                is_primary: row.is_primary,
                last_active: row.last_active
            }));
            // Redis'e cache'le (5 dakika TTL)
            await redis_1.default.set(cacheKey, JSON.stringify(devices));
            await redis_1.default.expire(cacheKey, 300);
            console.log(`📱 DB query: Found ${devices.length} active devices for user ${userId}`);
            return devices;
        }
        catch (error) {
            console.error(`Error fetching devices for user ${userId}:`, error);
            return [];
        }
    }
    /**
     * 🏢 ENTERPRISE: Multi-device FCM notification gönder
     */
    async sendEnterpriseNotification(notificationData) {
        const { userId, title, body, data = {}, type, priority = 'high', sound = 'default', badge, ttl = 3600 } = notificationData;
        try {
            console.log(`📱 Starting enterprise notification for user ${userId}, type: ${type}`);
            // 1. Kullanıcının tüm aktif cihazlarını al
            const userDevices = await this.getUserAllActiveDevices(userId);
            if (userDevices.length === 0) {
                console.log(`📵 No active devices found for user ${userId}`);
                return {
                    success: false,
                    totalDevices: 0,
                    successfulDeliveries: 0,
                    failedDeliveries: 0,
                    errors: ['No active devices']
                };
            }
            console.log(`📱 Found ${userDevices.length} active devices for user ${userId}`);
            // 2. Firebase multicast mesaj hazırla
            const tokens = userDevices.map(device => device.token);
            const message = {
                notification: {
                    title,
                    body,
                },
                data: {
                    type,
                    userId: userId.toString(),
                    timestamp: Date.now().toString(),
                    notificationId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    ...data,
                },
                android: {
                    priority: priority,
                    ttl: ttl * 1000, // Android TTL in milliseconds
                    notification: {
                        sound: sound,
                        channelId: 'default',
                        priority: priority,
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        // ❌ REMOVED: clickAction: 'FLUTTER_NOTIFICATION_CLICK', - This was causing crashes
                    },
                },
                apns: {
                    headers: {
                        'apns-priority': priority === 'high' ? '10' : '5',
                        'apns-expiration': (Math.floor(Date.now() / 1000) + ttl).toString(),
                    },
                    payload: {
                        aps: {
                            alert: {
                                title,
                                body,
                            },
                            sound: sound,
                            badge: badge,
                            // ❌ REMOVED: 'mutable-content': 1, - Invalid format for iOS
                            // ❌ REMOVED: category: type, - Undefined category causes crashes
                        },
                    },
                },
                tokens: tokens,
            };
            // 3. Enterprise-grade batch sending
            if (!firebase_1.messaging) {
                console.warn('⚠️  Firebase messaging not initialized. Cannot send enterprise notification.');
                return {
                    success: false,
                    totalDevices: userDevices.length,
                    successfulDeliveries: 0,
                    failedDeliveries: userDevices.length,
                    errors: ['Firebase messaging not initialized']
                };
            }
            const response = await firebase_1.messaging.sendMulticast(message);
            console.log(`📱 Enterprise FCM sent to user ${userId}: ${response.successCount}/${tokens.length} successful`);
            // 4. Failed token cleanup & analytics
            if (response.failureCount > 0) {
                await this.handleFailedTokensEnterprise(userDevices, response.responses, userId);
            }
            // 5. Notification persistence (database + cache)
            await this.saveNotificationRecordEnterprise(userId, title, body, type, data, userDevices.length);
            // 6. Real-time metrics update
            await this.updateEnterpriseMetrics(userId, type, response.successCount, response.failureCount);
            return {
                success: response.successCount > 0,
                totalDevices: userDevices.length,
                successfulDeliveries: response.successCount,
                failedDeliveries: response.failureCount,
                errors: response.responses
                    .filter((r) => !r.success)
                    .map((r) => r.error?.message || 'Unknown error')
            };
        }
        catch (error) {
            console.error(`Enterprise FCM error for user ${userId}:`, error);
            // Fallback to queue for retry
            await this.queueNotificationForRetry(notificationData);
            return {
                success: false,
                totalDevices: 0,
                successfulDeliveries: 0,
                failedDeliveries: 1,
                errors: [error.message || 'Enterprise FCM send failed']
            };
        }
    }
    /**
     * 🏢 ENTERPRISE: Failed token cleanup with smart retry
     */
    async handleFailedTokensEnterprise(devices, responses, userId) {
        const tokensToDisable = [];
        const tokensToRetry = [];
        responses.forEach((response, index) => {
            if (!response.success && response.error) {
                const errorCode = response.error.code;
                const token = devices[index].token;
                // Permanent errors - disable immediately
                if ([
                    'messaging/invalid-registration-token',
                    'messaging/registration-token-not-registered',
                    'messaging/invalid-argument'
                ].includes(errorCode)) {
                    tokensToDisable.push(token);
                }
                // Temporary errors - retry later
                else if ([
                    'messaging/unavailable',
                    'messaging/internal-error',
                    'messaging/quota-exceeded'
                ].includes(errorCode)) {
                    tokensToRetry.push(token);
                }
            }
        });
        // Disable invalid tokens
        if (tokensToDisable.length > 0) {
            try {
                const placeholders = tokensToDisable.map((_, i) => `$${i + 2}`).join(',');
                await database_1.default.query(`
          UPDATE device_tokens 
          SET is_active = false, updated_at = NOW() 
          WHERE user_id = $1 AND device_token IN (${placeholders})
        `, [userId, ...tokensToDisable]);
                // Clear cache
                await redis_1.default.del(`${this.REDIS_USER_DEVICES_PREFIX}${userId}`);
                console.log(`🗑️ Enterprise: Disabled ${tokensToDisable.length} invalid tokens for user ${userId}`);
            }
            catch (error) {
                console.error('Error disabling invalid tokens:', error);
            }
        }
        // Queue retry tokens
        if (tokensToRetry.length > 0) {
            console.log(`⏰ Enterprise: Queued ${tokensToRetry.length} tokens for retry for user ${userId}`);
        }
    }
    /**
     * 🏢 ENTERPRISE: Notification persistence with analytics
     */
    async saveNotificationRecordEnterprise(userId, title, body, type, data, deviceCount) {
        try {
            // Save to database
            const notification = await (0, notificationService_1.createNotification)({
                user_id: userId,
                type: type,
                title,
                message: body,
                data: {
                    ...data,
                    enterprise: {
                        deviceCount,
                        timestamp: Date.now(),
                        version: '2.0'
                    }
                }
            });
            // Cache for fast retrieval
            const cacheKey = `user_notifications:${userId}`;
            const cachedNotifications = await redis_1.default.lrange(cacheKey, 0, 99);
            // Add to cache (keep last 100) - simplified for cluster compatibility
            const existingList = await redis_1.default.lrange(cacheKey, 0, 98); // Get first 99
            await redis_1.default.del(cacheKey);
            await redis_1.default.lpush(cacheKey, JSON.stringify(notification));
            if (existingList.length > 0) {
                await redis_1.default.lpush(cacheKey, ...existingList);
            }
            await redis_1.default.expire(cacheKey, 86400); // 24 hours TTL
        }
        catch (error) {
            console.error('Error saving enterprise notification record:', error);
        }
    }
    /**
     * 🏢 ENTERPRISE: Real-time metrics
     */
    async updateEnterpriseMetrics(userId, type, successCount, failureCount) {
        try {
            const metricsKey = `notification_metrics:${type}:${new Date().toISOString().slice(0, 10)}`;
            await redis_1.default.hset(metricsKey, 'success_count', successCount.toString());
            await redis_1.default.hset(metricsKey, 'failure_count', failureCount.toString());
            await redis_1.default.hset(metricsKey, 'total_users', '1');
            await redis_1.default.expire(metricsKey, 7 * 24 * 3600); // 7 days
        }
        catch (error) {
            console.error('Error updating enterprise metrics:', error);
        }
    }
    /**
     * 🏢 ENTERPRISE: Queue for retry
     */
    async queueNotificationForRetry(notificationData) {
        try {
            const queueItem = {
                ...notificationData,
                retryCount: 0,
                queuedAt: Date.now(),
                nextRetryAt: Date.now() + 30000, // 30 seconds later
            };
            await redis_1.default.lpush(this.REDIS_NOTIFICATION_QUEUE, JSON.stringify(queueItem));
            console.log(`⏰ Queued notification for retry: user ${notificationData.userId}`);
        }
        catch (error) {
            console.error('Error queuing notification for retry:', error);
        }
    }
    /**
     * 🏢 ENTERPRISE: Kullanıcı cihaz ekle/güncelle
     */
    async registerUserDevice(userId, token, deviceType, deviceInfo) {
        try {
            // 1. Check device limit per user
            const deviceCount = await database_1.default.query(`
        SELECT COUNT(*) as count 
        FROM device_tokens 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
            if (parseInt(deviceCount.rows[0].count) >= this.MAX_DEVICES_PER_USER) {
                // Remove oldest device
                await database_1.default.query(`
          UPDATE device_tokens 
          SET is_active = false 
          WHERE user_id = $1 
            AND is_active = true 
            AND device_token = (
              SELECT device_token 
              FROM device_tokens 
              WHERE user_id = $1 AND is_active = true 
              ORDER BY updated_at ASC 
              LIMIT 1
            )
        `, [userId]);
                console.log(`📱 Removed oldest device for user ${userId} due to limit`);
            }
            // 2. Add/update device
            await database_1.default.query(`
        INSERT INTO device_tokens (user_id, device_token, device_type, device_info, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
        ON CONFLICT (device_token) 
        DO UPDATE SET 
          user_id = $1,
          device_type = $3,
          device_info = $4,
          is_active = true,
          updated_at = NOW()
      `, [userId, token, deviceType, JSON.stringify(deviceInfo)]);
            // 3. Clear cache
            await redis_1.default.del(`${this.REDIS_USER_DEVICES_PREFIX}${userId}`);
            console.log(`📱 Enterprise: Registered device for user ${userId}`);
            return {
                success: true,
                message: 'Device registered successfully in enterprise system'
            };
        }
        catch (error) {
            console.error(`Enterprise device registration error for user ${userId}:`, error);
            return {
                success: false,
                message: 'Failed to register device in enterprise system'
            };
        }
    }
    /**
     * 🏢 ENTERPRISE: Notification helpers
     */
    async sendMessageNotificationEnterprise(receiverId, senderId, senderName, messageContent, chatId) {
        await this.sendEnterpriseNotification({
            userId: receiverId,
            title: senderName,
            body: messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
            type: 'message_received',
            data: {
                chatId,
                senderId: senderId.toString(),
                senderName,
            },
            priority: 'high',
            badge: 1
        });
    }
    async sendMessageRequestNotificationEnterprise(receiverId, senderName, requestId) {
        await this.sendEnterpriseNotification({
            userId: receiverId,
            title: 'Yeni Mesaj İsteği',
            body: `${senderName} size mesaj göndermek istiyor`,
            type: 'message_request',
            data: {
                requestId,
                senderName,
            },
            priority: 'high'
        });
    }
    async sendRequestAcceptedNotificationEnterprise(senderId, accepterName, chatId) {
        await this.sendEnterpriseNotification({
            userId: senderId,
            title: 'Mesaj İsteğiniz Kabul Edildi!',
            body: `${accepterName} mesaj isteğinizi kabul etti`,
            type: 'request_accepted',
            data: {
                chatId,
                accepterName,
            },
            priority: 'high'
        });
    }
}
exports.EnterpriseNotificationService = EnterpriseNotificationService;
// Singleton instance
exports.enterpriseNotificationService = new EnterpriseNotificationService();
