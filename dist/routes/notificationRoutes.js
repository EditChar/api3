"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware_1.authMiddleware);
// Kullanıcının bildirimlerini getir
router.get('/', notificationController_1.getNotifications);
// Bekleyen (okunmamış) bildirimleri getir
router.get('/pending', notificationController_1.getPendingNotifications);
// Okunmamış bildirim sayısını getir
router.get('/unread-count', notificationController_1.getUnreadCount);
// Bildirimi okundu olarak işaretle
router.patch('/:notificationId/read', notificationController_1.markAsRead);
// Tüm bildirimleri okundu olarak işaretle
router.patch('/read-all', notificationController_1.markAllAsRead);
// Bildirimi sil
router.delete('/:notificationId', notificationController_1.deleteNotificationById);
exports.default = router;
