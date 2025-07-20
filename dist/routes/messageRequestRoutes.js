"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const messageRequestController_1 = require("../controllers/messageRequestController");
const router = express_1.default.Router();
// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware_1.authMiddleware);
// Mesaj isteği gönder
router.post('/send', messageRequestController_1.sendMessageRequest);
// Gelen istekleri getir
router.get('/received', messageRequestController_1.getReceivedRequests);
// Gönderilen istekleri getir
router.get('/pending', messageRequestController_1.getPendingRequests);
// Mesaj isteğini kabul et
router.post('/:requestId/accept', messageRequestController_1.acceptMessageRequest);
// Mesaj isteğini reddet
router.post('/:requestId/reject', messageRequestController_1.rejectMessageRequest);
// Mesaj isteğini iptal et (gönderen tarafından)
router.delete('/:requestId/cancel', messageRequestController_1.cancelMessageRequest);
exports.default = router;
