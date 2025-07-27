"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemHealth = exports.deactivateDevice = exports.sendTestNotification = exports.updateNotificationPreferences = exports.getNotificationStats = exports.getUserDevices = void 0;
const database_1 = __importDefault(require("../config/database"));
const enterpriseNotificationService_1 = require("../services/enterpriseNotificationService");
/**
 * 🏢 ENTERPRISE: Kullanıcının aktif cihaz listesi
 */
const getUserDevices = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const devices = await database_1.default.query(`
      SELECT 
        device_token,
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
      LIMIT 10
    `, [userId]);
        const deviceList = devices.rows.map(device => ({
            tokenId: device.device_token.substring(0, 10) + '...', // Security
            deviceType: device.device_type,
            deviceInfo: device.device_info,
            lastActive: device.last_active,
            isPrimary: device.is_primary
        }));
        res.status(200).json({
            enterprise: {
                totalActiveDevices: deviceList.length,
                maxDevicesAllowed: 10,
                devices: deviceList,
                lastUpdated: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error fetching user devices:', error);
        res.status(500).json({ message: 'Error fetching enterprise device data' });
    }
};
exports.getUserDevices = getUserDevices;
/**
 * 🏢 ENTERPRISE: Kullanıcı bildirim istatistikleri
 */
const getNotificationStats = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Son 30 günlük bildirim istatistikleri
        const stats = await database_1.default.query(`
      SELECT 
        type,
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread
      FROM notifications 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type
      ORDER BY total DESC
    `, [userId]);
        // Haftalık trend
        const weeklyTrend = await database_1.default.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read_notifications
      FROM notifications 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId]);
        // Aktif cihaz sayısı
        const deviceCount = await database_1.default.query(`
      SELECT get_user_active_device_count($1) as active_devices
    `, [userId]);
        res.status(200).json({
            enterprise: {
                userId,
                activeDevices: deviceCount.rows[0].active_devices,
                notificationStats: stats.rows,
                weeklyTrend: weeklyTrend.rows,
                period: '30 days',
                generatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({ message: 'Error fetching enterprise notification stats' });
    }
};
exports.getNotificationStats = getNotificationStats;
/**
 * 🏢 ENTERPRISE: Bildirim tercihleri güncelle
 */
const updateNotificationPreferences = async (req, res) => {
    const userId = req.user?.id;
    const { messageNotifications = true, messageRequestNotifications = true, requestAcceptedNotifications = true, chatEndedNotifications = true, quietHoursEnabled = false, quietHoursStart = '22:00:00', quietHoursEnd = '08:00:00', timezone = 'Europe/Istanbul' } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        await database_1.default.query(`
      INSERT INTO user_notification_preferences 
        (user_id, message_notifications, message_request_notifications, 
         request_accepted_notifications, chat_ended_notifications,
         quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        message_notifications = $2,
        message_request_notifications = $3,
        request_accepted_notifications = $4,
        chat_ended_notifications = $5,
        quiet_hours_enabled = $6,
        quiet_hours_start = $7,
        quiet_hours_end = $8,
        timezone = $9,
        updated_at = NOW()
    `, [
            userId, messageNotifications, messageRequestNotifications,
            requestAcceptedNotifications, chatEndedNotifications,
            quietHoursEnabled, quietHoursStart, quietHoursEnd, timezone
        ]);
        res.status(200).json({
            message: 'Enterprise notification preferences updated successfully',
            enterprise: {
                userId,
                preferences: {
                    messageNotifications,
                    messageRequestNotifications,
                    requestAcceptedNotifications,
                    chatEndedNotifications,
                    quietHoursEnabled,
                    quietHoursStart,
                    quietHoursEnd,
                    timezone
                },
                updatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ message: 'Error updating enterprise notification preferences' });
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
/**
 * 🏢 ENTERPRISE: Test notification gönder (Crash-safe version)
 */
const sendTestNotification = async (req, res) => {
    const userId = req.user?.id;
    const { title = 'Test Notification', body = 'This is a test notification from enterprise system' } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        console.log(`🧪 Sending test notification to user ${userId}`);
        // 🛡️ Crash-safe minimal payload
        const result = await enterpriseNotificationService_1.enterpriseNotificationService.sendEnterpriseNotification({
            userId,
            title: title.toString(), // Ensure string
            body: body.toString(), // Ensure string
            type: 'message_received',
            data: {
                test: 'true',
                enterprise: 'true',
                timestamp: Date.now().toString(),
                source: 'test_endpoint'
            },
            priority: 'normal', // Use normal priority for tests
            sound: 'default', // Explicit default sound
            ttl: 3600 // 1 hour TTL
        });
        console.log(`🧪 Test notification result:`, result);
        res.status(200).json({
            message: 'Enterprise test notification sent successfully',
            enterprise: {
                testResult: result,
                sentAt: new Date().toISOString(),
                userId,
                crashSafe: true
            }
        });
    }
    catch (error) {
        console.error('❌ Test notification error:', error);
        res.status(500).json({
            message: 'Enterprise test notification failed',
            error: error.message || 'Unknown error',
            enterprise: {
                userId,
                failedAt: new Date().toISOString(),
                crashSafe: true
            }
        });
    }
};
exports.sendTestNotification = sendTestNotification;
/**
 * 🏢 ENTERPRISE: Cihazı manuel deaktif et
 */
const deactivateDevice = async (req, res) => {
    const userId = req.user?.id;
    const { deviceTokenPrefix } = req.body; // Sadece ilk 10 karakter güvenlik için
    if (!userId || !deviceTokenPrefix) {
        return res.status(400).json({ message: 'User ID and device token prefix required' });
    }
    try {
        const result = await database_1.default.query(`
      UPDATE device_tokens 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 
        AND device_token LIKE $2 
        AND is_active = true
      RETURNING device_token
    `, [userId, deviceTokenPrefix + '%']);
        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Device not found or already inactive',
                enterprise: {
                    deviceTokenPrefix,
                    userId
                }
            });
        }
        // Clear cache
        const redisClient = require('../config/redis').default;
        await redisClient.del(`user_devices:${userId}`);
        res.status(200).json({
            message: 'Enterprise device deactivated successfully',
            enterprise: {
                deactivatedDevices: result.rowCount,
                deviceTokenPrefix,
                userId,
                deactivatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error deactivating device:', error);
        res.status(500).json({ message: 'Error deactivating enterprise device' });
    }
};
exports.deactivateDevice = deactivateDevice;
/**
 * 🏢 ENTERPRISE: Sistem sağlık kontrolü
 */
const getSystemHealth = async (req, res) => {
    try {
        // Database bağlantısını test et
        const dbTest = await database_1.default.query('SELECT NOW() as timestamp');
        // Redis bağlantısını test et
        let redisStatus = 'unknown';
        try {
            const redisClient = require('../config/redis').default;
            await redisClient.ping();
            redisStatus = 'healthy';
        }
        catch (redisError) {
            redisStatus = 'unhealthy';
        }
        // Son 24 saatteki bildirim istatistikleri
        const notificationStats = await database_1.default.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
      FROM notifications 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
        // Aktif cihaz sayısı
        const activeDevices = await database_1.default.query(`
      SELECT COUNT(*) as active_devices
      FROM device_tokens 
      WHERE is_active = true 
        AND updated_at > NOW() - INTERVAL '7 days'
    `);
        res.status(200).json({
            enterprise: {
                systemHealth: 'healthy',
                database: {
                    status: 'healthy',
                    timestamp: dbTest.rows[0].timestamp
                },
                redis: {
                    status: redisStatus
                },
                notifications: {
                    last24Hours: parseInt(notificationStats.rows[0].total_notifications),
                    lastHour: parseInt(notificationStats.rows[0].last_hour)
                },
                devices: {
                    activeCount: parseInt(activeDevices.rows[0].active_devices)
                },
                checkedAt: new Date().toISOString(),
                version: '2.0'
            }
        });
    }
    catch (error) {
        console.error('Enterprise health check error:', error);
        res.status(500).json({
            enterprise: {
                systemHealth: 'unhealthy',
                error: error.message || 'Unknown error',
                checkedAt: new Date().toISOString()
            }
        });
    }
};
exports.getSystemHealth = getSystemHealth;
