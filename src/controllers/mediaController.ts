import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import MediaService from '../services/mediaService';
import { 
  MediaUploadRequest, 
  MediaUploadResponse, 
  MediaCompleteRequest, 
  MediaCompleteResponse,
  MediaUrlsResponse,
  MediaDeleteResponse 
} from '../models/Media';
import { body, param, validationResult } from 'express-validator';
import SocketManager from '../config/socket';
import pool from '../config/database';

const mediaService = MediaService.getInstance();

/**
 * Generate presigned URL for media upload
 * POST /api/media/presign
 */
export const generatePresignedUpload = [
  // Validation middleware
  body('chatRoomId').notEmpty().withMessage('Chat room ID is required'),
  body('contentType').isString().matches(/^image\//).withMessage('Content type must be an image'),
  body('fileSize').isInt({ min: 1, max: 10485760 }).withMessage('File size must be between 1 byte and 10MB'),
  body('originalFilename').optional().isLength({ max: 500 }).withMessage('Filename too long'),

  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        correlationId
      });
      return;
    }

    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Media presign validation failed:', {
        correlationId,
        userId,
        requestBody: req.body,
        validationErrors: errors.array(),
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        }
      });
      
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        correlationId
      });
      return;
    }

    try {
      const { chatRoomId, contentType, fileSize, originalFilename }: MediaUploadRequest = req.body;

      console.log('Media presign request:', {
        correlationId,
        userId,
        chatRoomId,
        contentType,
        fileSize
      });

      const result = await mediaService.generatePresignedUpload(
        userId,
        chatRoomId,
        contentType,
        fileSize
      );

      const response: MediaUploadResponse = {
        success: result.success,
        mediaId: result.mediaId,
        uploadUrl: result.uploadUrl,
        fields: result.fields,
        method: result.method, // PUT method bilgisi
        contentType: result.contentType, // Content type bilgisi
        error: result.error,
        isDuplicate: result.isDuplicate,
        originalMediaId: result.originalMediaId
      };

      if (result.success) {
        console.log('✅ Media presign successful:', {
          correlationId,
          mediaId: result.mediaId,
          method: result.method + ' (backend)',
          contentType: result.contentType + ' (backend)',
          hasUploadUrl: !!result.uploadUrl,
          isDuplicate: result.isDuplicate || false,
          originalMediaId: result.originalMediaId,
          backendCompatibility: 'NEW_FORMAT',
          duration: Date.now() - startTime
        });
        res.status(200).json(response);
      } else {
        console.warn('Media presign failed:', {
          correlationId,
          error: result.error,
          duration: Date.now() - startTime
        });
        res.status(400).json(response);
      }

    } catch (error) {
      console.error('Media presign error:', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        duration: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        correlationId
      });
    }
  }
];

/**
 * Complete media upload after S3 upload
 * POST /api/media/complete
 */
export const completeMediaUpload = [
  body('mediaId').isUUID().withMessage('Valid media ID is required'),
  body('eTag').isString().notEmpty().withMessage('ETag is required'),
  body('fileSize').isInt({ min: 1 }).withMessage('File size is required'),

  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        correlationId
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        correlationId
      });
      return;
    }

    try {
      const { mediaId, eTag, fileSize }: MediaCompleteRequest = req.body;

      console.log('Media complete request:', {
        correlationId,
        userId,
        mediaId,
        eTag,
        fileSize
      });

      const result = await mediaService.completeMediaUpload(mediaId, userId, eTag, fileSize);

      const response: MediaCompleteResponse = {
        success: result.success,
        mediaId: result.mediaId,
        urls: result.urls,
        expiresAt: result.expiresAt,
        error: result.error
      };

      if (result.success) {
        console.log('Media upload completed:', {
          correlationId,
          mediaId,
          duration: Date.now() - startTime
        });
        res.status(200).json(response);
      } else {
        console.warn('Media upload completion failed:', {
          correlationId,
          mediaId,
          error: result.error,
          duration: Date.now() - startTime
        });
        res.status(400).json(response);
      }

    } catch (error) {
      console.error('Media complete error:', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        duration: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        correlationId
      });
    }
  }
];

/**
 * Get media URLs with presigned access
 * GET /api/media/:mediaId
 */
