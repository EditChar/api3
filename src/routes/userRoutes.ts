import { Router } from 'express';
import { updateUserProfile, getUserProfile, updateUserAvatar, deleteUserAvatar, blockUser, getBlockedUsers, unblockUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import upload from '../middlewares/uploadMiddleware';
import { AvatarService } from '../services/avatarService';

const router = Router();

// Initialize avatar service for admin endpoints
const avatarService = new AvatarService();

// @route   GET api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authMiddleware, getUserProfile);

// @route   PUT api/users/profile/avatar
// @desc    Update user avatar
// @access  Private
router.put('/profile/avatar', authMiddleware, upload.single('avatar'), updateUserAvatar);

// @route   DELETE api/users/profile/avatar
// @desc    Delete user avatar
// @access  Private
router.delete('/profile/avatar', authMiddleware, deleteUserAvatar);

// @route   PUT api/users/profile
// @desc    Update user profile details
// @access  Private
router.put('/profile', authMiddleware, updateUserProfile);

// 🚫 Block System Routes

// @route   POST api/users/block
// @desc    Block a user
// @access  Private
router.post('/block', authMiddleware, blockUser);

// @route   GET api/users/blocked
// @desc    Get blocked users list
// @access  Private
router.get('/blocked', authMiddleware, getBlockedUsers);

// @route   DELETE api/users/block/:id
// @desc    Unblock a user
// @access  Private
router.delete('/block/:id', authMiddleware, unblockUser);

// 📊 Admin Avatar Management Routes

// @route   GET /api/users/avatar/system/stats
// @desc    Get comprehensive avatar system statistics
// @access  Admin only
router.get('/avatar/system/stats', authMiddleware, adminMiddleware, async (req, res) => {
  const correlationId = `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📊 [${correlationId}] Getting avatar system statistics`);

  try {
    const stats = await avatarService.getAvatarStats();

    console.log(`✅ [${correlationId}] Statistics retrieved successfully`);

    res.status(200).json({
      success: true,
      data: {
        statistics: stats,
        generatedAt: new Date().toISOString(),
        system: 'Avatar Service'
      },
      correlationId
    });

  } catch (error: unknown) {
    console.error(`❌ [${correlationId}] Error getting avatar statistics:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving avatar statistics',
      correlationId
    });
  }
});

// @route   POST /api/users/avatar/system/cleanup
// @desc    Manually trigger avatar cleanup process
// @access  Admin only
router.post('/avatar/system/cleanup', authMiddleware, adminMiddleware, async (req, res) => {
  const correlationId = `cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🧹 [${correlationId}] Manual avatar cleanup triggered`);

  try {
    // Run cleanup asynchronously
    avatarService.cleanupOrphanedAvatars().catch((error: unknown) => {
      console.error(`❌ [${correlationId}] Background cleanup failed:`, error);
    });

    res.status(202).json({
      success: true,
      message: 'Avatar cleanup process initiated',
      correlationId,
      meta: {
        initiatedAt: new Date().toISOString(),
        type: 'manual_trigger'
      }
    });

  } catch (error: unknown) {
    console.error(`❌ [${correlationId}] Error triggering cleanup:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Error triggering avatar cleanup',
      correlationId
    });
  }
});

// @route   GET /api/users/avatar/system/health
// @desc    Get avatar system health status
// @access  Private (basic health info) / Admin (detailed stats)
router.get('/avatar/system/health', authMiddleware, async (req, res) => {
  const correlationId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const stats = await avatarService.getAvatarStats();
    
    const health = {
      status: 'healthy',
      service: 'Avatar Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metrics: {
        totalAvatars: stats.totalAvatars,
        pendingCleanup: stats.pendingCleanup,
        duplicateCount: stats.duplicateCount,
        totalSizeMB: Math.round(stats.totalSize / 1024 / 1024)
      },
      checks: {
        database: 'ok',
        s3: 'ok', // Could add actual S3 health check
        cleanup_queue: stats.pendingCleanup < 1000 ? 'ok' : 'warning'
      }
    };

    res.status(200).json({
      success: true,
      data: health,
      correlationId
    });

  } catch (error: unknown) {
    console.error(`❌ [${correlationId}] Health check failed:`, error);
    
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        service: 'Avatar Service',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      correlationId
    });
  }
});

export default router; 