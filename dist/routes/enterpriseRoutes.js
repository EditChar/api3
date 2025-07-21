"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const enterpriseController_1 = require("../controllers/enterpriseController");
const router = express_1.default.Router();
// 🏢 ENTERPRISE ROUTES - User-centric multi-device notification system
// Kullanıcının aktif cihazlarını listele
router.get('/devices', authMiddleware_1.authMiddleware, enterpriseController_1.getUserDevices);
// Kullanıcının bildirim istatistiklerini getir
router.get('/stats', authMiddleware_1.authMiddleware, enterpriseController_1.getNotificationStats);
// Bildirim tercihlerini güncelle
router.put('/preferences', authMiddleware_1.authMiddleware, enterpriseController_1.updateNotificationPreferences);
// Test bildirimi gönder
router.post('/test-notification', authMiddleware_1.authMiddleware, enterpriseController_1.sendTestNotification);
// Belirli cihazı deaktif et
router.post('/deactivate-device', authMiddleware_1.authMiddleware, enterpriseController_1.deactivateDevice);
// Sistem sağlık kontrolü
router.get('/health', enterpriseController_1.getSystemHealth);
exports.default = router;
