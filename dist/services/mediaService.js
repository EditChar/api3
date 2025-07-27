"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const AWS = __importStar(require("aws-sdk"));
const sharp = require("sharp");
const crypto = __importStar(require("crypto"));
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
// Enterprise AWS S3 Configuration with proper error handling
const AWS_REGION = process.env.AWS_REGION || 'eu-north-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
// Validate AWS credentials on startup
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials missing in environment variables');
    console.error('   Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    throw new Error('AWS credentials not configured');
}
// AWS S3 Configuration with enterprise settings
const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
    apiVersion: '2006-03-01',
    maxRetries: 3,
    retryDelayOptions: {
        customBackoff: function (retryCount) {
            return Math.pow(2, retryCount) * 100; // Exponential backoff
        }
    },
    httpOptions: {
        timeout: 30000, // 30 seconds
        connectTimeout: 5000 // 5 seconds
    },
    s3ForcePathStyle: false, // Use virtual hosted-style URLs
    signatureVersion: 'v4'
});
// Log AWS configuration on startup
console.log('🎯 AWS S3 Configuration:');
console.log(`   Region: ${AWS_REGION}`);
console.log(`   Access Key: ${AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
console.log(`   API Version: 2006-03-01`);
console.log(`   Signature Version: v4`);
// Configuration from .env
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'easy-to-image-production';
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || 'https://d3g2enhf7ajexl.cloudfront.net';
const MEDIA_PREFIX = process.env.MEDIA_S3_PREFIX || 'chat-media';
const ENCRYPTION_KEY = process.env.MEDIA_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const EXPIRY_DAYS = parseInt(process.env.MEDIA_EXPIRY_DAYS || '30');
const MAX_FILE_SIZE = parseInt(process.env.MEDIA_MAX_FILE_SIZE || '10485760'); // 10MB
const ALLOWED_TYPES = (process.env.MEDIA_ALLOWED_TYPES || 'jpeg,jpg,png,gif,webp').split(',');
// Validate bucket access on startup
s3.headBucket({ Bucket: BUCKET_NAME }).promise()
    .then(() => {
    console.log(`✅ S3 bucket access verified: ${BUCKET_NAME}`);
})
    .catch((error) => {
    console.error(`❌ S3 bucket access failed: ${BUCKET_NAME}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    if (error.code === 'Forbidden') {
        console.error('   💡 Check IAM permissions for this bucket');
    }
});
// Media processing configurations
const MEDIA_SIZES = {
    thumbnail: { width: 150, height: 150, quality: 70 },
    medium: { width: 800, height: 800, quality: 85 },
    original: { width: 1920, height: 1920, quality: 90 }
};
// Encryption algorithm
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
class MediaService {
    static getInstance() {
        if (!MediaService.instance) {
            MediaService.instance = new MediaService();
            // Log configuration on first initialization
            console.log('🎯 MediaService Configuration:');
            console.log(`   Bucket: ${BUCKET_NAME}`);
            console.log(`   Prefix: ${MEDIA_PREFIX}/`);
            console.log(`   Max Size: ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`);
            console.log(`   Allowed Types: ${ALLOWED_TYPES.join(', ')}`);
            console.log(`   Expiry Days: ${EXPIRY_DAYS}`);
            console.log(`   Encryption: ${ENCRYPTION_KEY ? 'Configured' : 'Missing!'}`);
        }
        return MediaService.instance;
    }
    /**
     * Generate presigned URL for direct S3 upload
     */
    async generatePresignedUpload(userId, chatRoomId, contentType, fileSize) {
        try {
            // Validate user access to chat room
            const roomAccess = await this.validateChatRoomAccess(userId, chatRoomId);
            if (!roomAccess) {
                return {
                    success: false,
                    error: 'Access denied to chat room'
                };
            }
            // Validate file type using allowed types from .env
            if (!contentType.startsWith('image/')) {
                return {
                    success: false,
                    error: 'Only image files are allowed'
                };
            }
            // Extract file extension from content type (e.g., 'image/jpeg' -> 'jpeg')
            const fileExtension = contentType.split('/')[1]?.toLowerCase();
            if (!fileExtension || !ALLOWED_TYPES.includes(fileExtension)) {
                return {
                    success: false,
                    error: `File type not allowed. Supported types: ${ALLOWED_TYPES.join(', ')}`
                };
            }
            // Validate file size using max file size from .env
            if (fileSize > MAX_FILE_SIZE) {
                const maxSizeMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
                return {
                    success: false,
                    error: `File size exceeds maximum allowed (${maxSizeMB}MB)`
                };
            }
            const mediaId = (0, uuid_1.v4)();
            const s3Key = `${MEDIA_PREFIX}/${chatRoomId}/${mediaId}/original`;
            // Generate unique encryption IV
            const encryptionIv = crypto.randomBytes(16).toString('hex');
            // Create presigned PUT URL (simplified - no metadata to avoid signature issues)
            const presignedUrl = s3.getSignedUrl('putObject', {
                Bucket: BUCKET_NAME,
                Key: s3Key,
                ContentType: contentType,
                Expires: 300 // 5 minutes
            });
            console.log('✅ S3 Presigned PUT URL generated (simplified):', {
                mediaId,
                bucket: BUCKET_NAME,
                key: s3Key,
                url: presignedUrl.substring(0, 100) + '...',
                contentType,
                signatureType: 'AWS4-HMAC-SHA256-SIMPLIFIED',
                expires: '300s (5min)'
            });
            // Store media metadata in database
            console.log('💾 [MediaService] Database insert yapılıyor:', {
                mediaId,
                userId,
                chatRoomId,
                s3Key,
                contentType,
                fileSize,
                status: 'uploading'
            });
            await database_1.default.query(`
        INSERT INTO chat_media (
          media_id, user_id, chat_room_id, s3_key, content_type, 
          file_size, encryption_iv, status, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
                mediaId,
                userId,
                chatRoomId,
                s3Key,
                contentType,
                fileSize,
                encryptionIv,
                'uploading',
                new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)
            ]);
            console.log('✅ [MediaService] Database insert başarılı:', { mediaId });
            return {
                success: true,
                uploadUrl: presignedUrl,
                mediaId: mediaId,
                method: 'PUT', // Frontend için method bilgisi
                contentType: contentType
            };
        }
        catch (error) {
            console.error('Failed to generate presigned upload:', error);
            return {
                success: false,
                error: 'Failed to generate upload URL'
            };
        }
    }
    /**
     * Complete media upload - process and encrypt
     */
    async completeMediaUpload(mediaId, userId, eTag, fileSize) {
        try {
            console.log('🔧 [MediaService] Complete upload başlatıldı:', { mediaId, userId, eTag, fileSize });
            // Get media metadata
            const mediaResult = await database_1.default.query(`
        SELECT * FROM chat_media 
        WHERE media_id = $1 AND user_id = $2 AND status = 'uploading'
      `, [mediaId, userId]);
            console.log('📊 [MediaService] Database query result:', {
                found: mediaResult.rows.length,
                mediaId,
                userId
            });
            if (mediaResult.rows.length === 0) {
                // Debug: Check if media exists with different status
                const debugResult = await database_1.default.query(`
          SELECT media_id, user_id, status FROM chat_media WHERE media_id = $1
        `, [mediaId]);
                console.log('🔍 [MediaService] Media debug info:', {
                    mediaId,
                    allStatuses: debugResult.rows
                });
                return {
                    success: false,
                    error: 'Media not found or already processed'
                };
            }
            const mediaData = mediaResult.rows[0];
            // Enterprise S3 metadata verification with enhanced error handling
            console.log('🔍 [MediaService] S3 object metadata verification starting:', {
                bucket: BUCKET_NAME,
                key: mediaData.s3_key,
                region: AWS_REGION
            });
            try {
                const headObject = await s3.headObject({
                    Bucket: BUCKET_NAME,
                    Key: mediaData.s3_key
                }).promise();
                const s3ETag = headObject.ETag?.replace(/"/g, '');
                const s3FileSize = headObject.ContentLength;
                const clientETag = (eTag || '').replace(/"/g, '');
                console.log('✅ [MediaService] S3 metadata retrieved successfully:', {
                    mediaId,
                    s3: {
                        eTag: s3ETag,
                        fileSize: s3FileSize,
                        lastModified: headObject.LastModified,
                        contentType: headObject.ContentType
                    },
                    client: {
                        eTag: clientETag,
                        fileSize
                    }
                });
                // Enhanced ETag comparison with multiple format support
                const eTagsMatch = s3ETag === clientETag ||
                    s3ETag === `"${clientETag}"` ||
                    `"${s3ETag}"` === clientETag ||
                    s3ETag?.toLowerCase() === clientETag?.toLowerCase();
                if (!eTagsMatch || s3FileSize !== fileSize) {
                    console.warn('⚠️ [MediaService] S3 metadata mismatch detected:', {
                        mediaId,
                        eTagMatch: eTagsMatch,
                        fileSizeMatch: s3FileSize === fileSize,
                        client: { eTag: clientETag, fileSize },
                        s3: { eTag: s3ETag, fileSize: s3FileSize }
                    });
                    return { success: false, error: 'S3 metadata mismatch' };
                }
                console.log('✅ [MediaService] S3 metadata verification passed');
            }
            catch (s3Error) {
                console.error('❌ [MediaService] S3 metadata verification failed:', {
                    mediaId,
                    error: s3Error.message,
                    code: s3Error.code,
                    statusCode: s3Error.statusCode,
                    requestId: s3Error.requestId,
                    region: s3Error.region
                });
                if (s3Error.code === 'Forbidden' || s3Error.statusCode === 403) {
                    console.error('🚨 [MediaService] AWS IAM Permissions Issue Detected:');
                    console.error('   The IAM user/role lacks required S3 permissions');
                    console.error('   Required permissions: s3:HeadObject, s3:GetObject');
                    console.error(`   Resource: arn:aws:s3:::${BUCKET_NAME}/*`);
                    console.error(`   IAM User: ${AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
                }
                return {
                    success: false,
                    error: `S3 access denied: ${s3Error.message}. Check IAM permissions.`
                };
            }
            // Download original from S3 with enhanced error handling
            console.log('📥 [MediaService] Downloading original file from S3:', {
                bucket: BUCKET_NAME,
                key: mediaData.s3_key
            });
            let originalObject;
            try {
                originalObject = await s3.getObject({
                    Bucket: BUCKET_NAME,
                    Key: mediaData.s3_key
                }).promise();
            }
            catch (downloadError) {
                console.error('❌ [MediaService] S3 file download failed:', {
                    mediaId,
                    error: downloadError.message,
                    code: downloadError.code,
                    statusCode: downloadError.statusCode
                });
                return {
                    success: false,
                    error: `Failed to download file: ${downloadError.message}`
                };
            }
            if (!originalObject.Body) {
                throw new Error('Downloaded file has no body content');
            }
            // Convert S3 Body to Buffer (supports Uint8Array, Buffer, stream)
            const originalBuffer = Buffer.isBuffer(originalObject.Body)
                ? originalObject.Body
                : Buffer.from(originalObject.Body);
            console.log('✅ [MediaService] File downloaded successfully:', {
                size: originalBuffer.length,
                contentType: originalObject.ContentType
            });
            // Process and encrypt different sizes
            const encryptionResult = await this.processAndEncryptImages(originalBuffer, mediaData.encryption_iv);
            // Upload encrypted versions to S3
            const urls = await this.uploadEncryptedMedia(mediaId, mediaData.chat_room_id, encryptionResult.encryptedImages);
            // Update database with completion status
            await database_1.default.query(`
        UPDATE chat_media 
        SET status = 'completed', 
            urls = $2,
            auth_tag = $3,
            processed_at = NOW()
        WHERE media_id = $1
      `, [
                mediaId,
                JSON.stringify(urls),
                encryptionResult.authTag
            ]);
            // Generate presigned download URLs
            const presignedUrls = await this.generatePresignedDownloadUrls(urls);
            console.log('🎉 [MediaService] Media processing completed successfully:', {
                mediaId,
                processedSizes: Object.keys(urls),
                hasPresignedUrls: Object.keys(presignedUrls).length > 0
            });
            return {
                success: true,
                mediaId: mediaId,
                urls: presignedUrls,
                expiresAt: new Date(mediaData.expires_at)
            };
        }
        catch (error) {
            console.error('Failed to complete media upload:', error);
            // Mark as failed
            await database_1.default.query(`
        UPDATE chat_media SET status = 'failed' WHERE media_id = $1
      `, [mediaId]);
            return {
                success: false,
                error: 'Failed to process media upload'
            };
        }
    }
    /**
     * Get media URLs with presigned access
     */
    async getMediaUrls(mediaId, userId) {
        console.log('🔍 [MediaService] getMediaUrls başlatıldı:', { mediaId, userId });
        try {
            // Check user access to this media
            const mediaResult = await database_1.default.query(`
        SELECT cm.*, 
               CASE 
                 WHEN cr.user1_id = $2 OR cr.user2_id = $2 THEN true 
                 ELSE false 
               END as has_access
        FROM chat_media cm
        JOIN chats cr ON cr.id = cm.chat_room_id
        WHERE cm.media_id = $1 AND cm.status = 'completed'
      `, [mediaId, userId]);
            console.log('📊 [MediaService] Media access query result:', {
                mediaId,
                userId,
                found: mediaResult.rows.length,
                hasAccess: mediaResult.rows[0]?.has_access
            });
            if (mediaResult.rows.length === 0 || !mediaResult.rows[0].has_access) {
                console.warn('❌ [MediaService] Media not found or access denied:', {
                    mediaId,
                    userId,
                    found: mediaResult.rows.length,
                    hasAccess: mediaResult.rows[0]?.has_access
                });
                return {
                    success: false,
                    error: 'Media not found or access denied'
                };
            }
            const mediaData = mediaResult.rows[0];
            console.log('📋 [MediaService] Media data retrieved:', {
                mediaId,
                status: mediaData.status,
                expiresAt: mediaData.expires_at,
                hasUrls: !!mediaData.urls
            });
            // Check expiration
            if (new Date(mediaData.expires_at) < new Date()) {
                console.warn('⏰ [MediaService] Media has expired:', {
                    mediaId,
                    expiresAt: mediaData.expires_at,
                    now: new Date().toISOString()
                });
                return {
                    success: false,
                    error: 'Media has expired'
                };
            }
            const urls = JSON.parse(mediaData.urls || '{}');
            console.log('🔗 [MediaService] Parsed URLs from database:', {
                mediaId,
                urls,
                urlKeys: Object.keys(urls)
            });
            const presignedUrls = await this.generatePresignedDownloadUrls(urls);
            console.log('✅ [MediaService] getMediaUrls başarılı:', {
                mediaId,
                hasPresignedUrls: !!(presignedUrls.thumbnail && presignedUrls.medium && presignedUrls.original),
                urlLengths: {
                    thumbnail: presignedUrls.thumbnail?.length || 0,
                    medium: presignedUrls.medium?.length || 0,
                    original: presignedUrls.original?.length || 0
                }
            });
            return {
                success: true,
                mediaId: mediaId,
                urls: presignedUrls,
                expiresAt: new Date(mediaData.expires_at)
            };
        }
        catch (error) {
            console.error('❌ [MediaService] Failed to get media URLs:', {
                mediaId,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            return {
                success: false,
                error: 'Failed to get media URLs'
            };
        }
    }
    /**
     * Delete media and invalidate URLs
     */
    async deleteMedia(mediaId, userId) {
        try {
            // Verify ownership
            const mediaResult = await database_1.default.query(`
        SELECT * FROM chat_media 
        WHERE media_id = $1 AND user_id = $2 AND status != 'deleted'
      `, [mediaId, userId]);
            if (mediaResult.rows.length === 0) {
                return {
                    success: false,
                    error: 'Media not found or access denied'
                };
            }
            const mediaData = mediaResult.rows[0];
            const urls = JSON.parse(mediaData.urls || '{}');
            // Delete from S3
            const deletePromises = [];
            // Original file
            deletePromises.push(s3.deleteObject({
                Bucket: BUCKET_NAME,
                Key: mediaData.s3_key
            }).promise());
            // Encrypted versions
            for (const [sizeName, s3Key] of Object.entries(urls)) {
                if (s3Key) {
                    deletePromises.push(s3.deleteObject({
                        Bucket: BUCKET_NAME,
                        Key: s3Key
                    }).promise());
                }
            }
            await Promise.all(deletePromises);
            // Mark as deleted in database
            await database_1.default.query(`
        UPDATE chat_media 
        SET status = 'deleted', deleted_at = NOW()
        WHERE media_id = $1
      `, [mediaId]);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to delete media:', error);
            return {
                success: false,
                error: 'Failed to delete media'
            };
        }
    }
    /**
     * Cleanup expired media (called by worker)
     */
    async cleanupExpiredMedia() {
        try {
            const expiredMedia = await database_1.default.query(`
        SELECT media_id, s3_key, urls, user_id FROM chat_media 
        WHERE expires_at < NOW() AND status != 'deleted'
      `);
            let cleanedCount = 0;
            for (const media of expiredMedia.rows) {
                try {
                    const urls = JSON.parse(media.urls || '{}');
                    // Delete from S3
                    const deletePromises = [];
                    // Original file
                    deletePromises.push(s3.deleteObject({
                        Bucket: BUCKET_NAME,
                        Key: media.s3_key
                    }).promise());
                    // Encrypted versions
                    for (const [sizeName, s3Key] of Object.entries(urls)) {
                        if (s3Key) {
                            deletePromises.push(s3.deleteObject({
                                Bucket: BUCKET_NAME,
                                Key: s3Key
                            }).promise());
                        }
                    }
                    await Promise.all(deletePromises);
                    // Mark as deleted in database
                    await database_1.default.query(`
            UPDATE chat_media 
            SET status = 'deleted', deleted_at = NOW()
            WHERE media_id = $1
          `, [media.media_id]);
                    cleanedCount++;
                }
                catch (error) {
                    console.error(`Failed to cleanup media ${media.media_id}:`, error);
                }
            }
            console.log(`✅ Cleaned up ${cleanedCount} expired media files out of ${expiredMedia.rows.length} found`);
        }
        catch (error) {
            console.error('❌ Failed to cleanup expired media:', error);
        }
    }
    /**
     * Private helper methods
     */
    async validateChatRoomAccess(userId, chatRoomId) {
        try {
            const result = await database_1.default.query(`
        SELECT id FROM chats 
        WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = 'active'
      `, [chatRoomId, userId]);
            return result.rows.length > 0;
        }
        catch (error) {
            console.error('Failed to validate chat room access:', error);
            return false;
        }
    }
    async processAndEncryptImages(originalBuffer, encryptionIv) {
        const encryptedImages = {};
        let authTag = '';
        for (const [sizeName, config] of Object.entries(MEDIA_SIZES)) {
            // Resize image with Sharp
            const resizedBuffer = await sharp(originalBuffer)
                .resize(config.width, config.height, {
                fit: 'inside',
                withoutEnlargement: true
            })
                .jpeg({ quality: config.quality })
                .toBuffer();
            // Create a new cipher for each size to avoid reuse errors
            const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(encryptionIv, 'hex'));
            cipher.setAAD(Buffer.from(encryptionIv, 'hex'));
            const encrypted = Buffer.concat([cipher.update(resizedBuffer), cipher.final()]);
            if (sizeName === 'original') {
                authTag = cipher.getAuthTag().toString('hex');
            }
            encryptedImages[sizeName] = encrypted;
        }
        return { encryptedImages, authTag };
    }
    async uploadEncryptedMedia(mediaId, chatRoomId, encryptedImages) {
        const uploadPromises = [];
        for (const [sizeName, imageBuffer] of Object.entries(encryptedImages)) {
            const s3Key = `${MEDIA_PREFIX}/${chatRoomId}/${mediaId}/${sizeName}_encrypted.jpg`;
            const uploadPromise = s3.upload({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: imageBuffer,
                ContentType: 'application/octet-stream', // Encrypted binary
                CacheControl: 'private, max-age=2592000', // 30 days
                Metadata: {
                    mediaId,
                    size: sizeName,
                    encrypted: 'true',
                    uploadDate: new Date().toISOString()
                },
                StorageClass: 'STANDARD'
            }).promise().then(() => ({ size: sizeName, key: s3Key }));
            uploadPromises.push(uploadPromise);
        }
        const uploadResults = await Promise.all(uploadPromises);
        const urls = {};
        uploadResults.forEach(result => {
            urls[result.size] = result.key;
        });
        return urls;
    }
    async generatePresignedDownloadUrls(s3Keys) {
        const presignedUrls = {};
        console.log('🔗 [MediaService] Presigned URL generation başlatıldı:', {
            s3Keys,
            bucket: BUCKET_NAME
        });
        for (const [sizeName, s3Key] of Object.entries(s3Keys)) {
            if (s3Key) {
                try {
                    const presignedUrl = s3.getSignedUrl('getObject', {
                        Bucket: BUCKET_NAME,
                        Key: s3Key,
                        Expires: 7 * 24 * 60 * 60 // 7 days
                    });
                    presignedUrls[sizeName] = presignedUrl;
                    console.log(`✅ [MediaService] Presigned URL oluşturuldu - ${sizeName}:`, {
                        s3Key,
                        urlLength: presignedUrl.length,
                        urlPreview: presignedUrl.substring(0, 100) + '...'
                    });
                }
                catch (error) {
                    console.error(`❌ [MediaService] Presigned URL oluşturma hatası - ${sizeName}:`, {
                        s3Key,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
            else {
                console.warn(`⚠️ [MediaService] S3 key boş - ${sizeName}`);
            }
        }
        // Ensure all required URLs are present, use original as fallback if needed
        const result = {
            thumbnail: presignedUrls.thumbnail || presignedUrls.original || '',
            medium: presignedUrls.medium || presignedUrls.original || '',
            original: presignedUrls.original || ''
        };
        console.log('🎯 [MediaService] Presigned URL generation tamamlandı:', {
            resultUrls: {
                thumbnail: result.thumbnail ? `${result.thumbnail.substring(0, 50)}...` : 'EMPTY',
                medium: result.medium ? `${result.medium.substring(0, 50)}...` : 'EMPTY',
                original: result.original ? `${result.original.substring(0, 50)}...` : 'EMPTY'
            },
            allUrlsPresent: !!(result.thumbnail && result.medium && result.original)
        });
        return result;
    }
}
exports.MediaService = MediaService;
exports.default = MediaService;
