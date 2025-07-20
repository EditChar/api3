import { Router } from 'express';
import {
  createTest,
  getAllTests,
  getTestById,
  updateTest,
  deleteTest,
  toggleTestVisibility,
} from '../controllers/testsController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// Test setleri için temel CRUD
router.get('/', authMiddleware, getAllTests); // Tüm test setlerini listele (kullanıcının tamamladıkları hariç)
router.get('/:testId', getTestById); // Belirli bir test setini ve içindeki tüm soruları/cevapları getir (herkese açık)

// Sadece adminlerin erişebileceği endpointler
router.post('/', authMiddleware, adminMiddleware, createTest);
router.put('/:testId', authMiddleware, adminMiddleware, updateTest);
router.delete('/:testId', authMiddleware, adminMiddleware, deleteTest);
router.patch('/:testId/visibility', authMiddleware, adminMiddleware, toggleTestVisibility);

export default router; 