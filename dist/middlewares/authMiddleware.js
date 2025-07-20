"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
if (!ACCESS_TOKEN_SECRET) {
    console.error('FATAL ERROR: ACCESS_TOKEN_SECRET is not defined in environment variables.');
    process.exit(1); // Uygulamayı sonlandır
}
const authMiddleware = (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(token, ACCESS_TOKEN_SECRET);
        console.log('✅ Token verified for user:', decoded.userId || decoded.id);
        req.user = decoded; // Kullanıcı bilgisini request'e ekle
        next();
    }
    catch (error) {
        console.error('❌ Authentication error:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};
exports.authMiddleware = authMiddleware;
