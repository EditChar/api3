"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaHealthCheck = exports.deleteMedia = exports.getMediaUrls = exports.completeMediaUpload = exports.generatePresignedUpload = void 0;
const mediaService_1 = __importDefault(require("../services/mediaService"));
const express_validator_1 = require("express-validator");
const mediaService = mediaService_1.default.getInstance();
/**
 * Generate presigned URL for media upload
 * POST /api/media/presign
 */
exports.generatePresignedUpload = [
    // Validation middleware
    (0, express_validator_1.body)('chatRoomId').notEmpty().withMessage('Chat room ID is required'),
    (0, express_validator_1.body)('contentType').isString().matches(/^image\//).withMessage('Content type must be an image'),
    (0, express_validator_1.body)('fileSize').isInt({ min: 1, max: 10485760 }).withMessage('File size must be between 1 byte and 10MB'),
    (0, express_validator_1.body)('originalFilename').optional().isLength({ max: 500 }).withMessage('Filename too long'),
    async (req, res) => {
        const correlationId = req.correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        const errors = (0, express_validator_1.validationResult)(req);
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
            const { chatRoomId, contentType, fileSize, originalFilename } = req.body;
            console.log('Media presign request:', {
                correlationId,
                userId,
                chatRoomId,
                contentType,
                fileSize
            });
            const result = await mediaService.generatePresignedUpload(userId, chatRoomId, contentType, fileSize);
            const response = {
                success: result.success,
                mediaId: result.mediaId,
                uploadUrl: result.uploadUrl,
                fields: result.fields,
                method: result.method, // PUT method bilgisi
                contentType: result.contentType, // Content type bilgisi
                error: result.error
            };
            if (result.success) {
                console.log('✅ Media presign successful:', {
                    correlationId,
                    mediaId: result.mediaId,
                    method: result.method + ' (backend)',
                    contentType: result.contentType + ' (backend)',
                    hasUploadUrl: !!result.uploadUrl,
                    backendCompatibility: 'NEW_FORMAT',
                    duration: Date.now() - startTime
                });
                res.status(200).json(response);
            }
            else {
                console.warn('Media presign failed:', {
                    correlationId,
                    error: result.error,
                    duration: Date.now() - startTime
                });
                res.status(400).json(response);
            }
        }
        catch (error) {
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
exports.completeMediaUpload = [
    (0, express_validator_1.body)('mediaId').isUUID().withMessage('Valid media ID is required'),
    (0, express_validator_1.body)('eTag').isString().notEmpty().withMessage('ETag is required'),
    (0, express_validator_1.body)('fileSize').isInt({ min: 1 }).withMessage('File size is required'),
    async (req, res) => {
        const correlationId = req.correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        const errors = (0, express_validator_1.validationResult)(req);
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
            const { mediaId, eTag, fileSize } = req.body;
            console.log('Media complete request:', {
                correlationId,
                userId,
                mediaId,
                eTag,
                fileSize
            });
            const result = await mediaService.completeMediaUpload(mediaId, userId, eTag, fileSize);
            const response = {
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
            }
            else {
                console.warn('Media upload completion failed:', {
                    correlationId,
                    mediaId,
                    error: result.error,
                    duration: Date.now() - startTime
                });
                res.status(400).json(response);
            }
        }
        catch (error) {
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
exports.getMediaUrls = [
    (0, express_validator_1.param)('mediaId').isUUID().withMessage('Valid media ID is required'),
    async (req, res) => {
        const correlationId = req.correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        const errors = (0, express_validator_1.validationResult)(req);
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
            const response = {
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
            }
            else {
                console.warn('❌ [MediaController] Media URLs retrieval failed:', {
                    correlationId,
                    mediaId,
                    error: result.error,
                    duration: Date.now() - startTime
                });
                res.status(404).json(response);
            }
        }
        catch (error) {
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
exports.deleteMedia = [
    (0, express_validator_1.param)('mediaId').isUUID().withMessage('Valid media ID is required'),
    async (req, res) => {
        const correlationId = req.correlationId || `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        const errors = (0, express_validator_1.validationResult)(req);
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
            const response = {
                success: result.success,
                error: result.error
            };
            if (result.success) {
                console.log('Media deleted successfully:', {
                    correlationId,
                    mediaId,
                    duration: Date.now() - startTime
                });
                res.status(200).json(response);
            }
            else {
                console.warn('Media deletion failed:', {
                    correlationId,
                    mediaId,
                    error: result.error,
                    duration: Date.now() - startTime
                });
                res.status(400).json(response);
            }
        }
        catch (error) {
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
const mediaHealthCheck = async (req, res) => {
    try {
        // Basic health check - could be expanded to check S3 connectivity
        res.status(200).json({
            status: 'healthy',
            service: 'media',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'media',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
};
exports.mediaHealthCheck = mediaHealthCheck;
