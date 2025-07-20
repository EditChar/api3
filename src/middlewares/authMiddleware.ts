import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User'; // User modelini import ediyoruz

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  console.error('FATAL ERROR: ACCESS_TOKEN_SECRET is not defined in environment variables.');
  process.exit(1); // Uygulamayı sonlandır
}

export interface AuthenticatedRequest extends Request {
  user?: User; // req.user objesini tanımlıyoruz
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log('🔐 Auth middleware called for:', req.method, req.path);
  const authHeader = req.headers.authorization;
  console.log('🔑 Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'MISSING');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ Auth failed: Missing or invalid authorization header');
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  console.log('🎫 Token extracted, length:', token.length);

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as User;
    console.log('✅ Token verified for user:', (decoded as any).userId || decoded.id);
    req.user = decoded; // Kullanıcı bilgisini request'e ekle
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}; 