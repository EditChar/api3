import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware'; // req.user için

export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    // Bu durum normalde authMiddleware tarafından yakalanmalı ama yine de kontrol edelim.
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }

  next(); // Kullanıcı admin ise sonraki adıma geç
}; 