import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { 
  getUserDevices,
  getNotificationStats,
  updateNotificationPreferences,
  sendTestNotification,
  deactivateDevice,
  getSystemHealth
} from '../controllers/enterpriseController';

const router = express.Router();

// 🏢 ENTERPRISE ROUTES - User-centric multi-device notification system

// Kullanıcının aktif cihazlarını listele
router.get('/devices', authMiddleware, getUserDevices);

// Kullanıcının bildirim istatistiklerini getir
router.get('/stats', authMiddleware, getNotificationStats);

// Bildirim tercihlerini güncelle
router.put('/preferences', authMiddleware, updateNotificationPreferences);

// Test bildirimi gönder
router.post('/test-notification', authMiddleware, sendTestNotification);

// Belirli cihazı deaktif et
router.post('/deactivate-device', authMiddleware, deactivateDevice);

// Sistem sağlık kontrolü
router.get('/health', getSystemHealth);

export default router; 