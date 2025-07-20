"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBadgeCount = exports.resetAllBadges = exports.resetRoomBadge = exports.getRoomBadge = exports.getAllBadges = void 0;
const badgeService_1 = __importDefault(require("../services/badgeService"));
const badgeService = badgeService_1.default.getInstance();
// Kullanıcının tüm badge sayılarını getir
const getAllBadges = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const badges = await badgeService.getAllBadgeCounts(userId);
        const totalCount = await badgeService.getTotalBadgeCount(userId);
        res.status(200).json({
            badges,
            totalCount,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Get all badges error:', error);
        res.status(500).json({ message: 'Error getting badges' });
    }
};
exports.getAllBadges = getAllBadges;
// Belirli bir room için badge sayısını getir
const getRoomBadge = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        const count = await badgeService.getRoomBadgeCount(userId, roomId);
        res.status(200).json({
            roomId,
            count,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Get room badge error:', error);
        res.status(500).json({ message: 'Error getting room badge' });
    }
};
exports.getRoomBadge = getRoomBadge;
// Belirli bir room için badge sayısını sıfırla
const resetRoomBadge = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        await badgeService.resetBadgeCount(userId, roomId);
        res.status(200).json({
            message: 'Badge reset successfully',
            roomId,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Reset room badge error:', error);
        res.status(500).json({ message: 'Error resetting badge' });
    }
};
exports.resetRoomBadge = resetRoomBadge;
// Kullanıcının tüm badge'lerini sıfırla
const resetAllBadges = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        await badgeService.resetAllBadges(userId);
        res.status(200).json({
            message: 'All badges reset successfully',
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Reset all badges error:', error);
        res.status(500).json({ message: 'Error resetting all badges' });
    }
};
exports.resetAllBadges = resetAllBadges;
// Badge sayısını manuel olarak ayarla (admin/debug için)
const setBadgeCount = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    const { count } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    if (typeof count !== 'number' || count < 0) {
        return res.status(400).json({ message: 'Valid count is required' });
    }
    try {
        await badgeService.setBadgeCount(userId, roomId, count);
        res.status(200).json({
            message: 'Badge count set successfully',
            roomId,
            count,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Set badge count error:', error);
        res.status(500).json({ message: 'Error setting badge count' });
    }
};
exports.setBadgeCount = setBadgeCount;
