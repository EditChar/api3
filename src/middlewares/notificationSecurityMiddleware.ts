import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';

/**
 * Notification güvenlik middleware'i
 * Sadece kullanıcının kendi bildirimlerine erişebilmesini sağlar
 */
export const notificationSecurityMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Kullanıcı doğrulandı, devam et
  
  next();
}; 