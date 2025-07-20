"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const questionsController_1 = require("../controllers/questionsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const adminMiddleware_1 = require("../middlewares/adminMiddleware"); // adminMiddleware'i import et
// import { adminMiddleware } from '../middlewares/adminMiddleware'; // İleride eklenecek
// Bu router'ı ana router'da /api/tests/:testId/questions altına mount edeceğiz
// Bu yüzden buradaki pathler / ile başlayacak ama göreceli olacak.
const router = (0, express_1.Router)({ mergeParams: true }); // mergeParams: true -> :testId gibi üstteki parametreleri yakalamak için
// Bir test setine ait sorular için CRUD
// GET işlemleri herkese açık olabilir
router.get('/', questionsController_1.getQuestionsForTest);
router.get('/:questionId', questionsController_1.getQuestionById);
// Sadece adminlerin erişebileceği endpointler
router.post('/', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, questionsController_1.addQuestionToTest); // Belirli bir teste yeni soru ve cevaplarını ekle
router.put('/:questionId', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, questionsController_1.updateQuestion); // Soruyu güncelle
router.delete('/:questionId', authMiddleware_1.authMiddleware, adminMiddleware_1.adminMiddleware, questionsController_1.deleteQuestion); // Soruyu sil
exports.default = router;
