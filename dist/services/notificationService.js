"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.deleteNotification = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getUserNotifications = exports.createNotificationSafe = exports.createNotification = void 0;
const database_1 = __importDefault(require("../config/database"));
const socket_1 = __importDefault(require("../config/socket"));
const createNotification = async (notificationData) => {
    try {
        const result = await database_1.default.query(`
      INSERT INTO notifications (user_id, type, title, message, data, is_read)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
            notificationData.user_id,
            notificationData.type,
            notificationData.title,
            notificationData.message,
            JSON.stringify(notificationData.data || {}),
            false
        ]);
        const notification = result.rows[0];
        // Real-time bildirim gönder (eğer kullanıcı online ise)
        try {
            const socketManager = socket_1.default.getInstance();
            await socketManager.sendToUser(notification.user_id, 'new_notification', notification);
        }
        catch (socketError) {
            console.warn('Could not send real-time notification:', socketError);
        }
        return notification;
    }
    catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};
exports.createNotification = createNotification;
// Güvenli notification oluşturma - ana akışı bozmaz
const createNotificationSafe = async (notificationData) => {
    try {
        return await (0, exports.createNotification)(notificationData);
    }
    catch (error) {
        console.error('Failed to create notification (non-critical):', {
            error: error instanceof Error ? error.message : String(error),
            notificationData: {
                user_id: notificationData.user_id,
                type: notificationData.type,
                title: notificationData.title
            }
        });
        return null;
    }
};
exports.createNotificationSafe = createNotificationSafe;
const getUserNotifications = async (userId, limit = 20, offset = 0) => {
    try {
        // Bildirimleri getir
        const notificationsResult = await database_1.default.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
        // Toplam sayı
        const countResult = await database_1.default.query(`
      SELECT COUNT(*) as total FROM notifications WHERE user_id = $1
    `, [userId]);
        // Okunmamış sayı
        const unreadResult = await database_1.default.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false
    `, [userId]);
        return {
            notifications: notificationsResult.rows,
            total: parseInt(countResult.rows[0].total),
            unread_count: parseInt(unreadResult.rows[0].unread)
        };
    }
    catch (error) {
        console.error('Error getting user notifications:', error);
        throw error;
    }
};
exports.getUserNotifications = getUserNotifications;
const markNotificationAsRead = async (notificationId, userId) => {
    try {
        const result = await database_1.default.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
const markAllNotificationsAsRead = async (userId) => {
    try {
        const result = await database_1.default.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `, [userId]);
        return result.rows.length;
    }
    catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const deleteNotification = async (notificationId, userId) => {
    try {
        const result = await database_1.default.query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
};
exports.deleteNotification = deleteNotification;
// Send push notification (mock implementation for now)
const sendPushNotification = async (notificationData) => {
    try {
        // TODO: Implement actual push notification service (FCM, APNS, etc.)
        console.log('📱 Push notification sent:', {
            token: notificationData.token.substring(0, 10) + '...',
            title: notificationData.title,
            body: notificationData.body,
            data: notificationData.data
        });
        // Simulate success
        return true;
    }
    catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
};
exports.sendPushNotification = sendPushNotification;
