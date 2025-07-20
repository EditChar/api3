import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  getAllBadges,
  getRoomBadge,
  resetRoomBadge,
  resetAllBadges,
  setBadgeCount
} from '../controllers/badgeController';

const router = Router();

// Tüm route'lar authentication gerektirir
router.use(authMiddleware);

// Kullanıcının tüm badge sayılarını getir
router.get('/', getAllBadges);

// Belirli bir room için badge sayısını getir
router.get('/room/:roomId', getRoomBadge);

// Belirli bir room için badge sayısını sıfırla
router.delete('/room/:roomId', resetRoomBadge);

// Kullanıcının tüm badge'lerini sıfırla
router.delete('/all', resetAllBadges);

// Badge sayısını manuel olarak ayarla (debug için)
router.put('/room/:roomId', setBadgeCount);

export default router; 