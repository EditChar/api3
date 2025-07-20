import { Router } from 'express';
import {
  addQuestionToTest,
  getQuestionsForTest,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionsController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware'; // adminMiddleware'i import et
// import { adminMiddleware } from '../middlewares/adminMiddleware'; // İleride eklenecek

// Bu router'ı ana router'da /api/tests/:testId/questions altına mount edeceğiz
// Bu yüzden buradaki pathler / ile başlayacak ama göreceli olacak.
const router = Router({ mergeParams: true }); // mergeParams: true -> :testId gibi üstteki parametreleri yakalamak için

// Bir test setine ait sorular için CRUD
// GET işlemleri herkese açık olabilir
router.get('/', getQuestionsForTest);
router.get('/:questionId', getQuestionById);

// Sadece adminlerin erişebileceği endpointler
router.post('/', authMiddleware, adminMiddleware, addQuestionToTest); // Belirli bir teste yeni soru ve cevaplarını ekle
router.put('/:questionId', authMiddleware, adminMiddleware, updateQuestion); // Soruyu güncelle
router.delete('/:questionId', authMiddleware, adminMiddleware, deleteQuestion); // Soruyu sil

export default router; 