"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = __importDefault(require("../config/redis"));
const socket_1 = __importDefault(require("../config/socket"));
class BadgeService {
    static getInstance() {
        if (!BadgeService.instance) {
            BadgeService.instance = new BadgeService();
        }
        return BadgeService.instance;
    }
    // Kullanıcının belirli bir room için badge sayısını getir
    async getRoomBadgeCount(userId, roomId) {
        try {
            const key = `badge:user:${userId}:room:${roomId}`;
            const count = await redis_1.default.get(key);
            return count ? parseInt(count) : 0;
        }
        catch (error) {
            console.error('Error getting room badge count:', error);
            return 0;
        }
    }
    // Kullanıcının tüm room'ları için badge sayılarını getir
    async getAllBadgeCounts(userId) {
        try {
            // Redis cluster'da keys komutu yavaş olduğu için farklı yaklaşım
            // Kullanıcının room'larını badge:users:{userId}:rooms set'inde tutacağız
            const roomsKey = `badge:users:${userId}:rooms`;
            const cluster = redis_1.default.getCluster();
            const badges = {};
            if (cluster && !redis_1.default.isUsingInMemory()) {
                // Redis cluster kullanılıyorsa
                const roomIds = await cluster.smembers(roomsKey);
                for (const roomId of roomIds) {
                    const badgeKey = `badge:user:${userId}:room:${roomId}`;
                    const count = await redis_1.default.get(badgeKey);
                    badges[roomId] = count ? parseInt(count) : 0;
                }
            }
            else {
                // In-memory cache kullanılıyorsa tüm keyleri iterate et
                const pattern = `badge:user:${userId}:room:`;
                // Basit pattern matching için in-memory cache'i kontrol et
                // Bu durumda performans sorun olmaz
                badges; // Şimdilik boş döndür, gerekirse sonra implement ederim
            }
            return badges;
        }
        catch (error) {
            console.error('Error getting all badge counts:', error);
            return {};
        }
    }
    // Badge sayısını artır
    async incrementBadgeCount(userId, roomId) {
        try {
            const key = `badge:user:${userId}:room:${roomId}`;
            const cluster = redis_1.default.getCluster();
            let newCount = 1;
            if (cluster && !redis_1.default.isUsingInMemory()) {
                newCount = await cluster.incr(key);
            }
            else {
                const currentCount = await redis_1.default.get(key);
                newCount = currentCount ? parseInt(currentCount) + 1 : 1;
                await redis_1.default.set(key, newCount.toString());
            }
            // 7 gün süre ver
            await redis_1.default.expire(key, 7 * 24 * 60 * 60);
            // Room'u kullanıcının rooms set'ine ekle
            const roomsKey = `badge:users:${userId}:rooms`;
            if (cluster && !redis_1.default.isUsingInMemory()) {
                await cluster.sadd(roomsKey, roomId);
                await cluster.expire(roomsKey, 7 * 24 * 60 * 60);
            }
            else {
                await redis_1.default.sadd(roomsKey, roomId);
                await redis_1.default.expire(roomsKey, 7 * 24 * 60 * 60);
            }
            // Real-time güncelleme gönder
            this.notifyBadgeUpdate(userId, roomId, newCount);
            console.log(`📈 Badge incremented for user ${userId} in room ${roomId}: ${newCount}`);
            return newCount;
        }
        catch (error) {
            console.error('Error incrementing badge count:', error);
            return 0;
        }
    }
    // Badge sayısını sıfırla
    async resetBadgeCount(userId, roomId) {
        try {
            const key = `badge:user:${userId}:room:${roomId}`;
            await redis_1.default.del(key);
            // Real-time güncelleme gönder
            this.notifyBadgeUpdate(userId, roomId, 0);
            console.log(`🔄 Badge reset for user ${userId} in room ${roomId}`);
        }
        catch (error) {
            console.error('Error resetting badge count:', error);
        }
    }
    // Kullanıcının tüm badge'lerini sıfırla
    async resetAllBadges(userId) {
        try {
            const roomsKey = `badge:users:${userId}:rooms`;
            const cluster = redis_1.default.getCluster();
            if (cluster && !redis_1.default.isUsingInMemory()) {
                const roomIds = await cluster.smembers(roomsKey);
                // Her room için badge'i sıfırla
                for (const roomId of roomIds) {
                    const badgeKey = `badge:user:${userId}:room:${roomId}`;
                    await redis_1.default.del(badgeKey);
                    this.notifyBadgeUpdate(userId, roomId, 0);
                }
                // Rooms set'ini temizle
                await redis_1.default.del(roomsKey);
            }
            else {
                // In-memory cache için basit temizlik
                await redis_1.default.del(roomsKey);
            }
            console.log(`🧹 All badges reset for user ${userId}`);
        }
        catch (error) {
            console.error('Error resetting all badges:', error);
        }
    }
    // Real-time badge güncelleme bildirimi gönder
    notifyBadgeUpdate(userId, roomId, count) {
        try {
            const socketManager = socket_1.default.getInstance();
            socketManager.sendToUser(userId, 'badge_updated', {
                roomId,
                count,
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.error('Error sending badge update notification:', error);
        }
    }
    // Badge sayısını manuel olarak ayarla
    async setBadgeCount(userId, roomId, count) {
        try {
            const key = `badge:user:${userId}:room:${roomId}`;
            if (count <= 0) {
                await redis_1.default.del(key);
            }
            else {
                await redis_1.default.set(key, count.toString());
                await redis_1.default.expire(key, 7 * 24 * 60 * 60);
            }
            // Real-time güncelleme gönder
            this.notifyBadgeUpdate(userId, roomId, Math.max(0, count));
            console.log(`🎯 Badge set for user ${userId} in room ${roomId}: ${count}`);
        }
        catch (error) {
            console.error('Error setting badge count:', error);
        }
    }
    // Kullanıcının toplam badge sayısını getir
    async getTotalBadgeCount(userId) {
        try {
            const badges = await this.getAllBadgeCounts(userId);
            return Object.values(badges).reduce((total, count) => total + count, 0);
        }
        catch (error) {
            console.error('Error getting total badge count:', error);
            return 0;
        }
    }
}
exports.default = BadgeService;
