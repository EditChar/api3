import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { registerFCMToken, unregisterFCMToken } from '../controllers/deviceController';

const router = Router();

// Tüm route'lar authentication gerektiriyor
router.use(authMiddleware);

// 🏢 ENTERPRISE: FCM Token Management
// Frontend integration endpoints (as documented in React Native Firebase Integration Prompt)
router.post('/register-token', registerFCMToken);
router.post('/unregister-token', unregisterFCMToken);

// 🔄 LEGACY: Backward compatibility endpoints
router.post('/fcm/register', registerFCMToken);
router.post('/fcm/unregister', unregisterFCMToken);

export default router; 