"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unregisterFCMToken = exports.registerFCMToken = void 0;
const database_1 = __importDefault(require("../config/database"));
const enterpriseNotificationService_1 = require("../services/enterpriseNotificationService");
/**
 * 🏢 ENTERPRISE: FCM Token kaydetme/güncelleme (Multi-device support)
 */
const registerFCMToken = async (req, res) => {
    const userId = req.user?.id;
    const { token, deviceType, deviceInfo, platform, appVersion, timezone } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!token || !deviceType) {
        return res.status(400).json({ message: 'Token and deviceType are required' });
    }
    try {
        console.log(`🏢 Enterprise: Registering FCM token for user ${userId}, device type: ${deviceType}`);
        // 🏢 ENTERPRISE: Use enterprise notification service
        const result = await enterpriseNotificationService_1.enterpriseNotificationService.registerUserDevice(userId, token, deviceType, {
            ...deviceInfo,
            platform,
            appVersion,
            timezone,
            registeredAt: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        if (!result.success) {
            return res.status(500).json({
                message: result.message,
                error: 'ENTERPRISE_REGISTRATION_FAILED'
            });
        }
        // Backward compatibility: Also save to push_devices table
        try {
            await database_1.default.query(`
        INSERT INTO push_devices (user_id, device_id, platform, token_encrypted, locale, app_version, timezone, is_active, last_updated, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
        ON CONFLICT (device_id) DO UPDATE SET 
          user_id = $1, 
          token_encrypted = $4, 
          is_active = true, 
          last_updated = NOW()
      `, [userId, token, platform || deviceType, token, 'tr', appVersion || '1.0.0', timezone || 'Europe/Istanbul']);
        }
        catch (legacyError) {
            console.warn('Legacy push_devices table update failed:', legacyError);
        }
        // Get user's current active device count
        const deviceCountResult = await database_1.default.query(`
      SELECT COUNT(*) as count 
      FROM device_tokens 
      WHERE user_id = $1 AND is_active = true
    `, [userId]);
        const activeDeviceCount = parseInt(deviceCountResult.rows[0].count);
        res.status(200).json({
            message: 'Enterprise FCM token registered successfully',
            enterprise: {
                tokenId: token.substring(0, 10) + '...',
                deviceType,
                activeDeviceCount,
                multiDeviceEnabled: true,
                maxDevicesPerUser: 10,
                registrationTimestamp: new Date().toISOString()
            }
        });
        console.log(`✅ Enterprise: User ${userId} now has ${activeDeviceCount} active devices`);
    }
    catch (error) {
        console.error('Enterprise FCM token registration error:', error);
        res.status(500).json({
            message: 'Enterprise FCM token registration failed',
            error: 'ENTERPRISE_REGISTRATION_ERROR'
        });
    }
};
exports.registerFCMToken = registerFCMToken;
/**
 * 🏢 ENTERPRISE: Specific device token deaktif et (logout sırasında)
 */
const unregisterFCMToken = async (req, res) => {
    const userId = req.user?.id;
    const { token, allDevices = false } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        let deactivatedCount = 0;
        if (allDevices) {
            // 🏢 ENTERPRISE: Logout from all devices
            const result = await database_1.default.query(`
        UPDATE device_tokens 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND is_active = true
        RETURNING device_token
      `, [userId]);
            deactivatedCount = result.rowCount || 0;
            // Also deactivate in legacy table
            await database_1.default.query(`
        UPDATE push_devices 
        SET is_active = false, last_updated = NOW()
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
            console.log(`🏢 Enterprise: Deactivated ALL ${deactivatedCount} devices for user ${userId}`);
        }
        else if (token) {
            // 🏢 ENTERPRISE: Logout from specific device
            const result = await database_1.default.query(`
        UPDATE device_tokens 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND device_token = $2 AND is_active = true
        RETURNING device_token
      `, [userId, token]);
            deactivatedCount = result.rowCount || 0;
            // Also deactivate in legacy table
            await database_1.default.query(`
        UPDATE push_devices 
        SET is_active = false, last_updated = NOW()
        WHERE user_id = $1 AND device_id = $2
      `, [userId, token]);
            console.log(`🏢 Enterprise: Deactivated specific device for user ${userId}`);
        }
        else {
            return res.status(400).json({
                message: 'Token is required unless allDevices is true'
            });
        }
        // Clear user's device cache
        const redisClient = require('../config/redis').default;
        await redisClient.del(`user_devices:${userId}`);
        // Get remaining active devices
        const remainingDevicesResult = await database_1.default.query(`
      SELECT COUNT(*) as count 
      FROM device_tokens 
      WHERE user_id = $1 AND is_active = true
    `, [userId]);
        const remainingDevices = parseInt(remainingDevicesResult.rows[0].count);
        res.status(200).json({
            message: 'Enterprise FCM token(s) unregistered successfully',
            enterprise: {
                deactivatedDevices: deactivatedCount,
                remainingActiveDevices: remainingDevices,
                allDevicesLogout: allDevices,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Enterprise FCM token unregister error:', error);
        res.status(500).json({
            message: 'Enterprise FCM token unregister failed',
            error: 'ENTERPRISE_UNREGISTER_ERROR'
        });
    }
};
exports.unregisterFCMToken = unregisterFCMToken;
