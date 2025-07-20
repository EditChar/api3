import { Request, Response } from 'express';
import BadgeService from '../services/badgeService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

const badgeService = BadgeService.getInstance();

// Kullanıcının tüm badge sayılarını getir
export const getAllBadges = async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error('Get all badges error:', error);
    res.status(500).json({ message: 'Error getting badges' });
  }
};

// Belirli bir room için badge sayısını getir
export const getRoomBadge = async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error('Get room badge error:', error);
    res.status(500).json({ message: 'Error getting room badge' });
  }
};

// Belirli bir room için badge sayısını sıfırla
export const resetRoomBadge = async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error('Reset room badge error:', error);
    res.status(500).json({ message: 'Error resetting badge' });
  }
};

// Kullanıcının tüm badge'lerini sıfırla
export const resetAllBadges = async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error('Reset all badges error:', error);
    res.status(500).json({ message: 'Error resetting all badges' });
  }
};

// Badge sayısını manuel olarak ayarla (admin/debug için)
export const setBadgeCount = async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error('Set badge count error:', error);
    res.status(500).json({ message: 'Error setting badge count' });
  }
}; 