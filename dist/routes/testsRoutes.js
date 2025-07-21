"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const testsController_1 = require("../controllers/testsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const adminMiddleware_1 = require("../middlewares/adminMiddleware");
const router = (0, express_1.Router)();
// Test setleri için temel CRUD
router.get('/', authMiddleware_1.authMiddleware, testsController_1.getAllTests); // Tüm test setlerini listele (kullanıcının tamamladıkları hariç)
router.get('/:testId', testsController_1.getTestById); // Belirli bir test setini ve içindeki tüm soruları/cevapları getir (herkese açık)
// Sadece adminlerin erişebileceği endpointler
router.post('/', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, testsController_1.createTest);
router.put('/:testId', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, testsController_1.updateTest);
router.delete('/:testId', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, testsController_1.deleteTest);
router.patch('/:testId/visibility', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, testsController_1.toggleTestVisibility);
exports.default = router;
