import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  sendMessageRequest,
  getReceivedRequests,
  getPendingRequests,
  acceptMessageRequest,
  rejectMessageRequest,
  cancelMessageRequest
} from '../controllers/messageRequestController';

const router = express.Router();

// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware);

// Mesaj isteği gönder
router.post('/send', sendMessageRequest);

// Gelen istekleri getir
router.get('/received', getReceivedRequests);

// Gönderilen istekleri getir
router.get('/pending', getPendingRequests);

// Mesaj isteğini kabul et
router.post('/:requestId/accept', acceptMessageRequest);

// Mesaj isteğini reddet
router.post('/:requestId/reject', rejectMessageRequest);

// Mesaj isteğini iptal et (gönderen tarafından)
router.delete('/:requestId/cancel', cancelMessageRequest);

export default router; 