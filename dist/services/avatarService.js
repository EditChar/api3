"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarService = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const sharp_1 = __importDefault(require("sharp"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
// AWS S3 Configuration
const s3 = new aws_sdk_1.default.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'your-app-avatars';
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || 'https://d123abc456.cloudfront.net';
// Avatar dimensions for different use cases
const AVATAR_SIZES = {
    thumbnail: { width: 50, height: 50 },
    small: { width: 100, height: 100 },
    medium: { width: 200, height: 200 },
    large: { width: 400, height: 400 },
    original: { width: 1920, height: 1920 } // High-res for full-screen viewing
};
class AvatarService {
    /**
     * Calculate file hash for deduplication
     */
    calculateFileHash(buffer) {
        return crypto_1.default.createHash('sha256').update(buffer).digest('hex');
    }
    /**
     * Check if file already exists by hash
     */
    async checkFileExists(fileHash) {
        try {
            const result = await database_1.default.query('SELECT * FROM avatar_files WHERE file_hash = $1 ORDER BY created_at DESC LIMIT 1', [fileHash]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error checking file existence:', error);
            return null;
        }
    }
    /**
     * Generate optimized images in multiple sizes
     */
    async generateOptimizedImages(buffer) {
        const optimizedImages = {};
        for (const [sizeName, dimensions] of Object.entries(AVATAR_SIZES)) {
            try {
                optimizedImages[sizeName] = await (0, sharp_1.default)(buffer)
                    .resize(dimensions.width, dimensions.height, {
                    fit: sizeName === 'original' ? 'inside' : 'cover', // Original için crop yapma
                    position: 'center',
                    withoutEnlargement: true // Küçük resimleri büyütme
                })
                    .jpeg({
                    quality: sizeName === 'original' ? 95 : (sizeName === 'thumbnail' ? 70 : 85),
                    progressive: true
                })
                    .toBuffer();
            }
            catch (error) {
                console.error(`Error generating ${sizeName} image:`, error);
                // Fallback to original for this size
                optimizedImages[sizeName] = buffer;
            }
        }
        return optimizedImages;
    }
    /**
     * Upload files to S3
     */
    async uploadToS3(avatarId, optimizedImages, contentType) {
        const uploadPromises = [];
        for (const [sizeName, imageBuffer] of Object.entries(optimizedImages)) {
            const s3Key = `avatars/${avatarId}/${sizeName}.jpg`;
            const uploadPromise = s3.upload({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: imageBuffer,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000', // 1 year cache
                Metadata: {
                    avatarId,
                    size: sizeName,
                    uploadDate: new Date().toISOString(),
                    storageClass: 'STANDARD' // Will transition to STANDARD_IA after 7 days via lifecycle
                },
                Tagging: `Size=${sizeName}&Type=avatar&Status=active&UploadDate=${new Date().toISOString().split('T')[0]}`,
                StorageClass: 'STANDARD' // Start with STANDARD, lifecycle will optimize
            }).promise().then(() => ({ size: sizeName, key: s3Key }));
            uploadPromises.push(uploadPromise);
        }
        const uploadResults = await Promise.all(uploadPromises);
        // Generate CloudFront URLs
        const urls = {};
        uploadResults.forEach(result => {
            urls[result.size] = `${CLOUDFRONT_URL}/${result.key}`;
        });
        return urls;
    }
    /**
     * Save avatar record to database
     */
    async saveAvatarRecord(avatarId, userId, fileHash, fileSize, originalFilename, contentType, s3Key) {
        await database_1.default.query(`
      INSERT INTO avatar_files (
        id, user_id, file_hash, file_size, original_filename,
        content_type, s3_key, created_at, last_accessed_at, access_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)
    `, [avatarId, userId, fileHash, fileSize, originalFilename, contentType, s3Key]);
    }
    /**
     * Update user's avatar URL
     */
    async updateUserAvatar(userId, avatarId, urls) {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            // Get current avatar to potentially clean up later
            const currentResult = await client.query('SELECT avatar_id FROM users WHERE id = $1', [userId]);
            // Update user's avatar
            await client.query('UPDATE users SET avatar_id = $1, avatar_url = $2, last_active_at = NOW() WHERE id = $3', [avatarId, urls.medium, userId] // Use medium size as default avatar_url
            );
            // Schedule cleanup for old avatar if it exists and is different
            const oldAvatarId = currentResult.rows[0]?.avatar_id;
            if (oldAvatarId && oldAvatarId !== avatarId) {
                // Schedule background cleanup (implement cleanup service)
                await this.scheduleAvatarCleanup(oldAvatarId);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Schedule avatar cleanup for background processing
     */
    async scheduleAvatarCleanup(avatarId) {
        try {
            await database_1.default.query(`
        INSERT INTO avatar_cleanup_queue (avatar_id, scheduled_at, status)
        VALUES ($1, NOW() + INTERVAL '1 hour', 'pending')
        ON CONFLICT (avatar_id) DO UPDATE SET
        scheduled_at = NOW() + INTERVAL '1 hour',
        status = 'pending'
      `, [avatarId]);
        }
        catch (error) {
            console.error('Error scheduling avatar cleanup:', error);
            // Don't throw - cleanup failure shouldn't fail the main operation
        }
    }
    /**
     * Main upload function with enterprise features
     */
    async uploadAvatar(userId, fileBuffer, originalFilename, contentType) {
        const startTime = Date.now();
        console.log(`🚀 Starting avatar upload for user ${userId}`);
        try {
            // Step 1: Calculate file hash for deduplication
            const fileHash = this.calculateFileHash(fileBuffer);
            console.log(`📊 File hash calculated: ${fileHash.substring(0, 16)}...`);
            // Step 2: Check if file already exists
            const existingFile = await this.checkFileExists(fileHash);
            if (existingFile) {
                console.log(`♻️  Duplicate file detected, reusing existing avatar: ${existingFile.id}`);
                // Update access statistics
                await database_1.default.query('UPDATE avatar_files SET last_accessed_at = NOW(), access_count = access_count + 1 WHERE id = $1', [existingFile.id]);
                // Generate URLs for existing file
                const urls = {
                    thumbnail: `${CLOUDFRONT_URL}/avatars/${existingFile.id}/thumbnail.jpg`,
                    small: `${CLOUDFRONT_URL}/avatars/${existingFile.id}/small.jpg`,
                    medium: `${CLOUDFRONT_URL}/avatars/${existingFile.id}/medium.jpg`,
                    large: `${CLOUDFRONT_URL}/avatars/${existingFile.id}/large.jpg`,
                    original: `${CLOUDFRONT_URL}/avatars/${existingFile.id}/original.jpg`
                };
                // Update user's avatar
                await this.updateUserAvatar(userId, existingFile.id, urls);
                return {
                    success: true,
                    avatarId: existingFile.id,
                    urls,
                    isDuplicate: true,
                    existingAvatarId: existingFile.id
                };
            }
            // Step 3: Generate new avatar ID
            const avatarId = (0, uuid_1.v4)();
            console.log(`🆔 Generated new avatar ID: ${avatarId}`);
            // Step 4: Validate and optimize images
            console.log(`🖼️  Generating optimized images...`);
            const optimizedImages = await this.generateOptimizedImages(fileBuffer);
            // Step 5: Upload to S3
            console.log(`☁️  Uploading to S3...`);
            const urls = await this.uploadToS3(avatarId, optimizedImages, contentType);
            // Step 6: Save to database
            console.log(`💾 Saving to database...`);
            await this.saveAvatarRecord(avatarId, userId, fileHash, fileBuffer.length, originalFilename, contentType, `avatars/${avatarId}/original.jpg`);
            // Step 7: Update user record
            await this.updateUserAvatar(userId, avatarId, urls);
            const duration = Date.now() - startTime;
            console.log(`✅ Avatar upload completed in ${duration}ms`);
            return {
                success: true,
                avatarId,
                urls
            };
        }
        catch (error) {
            console.error('❌ Avatar upload failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    /**
     * Get avatar URLs by avatar ID
     */
    async getAvatarUrls(avatarId) {
        try {
            const result = await database_1.default.query('SELECT * FROM avatar_files WHERE id = $1', [avatarId]);
            if (result.rows.length === 0) {
                return null;
            }
            // Update access statistics
            await database_1.default.query('UPDATE avatar_files SET last_accessed_at = NOW(), access_count = access_count + 1 WHERE id = $1', [avatarId]);
            return {
                thumbnail: `${CLOUDFRONT_URL}/avatars/${avatarId}/thumbnail.jpg`,
                small: `${CLOUDFRONT_URL}/avatars/${avatarId}/small.jpg`,
                medium: `${CLOUDFRONT_URL}/avatars/${avatarId}/medium.jpg`,
                large: `${CLOUDFRONT_URL}/avatars/${avatarId}/large.jpg`,
                original: `${CLOUDFRONT_URL}/avatars/${avatarId}/original.jpg`
            };
        }
        catch (error) {
            console.error('Error getting avatar URLs:', error);
            return null;
        }
    }
    /**
     * Delete user avatar (marks for cleanup)
     */
    async deleteUserAvatar(userId) {
        try {
            const client = await database_1.default.connect();
            try {
                await client.query('BEGIN');
                // Get current avatar
                const result = await client.query('SELECT avatar_id FROM users WHERE id = $1', [userId]);
                if (result.rows.length === 0 || !result.rows[0].avatar_id) {
                    await client.query('ROLLBACK');
                    return true; // User has no avatar, consider as success
                }
                const avatarId = result.rows[0].avatar_id;
                // Remove avatar from user
                await client.query('UPDATE users SET avatar_id = NULL, avatar_url = NULL WHERE id = $1', [userId]);
                // Schedule cleanup
                await this.scheduleAvatarCleanup(avatarId);
                await client.query('COMMIT');
                return true;
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Error deleting user avatar:', error);
            return false;
        }
    }
    /**
     * Cleanup orphaned avatars (background service method)
     */
    async cleanupOrphanedAvatars() {
        console.log('🧹 Starting orphaned avatar cleanup...');
        try {
            // Find avatars scheduled for cleanup
            const result = await database_1.default.query(`
        SELECT avatar_id FROM avatar_cleanup_queue 
        WHERE status = 'pending' AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT 100
      `);
            for (const row of result.rows) {
                await this.cleanupSingleAvatar(row.avatar_id);
            }
            // Also cleanup avatars not referenced by any user (safety check)
            await this.cleanupUnreferencedAvatars();
        }
        catch (error) {
            console.error('Error during orphaned avatar cleanup:', error);
        }
    }
    /**
     * Cleanup single avatar from S3 and database (Enterprise soft-delete approach)
     */
    async cleanupSingleAvatar(avatarId) {
        try {
            // Check if still referenced by any user
            const userCheck = await database_1.default.query('SELECT COUNT(*) as count FROM users WHERE avatar_id = $1', [avatarId]);
            if (parseInt(userCheck.rows[0].count) > 0) {
                // Still in use, remove from cleanup queue
                await database_1.default.query('DELETE FROM avatar_cleanup_queue WHERE avatar_id = $1', [avatarId]);
                return;
            }
            // Enterprise soft-delete: First mark for deletion with tags
            for (const sizeName of Object.keys(AVATAR_SIZES)) {
                const s3Key = `avatars/${avatarId}/${sizeName}.jpg`;
                try {
                    // Tag as deleted (lifecycle will handle final deletion after 90 days)
                    await s3.putObjectTagging({
                        Bucket: BUCKET_NAME,
                        Key: s3Key,
                        Tagging: {
                            TagSet: [
                                { Key: 'Status', Value: 'deleted' },
                                { Key: 'DeletedDate', Value: new Date().toISOString().split('T')[0] },
                                { Key: 'Size', Value: sizeName },
                                { Key: 'Type', Value: 'avatar' }
                            ]
                        }
                    }).promise();
                    console.log(`🏷️  Tagged for deletion: ${s3Key}`);
                }
                catch (tagError) {
                    // If tagging fails, fall back to direct deletion
                    console.warn(`Failed to tag ${s3Key}, falling back to direct deletion`);
                    await s3.deleteObject({
                        Bucket: BUCKET_NAME,
                        Key: s3Key
                    }).promise().catch(error => {
                        console.warn(`Failed to delete S3 object ${s3Key}:`, error.message);
                    });
                }
            }
            // Update database record (soft delete)
            await database_1.default.query('UPDATE avatar_files SET last_accessed_at = NOW() - INTERVAL \'2 years\' WHERE id = $1', [avatarId]);
            // Remove from cleanup queue
            await database_1.default.query('UPDATE avatar_cleanup_queue SET status = $2, processed_at = NOW() WHERE avatar_id = $1', [avatarId, 'completed']);
            console.log(`🗑️  Soft-deleted avatar: ${avatarId}`);
        }
        catch (error) {
            console.error(`Error cleaning up avatar ${avatarId}:`, error);
            // Mark as failed for retry
            await database_1.default.query('UPDATE avatar_cleanup_queue SET status = $2, scheduled_at = NOW() + INTERVAL \'1 hour\' WHERE avatar_id = $1', [avatarId, 'failed']);
        }
    }
    /**
     * Safety cleanup for unreferenced avatars
     */
    async cleanupUnreferencedAvatars() {
        try {
            const result = await database_1.default.query(`
        SELECT af.id FROM avatar_files af
        LEFT JOIN users u ON af.id = u.avatar_id
        WHERE u.avatar_id IS NULL
        AND af.created_at < NOW() - INTERVAL '7 days'
        LIMIT 50
      `);
            for (const row of result.rows) {
                await this.scheduleAvatarCleanup(row.id);
            }
        }
        catch (error) {
            console.error('Error during unreferenced avatar cleanup:', error);
        }
    }
    /**
     * Get avatar usage statistics
     */
    async getAvatarStats() {
        try {
            const result = await database_1.default.query(`
        SELECT 
          COUNT(*) as total_avatars,
          SUM(file_size) as total_size,
          AVG(file_size) as average_size,
          COUNT(DISTINCT file_hash) as unique_files,
          (COUNT(*) - COUNT(DISTINCT file_hash)) as duplicate_count
        FROM avatar_files
      `);
            const cleanupResult = await database_1.default.query('SELECT COUNT(*) as pending FROM avatar_cleanup_queue WHERE status = $1', ['pending']);
            const stats = result.rows[0];
            return {
                totalAvatars: parseInt(stats.total_avatars),
                totalSize: parseInt(stats.total_size || 0),
                averageSize: Math.round(parseFloat(stats.average_size || 0)),
                duplicateCount: parseInt(stats.duplicate_count || 0),
                pendingCleanup: parseInt(cleanupResult.rows[0].pending)
            };
        }
        catch (error) {
            console.error('Error getting avatar stats:', error);
            return {
                totalAvatars: 0,
                totalSize: 0,
                averageSize: 0,
                duplicateCount: 0,
                pendingCleanup: 0
            };
        }
    }
}
exports.AvatarService = AvatarService;
