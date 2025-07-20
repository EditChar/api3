import { Router } from 'express';
import { 
  getMatches, 
  checkMatchEligibility, 
  getMatchDetails 
} from '../controllers/matchingController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Kullanıcının eşleşme uygunluğunu kontrol et
router.get('/eligibility', authMiddleware, checkMatchEligibility);

// Kullanıcı için eşleşmeleri getir
router.get('/', authMiddleware, getMatches);

// Belirli bir eşleşmenin detaylarını getir
router.get('/details/:matchUserId', authMiddleware, getMatchDetails);

export default router; 