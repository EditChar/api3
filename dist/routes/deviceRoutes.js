"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const deviceController_1 = require("../controllers/deviceController");
const router = (0, express_1.Router)();
// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware_1.authMiddleware);
// FCM Token kaydetme
router.post('/fcm/register', deviceController_1.registerFCMToken);
// FCM Token deaktif etme
router.post('/fcm/unregister', deviceController_1.unregisterFCMToken);
exports.default = router;
