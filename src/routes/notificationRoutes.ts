import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
  getUnreadCount
} from '../controllers/notificationController';

const router = express.Router();

// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware);

// Kullanıcının bildirimlerini getir
router.get('/', getNotifications);

// Okunmamış bildirim sayısını getir
router.get('/unread-count', getUnreadCount);

// Bildirimi okundu olarak işaretle
router.patch('/:notificationId/read', markAsRead);

// Tüm bildirimleri okundu olarak işaretle
router.patch('/read-all', markAllAsRead);

// Bildirimi sil
router.delete('/:notificationId', deleteNotificationById);

export default router; 