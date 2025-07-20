"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const testResponsesController_1 = require("../controllers/testResponsesController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Test cevabı gönderme - POST /api/test-responses/:testId/submit
router.post('/:testId/submit', authMiddleware_1.authMiddleware, testResponsesController_1.submitTestResponse);
// Kullanıcının test sonuçlarını listeleme - GET /api/test-responses
router.get('/', authMiddleware_1.authMiddleware, testResponsesController_1.getUserTestResponses);
// Kullanıcının genel puanını alma - GET /api/test-responses/score
router.get('/score', authMiddleware_1.authMiddleware, testResponsesController_1.getUserScore);
// Test cevabının detaylarını alma - GET /api/test-responses/:testResponseId/details
router.get('/:testResponseId/details', authMiddleware_1.authMiddleware, testResponsesController_1.getTestResponseDetails);
// Kullanıcının tamamladığı testleri listeleme - GET /api/test-responses/completed
router.get('/completed/list', authMiddleware_1.authMiddleware, testResponsesController_1.getCompletedTests);
// Bir testin tamamlanıp tamamlanmadığını kontrol etme - GET /api/test-responses/check/:testId
router.get('/check/:testId', authMiddleware_1.authMiddleware, testResponsesController_1.checkTestCompletion);
exports.default = router;
