"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.post('/signup', authController_1.signup);
router.post('/login', authController_1.login);
router.post('/refresh-token', authController_1.refreshTokenHandler);
router.post('/logout', authMiddleware_1.authMiddleware, authController_1.logout);
exports.default = router;
