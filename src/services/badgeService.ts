import redisClient from '../config/redis';
import SocketManager from '../config/socket';

class BadgeService {
  private static instance: BadgeService;

  public static getInstance(): BadgeService {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }
    return BadgeService.instance;
  }

  // Kullanıcının belirli bir room için badge sayısını getir
  async getRoomBadgeCount(userId: number, roomId: string): Promise<number> {
    try {
      const key = `badge:user:${userId}:room:${roomId}`;
      const count = await redisClient.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Error getting room badge count:', error);
      return 0;
    }
  }

  // Kullanıcının tüm room'ları için badge sayılarını getir
  async getAllBadgeCounts(userId: number): Promise<{ [roomId: string]: number }> {
    try {
      // Redis cluster'da keys komutu yavaş olduğu için farklı yaklaşım
      // Kullanıcının room'larını badge:users:{userId}:rooms set'inde tutacağız
      const roomsKey = `badge:users:${userId}:rooms`;
      const cluster = redisClient.getCluster();
      const badges: { [roomId: string]: number } = {};

      if (cluster && !redisClient.isUsingInMemory()) {
        // Redis cluster kullanılıyorsa
        const roomIds = await cluster.smembers(roomsKey);
        for (const roomId of roomIds) {
          const badgeKey = `badge:user:${userId}:room:${roomId}`;
          const count = await redisClient.get(badgeKey);
          badges[roomId] = count ? parseInt(count) : 0;
        }
      } else {
        // In-memory cache kullanılıyorsa tüm keyleri iterate et
        const pattern = `badge:user:${userId}:room:`;
        // Basit pattern matching için in-memory cache'i kontrol et
        // Bu durumda performans sorun olmaz
        badges; // Şimdilik boş döndür, gerekirse sonra implement ederim
      }

      return badges;
    } catch (error) {
      console.error('Error getting all badge counts:', error);
      return {};
    }
  }

  // Badge sayısını artır
  async incrementBadgeCount(userId: number, roomId: string): Promise<number> {
    try {
      const key = `badge:user:${userId}:room:${roomId}`;
      const cluster = redisClient.getCluster();
      let newCount = 1;
      
      if (cluster && !redisClient.isUsingInMemory()) {
        newCount = await cluster.incr(key);
      } else {
        const currentCount = await redisClient.get(key);
        newCount = currentCount ? parseInt(currentCount) + 1 : 1;
        await redisClient.set(key, newCount.toString());
      }
      
      // 7 gün süre ver
      await redisClient.expire(key, 7 * 24 * 60 * 60);
      
      // Room'u kullanıcının rooms set'ine ekle
      const roomsKey = `badge:users:${userId}:rooms`;
      if (cluster && !redisClient.isUsingInMemory()) {
        await cluster.sadd(roomsKey, roomId);
        await cluster.expire(roomsKey, 7 * 24 * 60 * 60);
      } else {
        await redisClient.sadd(roomsKey, roomId);
        await redisClient.expire(roomsKey, 7 * 24 * 60 * 60);
      }
      
      // Real-time güncelleme gönder
      this.notifyBadgeUpdate(userId, roomId, newCount);
      
      console.log(`📈 Badge incremented for user ${userId} in room ${roomId}: ${newCount}`);
      return newCount;
    } catch (error) {
      console.error('Error incrementing badge count:', error);
      return 0;
    }
  }

  // Badge sayısını sıfırla
  async resetBadgeCount(userId: number, roomId: string): Promise<void> {
    try {
      const key = `badge:user:${userId}:room:${roomId}`;
      await redisClient.del(key);
      
      // Real-time güncelleme gönder
      this.notifyBadgeUpdate(userId, roomId, 0);
      
      console.log(`🔄 Badge reset for user ${userId} in room ${roomId}`);
    } catch (error) {
      console.error('Error resetting badge count:', error);
    }
  }

  // Kullanıcının tüm badge'lerini sıfırla
  async resetAllBadges(userId: number): Promise<void> {
    try {
      const roomsKey = `badge:users:${userId}:rooms`;
      const cluster = redisClient.getCluster();
      
      if (cluster && !redisClient.isUsingInMemory()) {
        const roomIds = await cluster.smembers(roomsKey);
        
        // Her room için badge'i sıfırla
        for (const roomId of roomIds) {
          const badgeKey = `badge:user:${userId}:room:${roomId}`;
          await redisClient.del(badgeKey);
          this.notifyBadgeUpdate(userId, roomId, 0);
        }
        
        // Rooms set'ini temizle
        await redisClient.del(roomsKey);
      } else {
        // In-memory cache için basit temizlik
        await redisClient.del(roomsKey);
      }
      
      console.log(`🧹 All badges reset for user ${userId}`);
    } catch (error) {
      console.error('Error resetting all badges:', error);
    }
  }

  // Real-time badge güncelleme bildirimi gönder
  private notifyBadgeUpdate(userId: number, roomId: string, count: number): void {
    try {
      const socketManager = SocketManager.getInstance();
      socketManager.sendToUser(userId, 'badge_updated', {
        roomId,
        count,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error sending badge update notification:', error);
    }
  }

  // Badge sayısını manuel olarak ayarla
  async setBadgeCount(userId: number, roomId: string, count: number): Promise<void> {
    try {
      const key = `badge:user:${userId}:room:${roomId}`;
      
      if (count <= 0) {
        await redisClient.del(key);
      } else {
        await redisClient.set(key, count.toString());
        await redisClient.expire(key, 7 * 24 * 60 * 60);
      }
      
      // Real-time güncelleme gönder
      this.notifyBadgeUpdate(userId, roomId, Math.max(0, count));
      
      console.log(`🎯 Badge set for user ${userId} in room ${roomId}: ${count}`);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  // Kullanıcının toplam badge sayısını getir
  async getTotalBadgeCount(userId: number): Promise<number> {
    try {
      const badges = await this.getAllBadgeCounts(userId);
      return Object.values(badges).reduce((total, count) => total + count, 0);
    } catch (error) {
      console.error('Error getting total badge count:', error);
      return 0;
    }
  }
}

export default BadgeService; 