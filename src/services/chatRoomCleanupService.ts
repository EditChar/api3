import cron from 'node-cron';
import pool from '../config/database';
import redisClient from '../config/redis';
import { createNotification } from './notificationService';

class ChatRoomCleanupService {
  private static instance: ChatRoomCleanupService;

  private constructor() {
    this.startCleanupJob();
  }

  public static getInstance(): ChatRoomCleanupService {
    if (!ChatRoomCleanupService.instance) {
      ChatRoomCleanupService.instance = new ChatRoomCleanupService();
    }
    return ChatRoomCleanupService.instance;
  }

  private startCleanupJob() {
    // Her gün saat 03:00'da çalış
    cron.schedule('0 3 * * *', async () => {
      console.log('🧹 Starting chat room cleanup job...');
      await this.cleanupExpiredRooms();
    });

    // Her 6 saatte bir 24 saat kala uyarı gönder
    cron.schedule('0 */6 * * *', async () => {
      console.log('⚠️ Checking rooms ending soon...');
      await this.notifyRoomsEndingSoon();
    });

    console.log('⏰ Chat room cleanup cron jobs scheduled');
  }

  private async cleanupExpiredRooms(): Promise<void> {
    try {
      // Süresi dolan odaları bul
      const expiredRoomsResult = await pool.query(`
        SELECT cr.*, 
               u1.first_name as user1_name, u1.username as user1_username,
               u2.first_name as user2_name, u2.username as user2_username
        FROM chats cr
        JOIN users u1 ON cr.user1_id = u1.id
        JOIN users u2 ON cr.user2_id = u2.id
        WHERE cr.expires_at <= NOW() AND cr.status = 'active'
      `);

      const expiredRooms = expiredRoomsResult.rows;

      for (const room of expiredRooms) {
        // Room'u expired olarak işaretle
        await pool.query(
          'UPDATE chats SET status = $1 WHERE id = $2',
          ['expired', room.id]
        );

        // Redis'teki mesajları temizle
        await redisClient.deleteRoomMessages(room.id);

        // Kullanıcılara bildirim gönder
        await createNotification({
          user_id: room.user1_id,
          type: 'room_ended',
          title: 'Mesajlaşma Odası Sona Erdi',
          message: `${room.user2_name} ile olan mesajlaşma odanız 7 günlük süre dolduğu için sona erdi.`,
          data: {
            room_id: room.id,
            other_user_id: room.user2_id,
            other_user_name: room.user2_name
          }
        });

        await createNotification({
          user_id: room.user2_id,
          type: 'room_ended',
          title: 'Mesajlaşma Odası Sona Erdi',
          message: `${room.user1_name} ile olan mesajlaşma odanız 7 günlük süre dolduğu için sona erdi.`,
          data: {
            room_id: room.id,
            other_user_id: room.user1_id,
            other_user_name: room.user1_name
          }
        });

        console.log(`🗑️ Room ${room.id} expired and cleaned up`);
      }

      console.log(`✅ Cleanup completed. Processed ${expiredRooms.length} expired rooms`);
    } catch (error) {
      console.error('❌ Error during room cleanup:', error);
    }
  }

  private async notifyRoomsEndingSoon(): Promise<void> {
    try {
      // 24 saat içinde süresi dolacak odaları bul
      const soonToExpireResult = await pool.query(`
        SELECT cr.*, 
               u1.first_name as user1_name, u1.username as user1_username,
               u2.first_name as user2_name, u2.username as user2_username,
               EXTRACT(HOURS FROM (cr.expires_at - NOW())) as hours_remaining
        FROM chats cr
        JOIN users u1 ON cr.user1_id = u1.id
        JOIN users u2 ON cr.user2_id = u2.id
        WHERE cr.expires_at <= NOW() + INTERVAL '24 hours' 
          AND cr.expires_at > NOW()
          AND cr.status = 'active'
      `);

      const soonToExpireRooms = soonToExpireResult.rows;

      for (const room of soonToExpireRooms) {
        const hoursRemaining = Math.floor(room.hours_remaining);
        
        // Son 24 saatte sadece bir bildirim gönder
        const lastNotificationResult = await pool.query(`
          SELECT id FROM notifications 
          WHERE user_id = $1 AND type = 'room_ending_soon' 
            AND data->>'room_id' = $2
            AND created_at > NOW() - INTERVAL '24 hours'
        `, [room.user1_id, room.id.toString()]);

        if (lastNotificationResult.rows.length === 0) {
          // User 1'e bildirim gönder
          await createNotification({
            user_id: room.user1_id,
            type: 'room_ending_soon',
            title: 'Mesajlaşma Odası Bitiyor',
            message: `${room.user2_name} ile olan mesajlaşma odanız ${hoursRemaining} saat içinde sona erecek.`,
            data: {
              room_id: room.id,
              other_user_id: room.user2_id,
              other_user_name: room.user2_name,
              hours_remaining: hoursRemaining
            }
          });

          // User 2'ye bildirim gönder
          await createNotification({
            user_id: room.user2_id,
            type: 'room_ending_soon',
            title: 'Mesajlaşma Odası Bitiyor',
            message: `${room.user1_name} ile olan mesajlaşma odanız ${hoursRemaining} saat içinde sona erecek.`,
            data: {
              room_id: room.id,
              other_user_id: room.user1_id,
              other_user_name: room.user1_name,
              hours_remaining: hoursRemaining
            }
          });

          console.log(`⏰ Notified users about room ${room.id} ending in ${hoursRemaining} hours`);
        }
      }

      console.log(`✅ Ending soon notifications completed. Processed ${soonToExpireRooms.length} rooms`);
    } catch (error) {
      console.error('❌ Error during ending soon notifications:', error);
    }
  }

  // Manuel olarak cleanup çalıştırmak için
  public async forceCleanup(): Promise<void> {
    await this.cleanupExpiredRooms();
  }
}

export default ChatRoomCleanupService; 