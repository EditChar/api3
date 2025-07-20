"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = void 0;
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        // Bu durum normalde authMiddleware tarafından yakalanmalı ama yine de kontrol edelim.
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next(); // Kullanıcı admin ise sonraki adıma geç
};
exports.adminMiddleware = adminMiddleware;
