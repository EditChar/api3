"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const deviceController_1 = require("../controllers/deviceController");
const router = (0, express_1.Router)();
// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware_1.authMiddleware);
// 🏢 ENTERPRISE: FCM Token Management
// Frontend integration endpoints (as documented in React Native Firebase Integration Prompt)
router.post('/register-token', deviceController_1.registerFCMToken);
router.post('/unregister-token', deviceController_1.unregisterFCMToken);
// 🔄 LEGACY: Backward compatibility endpoints
router.post('/fcm/register', deviceController_1.registerFCMToken);
router.post('/fcm/unregister', deviceController_1.unregisterFCMToken);
exports.default = router;
