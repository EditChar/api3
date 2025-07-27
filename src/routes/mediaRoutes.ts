import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  generatePresignedUpload,
  completeMediaUpload,
  getMediaUrls,
  deleteMedia,
  mediaHealthCheck
} from '../controllers/mediaController';

const router = Router();

/**
 * Enterprise Media Routes
 * All routes require authentication for security
 */

// Health check endpoint
router.get('/health', authMiddleware, mediaHealthCheck);

// Generate presigned URL for direct S3 upload
router.post('/presign', authMiddleware, generatePresignedUpload);

// Complete media upload after S3 upload
router.post('/complete', authMiddleware, completeMediaUpload);

// Get media URLs with presigned access
router.get('/:mediaId', authMiddleware, getMediaUrls);

// Delete media and invalidate URLs
router.delete('/:mediaId', authMiddleware, deleteMedia);

export default router; 