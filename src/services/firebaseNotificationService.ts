import { messaging } from '../config/firebase';
import pool from '../config/database';
import { createNotification } from './notificationService';

interface FCMNotificationData {
  userId: number;
  title: string;
  body: string;
  data?: { [key: string]: string };
  type: 'message_request' | 'message_received' | 'request_accepted' | 'chat_ended';
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
}

interface FCMTokenInfo {
  token: string;
  device_type: string;
  device_info?: any;
}

export class FirebaseNotificationService {
  
  /**
   * Kullanıcının aktif FCM token'larını getir
   */
  private async getUserTokens(userId: number): Promise<FCMTokenInfo[]> {
    try {
      const result = await pool.query(`
        SELECT device_token as token, device_type, device_info 
        FROM device_tokens 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      return [];
    }
  }

  /**
   * FCM bildirimi gönder
   */
  async sendNotification(notificationData: FCMNotificationData): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
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
          priority: priority as any,
          notification: {
            sound: sound,
            channelId: 'chat_notifications', // Frontend'de tanımlanması gerekiyor
            priority: priority as any,
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
      if (!messaging) {
        console.warn('⚠️  Firebase messaging not initialized. Skipping notification.');
        return {
          success: false,
          successCount: 0,
          failureCount: tokens.length,
          errors: ['Firebase messaging not initialized']
        };
      }

      const response = await messaging.sendMulticast(message);
      
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
           .filter((r: any) => !r.success)
           .map((r: any) => r.error?.message || 'Unknown error')
      };

         } catch (error: any) {
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
  private async handleFailedTokens(tokens: FCMTokenInfo[], responses: any[]): Promise<void> {
    const tokensToDisable: string[] = [];
    
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
        await pool.query(`
          UPDATE device_tokens 
          SET is_active = false, updated_at = NOW() 
          WHERE device_token IN (${placeholders})
        `, tokensToDisable);
        
        console.log(`🗑️ Disabled ${tokensToDisable.length} invalid tokens`);
      } catch (error) {
        console.error('Error disabling invalid tokens:', error);
      }
    }
  }

  /**
   * Bildirim kaydını veritabanına kaydet
   */
  private async saveNotificationRecord(
    userId: number, 
    title: string, 
    body: string, 
    type: string, 
    data: any
  ): Promise<void> {
    try {
      await createNotification({
        user_id: userId,
        type: type as any,
        title,
        message: body,
        data
      });
    } catch (error) {
      console.error('Error saving notification record:', error);
    }
  }

  /**
   * Mesaj bildirimi gönder
   */
  async sendMessageNotification(
    receiverId: number, 
    senderId: number,
    senderName: string, 
    messageContent: string, 
    chatId: string
  ): Promise<void> {
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
  async sendMessageRequestNotification(
    receiverId: number, 
    senderName: string, 
    requestId: string
  ): Promise<void> {
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
  async sendRequestAcceptedNotification(
    senderId: number, 
    accepterName: string, 
    chatId: string
  ): Promise<void> {
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
  async sendChatEndedNotification(
    userId: number, 
    otherUserName: string
  ): Promise<void> {
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

// Singleton instance
export const firebaseNotificationService = new FirebaseNotificationService(); 