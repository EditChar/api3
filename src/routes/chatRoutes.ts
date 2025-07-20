import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  getChatRooms,
  getChatRoom,
  getMessages,
  sendMessage,
  enterChatRoom,
  markChatRoomAsRead,
  endRoom,
  updateRoom,
  createChatRoom,
  getExpiredChatRooms,
  deleteExpiredChatRooms,
  getActiveChat
} from '../controllers/chatController';

const router = express.Router();

// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware);

// Kullanıcının aktif sohbetini getir
router.get('/active', getActiveChat);

// Kullanıcının chat room'larını getir
router.get('/rooms', getChatRooms);

// Chat room oluştur
router.post('/rooms', createChatRoom);

// Specific chat room detayını getir
router.get('/rooms/:roomId', getChatRoom);

// Chat room'a giriş yap ve badge'i sıfırla
router.post('/rooms/:roomId/enter', enterChatRoom);

// Chat room'un mesajlarını getir
router.get('/rooms/:roomId/messages', getMessages);

// Mesaj gönder
router.post('/rooms/:roomId/messages', sendMessage);

// Chat room'daki mesajları okundu olarak işaretle (Badge sıfırlama için)
router.post('/rooms/:roomId/read', markChatRoomAsRead);

// markMessagesAsRead route'u kaldırıldı - yeni badge sistemi kullanılacak

// Chat room'u hemen sonlandır
router.post('/rooms/:roomId/end', endRoom);

// Chat room'u güncelle
router.put('/rooms/:roomId', updateRoom);

// 🗑️ Expired Chat Cleanup Endpoints
// Süresi dolmuş chat room'ları getir
router.get('/rooms/expired', getExpiredChatRooms);

// Süresi dolmuş chat room'ları sil
router.delete('/rooms/expired', deleteExpiredChatRooms);

export default router; 