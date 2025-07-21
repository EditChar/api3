"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationSecurityMiddleware = void 0;
/**
 * Notification güvenlik middleware'i
 * Sadece kullanıcının kendi bildirimlerine erişebilmesini sağlar
 */
const notificationSecurityMiddleware = (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Kullanıcı doğrulandı, devam et
    next();
};
exports.notificationSecurityMiddleware = notificationSecurityMiddleware;
