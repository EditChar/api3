import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../services/notificationService';

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const result = await getUserNotifications(userId, limit, offset);

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

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Error getting notifications' });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const notificationId = parseInt(req.params.notificationId);

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!notificationId) {
    return res.status(400).json({ message: 'Notification ID is required' });
  }

  try {
    const success = await markNotificationAsRead(notificationId, userId);

    if (!success) {
      return res.status(404).json({ message: 'Notification not found or you are not authorized to update it' });
    }

    res.status(200).json({
      message: 'Notification marked as read successfully'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const updatedCount = await markAllNotificationsAsRead(userId);

    res.status(200).json({
      message: 'All notifications marked as read successfully',
      updated_count: updatedCount
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
};

export const deleteNotificationById = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const notificationId = parseInt(req.params.notificationId);

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!notificationId) {
    return res.status(400).json({ message: 'Notification ID is required' });
  }

  try {
    const success = await deleteNotification(notificationId, userId);

    if (!success) {
      return res.status(404).json({ message: 'Notification not found or you are not authorized to delete it' });
    }

    res.status(200).json({
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Error deleting notification' });
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const result = await getUserNotifications(userId, 1, 0);

    res.status(200).json({
      unread_count: result.unread_count
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Error getting unread count' });
  }
}; 