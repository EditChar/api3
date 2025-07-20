"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matchingController_1 = require("../controllers/matchingController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Kullanıcının eşleşme uygunluğunu kontrol et
router.get('/eligibility', authMiddleware_1.authMiddleware, matchingController_1.checkMatchEligibility);
// Kullanıcı için eşleşmeleri getir
router.get('/', authMiddleware_1.authMiddleware, matchingController_1.getMatches);
// Belirli bir eşleşmenin detaylarını getir
router.get('/details/:matchUserId', authMiddleware_1.authMiddleware, matchingController_1.getMatchDetails);
exports.default = router;
