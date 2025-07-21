"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCount = exports.getPendingNotifications = exports.deleteNotificationById = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const database_1 = __importDefault(require("../config/database"));
const notificationService_1 = require("../services/notificationService");
const getNotifications = async (req, res) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const result = await (0, notificationService_1.getUserNotifications)(userId, limit, offset);
        res.status(200).json({
            notifications: result.notifications.map(n => ({ ...n })),
            pagination: {
                current_page: page,
                total_pages: Math.ceil(result.total / limit),
                total_count: result.total,
                unread_count: result.unread_count,
                limit
            }
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Error getting notifications' });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    const userId = req.user?.id;
    const notificationId = parseInt(req.params.notificationId);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!notificationId) {
        return res.status(400).json({ message: 'Notification ID is required' });
    }
    try {
        const success = await (0, notificationService_1.markNotificationAsRead)(notificationId, userId);
        if (!success) {
            return res.status(404).json({ message: 'Notification not found or you are not authorized to update it' });
        }
        res.status(200).json({
            message: 'Notification marked as read successfully'
        });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ message: 'Error marking notification as read' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const updatedCount = await (0, notificationService_1.markAllNotificationsAsRead)(userId);
        res.status(200).json({
            message: 'All notifications marked as read successfully',
            updated_count: updatedCount
        });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ message: 'Error marking all notifications as read' });
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotificationById = async (req, res) => {
    const userId = req.user?.id;
    const notificationId = parseInt(req.params.notificationId);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!notificationId) {
        return res.status(400).json({ message: 'Notification ID is required' });
    }
    try {
        const success = await (0, notificationService_1.deleteNotification)(notificationId, userId);
        if (!success) {
            return res.status(404).json({ message: 'Notification not found or you are not authorized to delete it' });
        }
        res.status(200).json({
            message: 'Notification deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ message: 'Error deleting notification' });
    }
};
exports.deleteNotificationById = deleteNotificationById;
// Bekleyen (okunmamış) bildirimleri getir
const getPendingNotifications = async (req, res) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Sadece okunmamış bildirimleri getir
        const result = await database_1.default.query(`
      SELECT * FROM notifications
      WHERE user_id = $1 AND is_read = false
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
        // Toplam okunmamış sayısı
        const countResult = await database_1.default.query(`
      SELECT COUNT(*) as total FROM notifications 
      WHERE user_id = $1 AND is_read = false
    `, [userId]);
        res.status(200).json({
            notifications: result.rows,
            pagination: {
                current_page: page,
                total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
                total_count: parseInt(countResult.rows[0].total),
                limit
            }
        });
    }
    catch (error) {
        console.error('Get pending notifications error:', error);
        res.status(500).json({ message: 'Error getting pending notifications' });
    }
};
exports.getPendingNotifications = getPendingNotifications;
const getUnreadCount = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const result = await (0, notificationService_1.getUserNotifications)(userId, 1, 0);
        res.status(200).json({
            unread_count: result.unread_count
        });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Error getting unread count' });
    }
};
exports.getUnreadCount = getUnreadCount;