export const getMediaUrls = [
  param('mediaId').isUUID().withMessage('Valid media ID is required'),

  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        correlationId
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        correlationId
      });
      return;
    }

    try {
      const mediaId = req.params.mediaId;

      console.log('🔍 [MediaController] Media URLs request:', {
        correlationId,
        userId,
        mediaId,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      const result = await mediaService.getMediaUrls(mediaId, userId);

      console.log('📊 [MediaController] MediaService result:', {
        correlationId,
        mediaId,
        success: result.success,
        hasUrls: !!(result.urls?.thumbnail && result.urls?.medium && result.urls?.original),
        error: result.error
      });

      const response: MediaUrlsResponse = {
        success: result.success,
        mediaId: result.mediaId,
        urls: result.urls,
        expiresAt: result.expiresAt,
        error: result.error
      };

      if (result.success) {
        console.log('✅ [MediaController] Media URLs retrieved successfully:', {
          correlationId,
          mediaId,
          urlsPresent: {
            thumbnail: !!result.urls?.thumbnail,
            medium: !!result.urls?.medium,
            original: !!result.urls?.original
          },
          duration: Date.now() - startTime
        });
        res.status(200).json(response);
      } else {
        console.warn('❌ [MediaController] Media URLs retrieval failed:', {
          correlationId,
          mediaId,
          error: result.error,
          duration: Date.now() - startTime
        });
        res.status(404).json(response);
      }

    } catch (error) {
      console.error('💥 [MediaController] Media URLs error:', {
        correlationId,
        mediaId: req.params.mediaId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        correlationId
      });
    }
  }
];

/**
 * Delete media and invalidate URLs
 * DELETE /api/media/:mediaId
 */
export const deleteMedia = [
  param('mediaId').isUUID().withMessage('Valid media ID is required'),

  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        correlationId
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        correlationId
      });
      return;
    }

    try {
      const mediaId = req.params.mediaId;

      console.log('Media delete request:', {
        correlationId,
        userId,
        mediaId
      });

      const result = await mediaService.deleteMedia(mediaId, userId);

      const response: MediaDeleteResponse = {
        success: result.success,
        error: result.error
      };

      if (result.success) {
        console.log('Media deleted successfully:', {
          correlationId,
          mediaId,
          duration: Date.now() - startTime
        });

        // 🔄 REALTIME MEDIA DELETION EVENT
        try {
          // Get message info for socket event
          const messageResult = await pool.query(`
            SELECT m.id as message_id, m.chat_room_id, cr.user1_id, cr.user2_id
            FROM messages m
            JOIN chats cr ON cr.id = m.chat_room_id
            WHERE m.content = $1 AND m.sender_id = $2
            ORDER BY m.created_at DESC
            LIMIT 1
          `, [`media:${mediaId}`, userId]);

          if (messageResult.rows.length > 0) {
            const messageData = messageResult.rows[0];
            const otherUserId = messageData.user1_id === userId ? messageData.user2_id : messageData.user1_id;
            
            const socketEvent = {
              messageId: messageData.message_id,
              roomId: messageData.chat_room_id,
              status: 'deleted',
              isDeleted: true,
              userId: userId,
              mediaId: mediaId
            };

            console.log('📡 [Media Delete] Sending realtime event:', {
              correlationId,
              event: 'message_status_updated',
              targetUser: otherUserId,
              messageId: messageData.message_id,
              roomId: messageData.chat_room_id
            });

            // Send to other user in the room
            await SocketManager.getInstance().sendToUser(otherUserId, 'message_status_updated', socketEvent);
            
            console.log('✅ [Media Delete] Realtime event sent successfully');
          } else {
            console.warn('⚠️ [Media Delete] Message not found for realtime event:', {
              correlationId,
              mediaId,
              userId
            });
          }
        } catch (socketError) {
          console.error('❌ [Media Delete] Failed to send realtime event:', {
            correlationId,
            mediaId,
            error: socketError instanceof Error ? socketError.message : 'Unknown socket error'
          });
          // Don't fail the response - media was deleted successfully
        }

        res.status(200).json(response);
      } else {
        console.warn('Media deletion failed:', {
          correlationId,
          mediaId,
          error: result.error,
          duration: Date.now() - startTime
        });
        res.status(400).json(response);
      }

    } catch (error) {
      console.error('Media delete error:', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        duration: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        correlationId
      });
    }
  }
];

/**
 * Health check for media service
 * GET /api/media/health
 */
export const mediaHealthCheck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Basic health check - could be expanded to check S3 connectivity
    res.status(200).json({
      status: 'healthy',
      service: 'media',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'media',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}; 