import pool from '../config/database';
import { CreateNotificationRequest, Notification } from '../models/Notification';
import SocketManager from '../config/socket';

export const createNotification = async (notificationData: CreateNotificationRequest): Promise<Notification> => {
  try {
    const result = await pool.query(`
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
      const socketManager = SocketManager.getInstance();
      await socketManager.sendToUser(notification.user_id, 'new_notification', notification);
    } catch (socketError) {
      console.warn('Could not send real-time notification:', socketError);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Güvenli notification oluşturma - ana akışı bozmaz
export const createNotificationSafe = async (notificationData: CreateNotificationRequest): Promise<Notification | null> => {
  try {
    return await createNotification(notificationData);
  } catch (error) {
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

export const getUserNotifications = async (userId: number, limit: number = 20, offset: number = 0): Promise<{
  notifications: Notification[];
  total: number;
  unread_count: number;
}> => {
  try {
    // Bildirimleri getir
    const notificationsResult = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Toplam sayı
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM notifications WHERE user_id = $1
    `, [userId]);

    // Okunmamış sayı
    const unreadResult = await pool.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false
    `, [userId]);

    return {
      notifications: notificationsResult.rows,
      total: parseInt(countResult.rows[0].total),
      unread_count: parseInt(unreadResult.rows[0].unread)
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId: number, userId: number): Promise<boolean> => {
  try {
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: number): Promise<number> => {
  try {
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `, [userId]);

    return result.rows.length;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: number, userId: number): Promise<boolean> => {
  try {
    const result = await pool.query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// Push notification interface
export interface PushNotificationData {
  token: string;
  title: string;
  body: string;
  data?: any;
}

// Send push notification (mock implementation for now)
export const sendPushNotification = async (notificationData: PushNotificationData): Promise<boolean> => {
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
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}; 