import express from 'express';
import { 
  submitTestResponse,
  getUserTestResponses,
  getUserScore,
  getTestResponseDetails,
  getCompletedTests,
  checkTestCompletion
} from '../controllers/testResponsesController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Test cevabı gönderme - POST /api/test-responses/:testId/submit
router.post('/:testId/submit', authMiddleware, submitTestResponse);

// Kullanıcının test sonuçlarını listeleme - GET /api/test-responses
router.get('/', authMiddleware, getUserTestResponses);

// Kullanıcının genel puanını alma - GET /api/test-responses/score
router.get('/score', authMiddleware, getUserScore);

// Test cevabının detaylarını alma - GET /api/test-responses/:testResponseId/details
router.get('/:testResponseId/details', authMiddleware, getTestResponseDetails);

// Kullanıcının tamamladığı testleri listeleme - GET /api/test-responses/completed
router.get('/completed/list', authMiddleware, getCompletedTests);

// Bir testin tamamlanıp tamamlanmadığını kontrol etme - GET /api/test-responses/check/:testId
router.get('/check/:testId', authMiddleware, checkTestCompletion);

export default router; 