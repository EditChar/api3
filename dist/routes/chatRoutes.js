"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const chatController_1 = require("../controllers/chatController");
const router = express_1.default.Router();
// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware_1.authMiddleware);
// Kullanıcının aktif sohbetini getir
router.get('/active', chatController_1.getActiveChat);
// Kullanıcının chat room'larını getir
router.get('/rooms', chatController_1.getChatRooms);
// Chat room oluştur
router.post('/rooms', chatController_1.createChatRoom);
// Specific chat room detayını getir
router.get('/rooms/:roomId', chatController_1.getChatRoom);
// Chat room'a giriş yap ve badge'i sıfırla
router.post('/rooms/:roomId/enter', chatController_1.enterChatRoom);
// Chat room'un mesajlarını getir
router.get('/rooms/:roomId/messages', chatController_1.getMessages);
// Mesaj gönder
router.post('/rooms/:roomId/messages', chatController_1.sendMessage);
// Chat room'daki mesajları okundu olarak işaretle (Badge sıfırlama için)
router.post('/rooms/:roomId/read', chatController_1.markChatRoomAsRead);
// markMessagesAsRead route'u kaldırıldı - yeni badge sistemi kullanılacak
// Chat room'u hemen sonlandır
router.post('/rooms/:roomId/end', chatController_1.endRoom);
// Chat room'u güncelle
router.put('/rooms/:roomId', chatController_1.updateRoom);
// 🗑️ Expired Chat Cleanup Endpoints
// Süresi dolmuş chat room'ları getir
router.get('/rooms/expired', chatController_1.getExpiredChatRooms);
// Süresi dolmuş chat room'ları sil
router.delete('/rooms/expired', chatController_1.deleteExpiredChatRooms);
exports.default = router;
