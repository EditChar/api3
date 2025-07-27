"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const mediaController_1 = require("../controllers/mediaController");
const router = (0, express_1.Router)();
/**
 * Enterprise Media Routes
 * All routes require authentication for security
 */
// Health check endpoint
router.get('/health', authMiddleware_1.authMiddleware, mediaController_1.mediaHealthCheck);
// Generate presigned URL for direct S3 upload
router.post('/presign', authMiddleware_1.authMiddleware, mediaController_1.generatePresignedUpload);
// Complete media upload after S3 upload
router.post('/complete', authMiddleware_1.authMiddleware, mediaController_1.completeMediaUpload);
// Get media URLs with presigned access
router.get('/:mediaId', authMiddleware_1.authMiddleware, mediaController_1.getMediaUrls);
// Delete media and invalidate URLs
router.delete('/:mediaId', authMiddleware_1.authMiddleware, mediaController_1.deleteMedia);
exports.default = router;
