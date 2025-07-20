"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const badgeController_1 = require("../controllers/badgeController");
const router = (0, express_1.Router)();
// Tüm route'lar authentication gerektirir
router.use(authMiddleware_1.authMiddleware);
// Kullanıcının tüm badge sayılarını getir
router.get('/', badgeController_1.getAllBadges);
// Belirli bir room için badge sayısını getir
router.get('/room/:roomId', badgeController_1.getRoomBadge);
// Belirli bir room için badge sayısını sıfırla
router.delete('/room/:roomId', badgeController_1.resetRoomBadge);
// Kullanıcının tüm badge'lerini sıfırla
router.delete('/all', badgeController_1.resetAllBadges);
// Badge sayısını manuel olarak ayarla (debug için)
router.put('/room/:roomId', badgeController_1.setBadgeCount);
exports.default = router;
