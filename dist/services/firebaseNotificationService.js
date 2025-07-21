"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseNotificationService = exports.FirebaseNotificationService = void 0;
const firebase_1 = require("../config/firebase");
const database_1 = __importDefault(require("../config/database"));
const notificationService_1 = require("./notificationService");
class FirebaseNotificationService {
    /**
     * Kullanıcının aktif FCM token'larını getir
     */
    async getUserTokens(userId) {
        try {
            const result = await database_1.default.query(`
        SELECT device_token as token, device_type, device_info 
        FROM device_tokens 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
            return result.rows;
        }
        catch (error) {
            console.error('Error fetching user tokens:', error);
            return [];
        }
    }
    /**
     * FCM bildirimi gönder
     */
    async sendNotification(notificationData) {
        const { userId, title, body, data = {}, type, priority = 'high', sound = 'default', badge } = notificationData;
        try {
            // Kullanıcının token'larını al
            const tokens = await this.getUserTokens(userId);
            if (tokens.length === 0) {
                console.log(`📵 No active tokens found for user ${userId}`);
                return { success: false, successCount: 0, failureCount: 0, errors: ['No active tokens'] };
            }
            // FCM mesaj payload'ı hazırla
            const message = {
                notification: {
                    title,
                    body,
                },
                data: {
                    type,
                    userId: userId.toString(),
                    timestamp: Date.now().toString(),
                    ...data,
                },
                android: {
                    priority: priority,
                    notification: {
                        sound: sound,
                        channelId: 'chat_notifications', // Frontend'de tanımlanması gerekiyor
                        priority: priority,
                        defaultSound: true,
                        defaultVibrateTimings: true,
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title,
                                body,
                            },
                            sound: sound,
                            badge: badge,
                            'mutable-content': 1,
                            category: type,
                        },
                    },
                },
                tokens: tokens.map(t => t.token),
            };
            // Batch olarak gönder
            if (!firebase_1.messaging) {
                console.warn('⚠️  Firebase messaging not initialized. Skipping notification.');
                return {
                    success: false,
                    successCount: 0,
                    failureCount: tokens.length,
                    errors: ['Firebase messaging not initialized']
                };
            }
            const response = await firebase_1.messaging.sendMulticast(message);
            console.log(`📱 FCM sent to user ${userId}: ${response.successCount}/${tokens.length} successful`);
            // Başarısız token'ları temizle
            if (response.failureCount > 0) {
                await this.handleFailedTokens(tokens, response.responses);
            }
            // Veritabanına notification kaydını ekle
            await this.saveNotificationRecord(userId, title, body, type, data);
            return {
                success: response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                errors: response.responses
                    .filter((r) => !r.success)
                    .map((r) => r.error?.message || 'Unknown error')
            };
        }
        catch (error) {
            console.error('FCM send error:', error);
            return {
                success: false,
                successCount: 0,
                failureCount: 1,
                errors: [error.message || 'FCM send failed']
            };
        }
    }
    /**
     * Başarısız token'ları işle (geçersiz olanları sil)
     */
    async handleFailedTokens(tokens, responses) {
        const tokensToDisable = [];
        responses.forEach((response, index) => {
            if (!response.success && response.error) {
                const errorCode = response.error.code;
                // Bu error kodları kalıcı hataları gösterir
                if ([
                    'messaging/invalid-registration-token',
                    'messaging/registration-token-not-registered',
                    'messaging/invalid-argument'
                ].includes(errorCode)) {
                    tokensToDisable.push(tokens[index].token);
                }
            }
        });
        // Geçersiz token'ları deaktif et
        if (tokensToDisable.length > 0) {
            try {
                const placeholders = tokensToDisable.map((_, i) => `$${i + 1}`).join(',');
                await database_1.default.query(`
          UPDATE device_tokens 
          SET is_active = false, updated_at = NOW() 
          WHERE device_token IN (${placeholders})
        `, tokensToDisable);
                console.log(`🗑️ Disabled ${tokensToDisable.length} invalid tokens`);
            }
            catch (error) {
                console.error('Error disabling invalid tokens:', error);
            }
        }
    }
    /**
     * Bildirim kaydını veritabanına kaydet
     */
    async saveNotificationRecord(userId, title, body, type, data) {
        try {
            await (0, notificationService_1.createNotification)({
                user_id: userId,
                type: type,
                title,
                message: body,
                data
            });
        }
        catch (error) {
            console.error('Error saving notification record:', error);
        }
    }
    /**
     * Mesaj bildirimi gönder
     */
    async sendMessageNotification(receiverId, senderId, senderName, messageContent, chatId) {
        await this.sendNotification({
            userId: receiverId,
            title: senderName,
            body: messageContent,
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
    /**
     * Mesaj isteği bildirimi gönder
     */
    async sendMessageRequestNotification(receiverId, senderName, requestId) {
        await this.sendNotification({
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
    /**
     * Mesaj isteği kabul edildi bildirimi
     */
    async sendRequestAcceptedNotification(senderId, accepterName, chatId) {
        await this.sendNotification({
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
    /**
     * Chat sonlandırma bildirimi
     */
    async sendChatEndedNotification(userId, otherUserName) {
        await this.sendNotification({
            userId,
            title: 'Sohbet Sonlandı',
            body: `${otherUserName} ile olan sohbetiniz sonlandı`,
            type: 'chat_ended',
            data: {
                otherUserName,
            },
            priority: 'normal'
        });
    }
}
exports.FirebaseNotificationService = FirebaseNotificationService;
// Singleton instance
exports.firebaseNotificationService = new FirebaseNotificationService();
