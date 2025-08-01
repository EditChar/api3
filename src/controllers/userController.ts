import { Response } from 'express';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { User } from '../models/User';
import path from 'path';
import fs from 'fs';
import { AvatarService } from '../services/avatarService';

// Initialize avatar service
const avatarService = new AvatarService();

// Yeni yardımcı fonksiyon: avatar dosya yolunu güvenli şekilde oluştur
const buildAvatarFilePath = (avatarUrl: string | null) => {
  if (!avatarUrl) return null;
  try {
    // Tam URL ise pathname kısmını al ve baştaki / işaretini kaldır
    const pathname = new URL(avatarUrl).pathname.replace(/^\//, '');
    return path.join(__dirname, '..', '..', 'public', pathname);
  } catch (_) {
    // Göreceli yol ise baştaki / işaretini kaldırarak kullan
    const normalized = avatarUrl.startsWith('/') ? avatarUrl.slice(1) : avatarUrl;
    return path.join(__dirname, '..', '..', 'public', normalized);
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { residence_country, residence_city, languages, gender, weight, height, name, bio, avatar_url } = req.body;

  try {
    const fieldsToUpdate: any = {};
    if (residence_country) fieldsToUpdate.residence_country = residence_country;
    if (residence_city) fieldsToUpdate.residence_city = residence_city;
    if (languages) fieldsToUpdate.languages = languages;
    if (gender) fieldsToUpdate.gender = gender;
    if (weight !== undefined) fieldsToUpdate.weight = weight;
    if (height !== undefined) fieldsToUpdate.height = height;
    if (name) fieldsToUpdate.name = name;
    if (bio) fieldsToUpdate.bio = bio;

    if (avatar_url === null) {
      const userResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0 && userResult.rows[0].avatar_url) {
        const oldAvatarPath = buildAvatarFilePath(userResult.rows[0].avatar_url);
        if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      fieldsToUpdate.avatar_url = null;
    }

    const queryParts = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`);
    const queryValues = Object.values(fieldsToUpdate);
    
    if (queryParts.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    const updateQuery = `
      UPDATE users 
      SET ${queryParts.join(', ')}, last_active_at = NOW() 
      WHERE id = $${queryValues.length + 1}
      RETURNING id, username, email, first_name, last_name, age, country, residence_country, residence_city, languages, gender, weight, height, role, last_active_at, avatar_url
    `;
    
    const result = await pool.query(updateQuery, [...queryValues, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];
    res.status(200).json({ message: 'Profile updated successfully.', user: { ...user } });

  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating user profile.' });
  }
};

export const updateUserAvatar = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const correlationId = `avatar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 [${correlationId}] Avatar upload request from user ${userId}`);

  if (!req.file) {
    console.log(`❌ [${correlationId}] No file provided`);
    return res.status(400).json({ 
      success: false,
      message: 'Lütfen bir dosya seçin.',
      correlationId 
    });
  }

  if (!userId) {
    console.log(`❌ [${correlationId}] User not authenticated`);
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required.',
      correlationId 
    });
  }

  try {
    console.log(`📋 [${correlationId}] File info: ${req.file.originalname}, ${req.file.size} bytes, ${req.file.mimetype}`);
    
    // Upload via new avatar service with enterprise features
    const result = await avatarService.uploadAvatar(
      userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!result.success) {
      console.log(`❌ [${correlationId}] Upload failed: ${result.error}`);
      return res.status(500).json({
        success: false,
        message: result.error || 'Avatar upload failed',
        correlationId
      });
    }

    console.log(`✅ [${correlationId}] Avatar uploaded successfully: ${result.avatarId}`);
    
    // Backward compatibility response format
    const response = {
      success: true,
      message: result.isDuplicate 
        ? 'Profil fotoğrafı güncellendi (mevcut dosya kullanıldı)' 
        : 'Profil fotoğrafı başarıyla güncellendi.',
      avatar_url: result.urls?.medium, // Default medium size for backward compatibility
      avatarId: result.avatarId,
      urls: result.urls, // All sizes available
      isDuplicate: result.isDuplicate || false,
      correlationId,
      meta: {
        uploadTime: Date.now(),
        fileSize: req.file.size,
        optimized: true
      }
    };

    res.status(200).json(response);

  } catch (error: unknown) {
    console.error(`❌ [${correlationId}] Unexpected error:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Profil fotoğrafı güncellenirken bir hata oluştu.',
      correlationId,
      error: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    });
  }
};

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const result = await pool.query(
      'SELECT id, username, email, first_name, last_name, age, country, residence_country, residence_city, languages, gender, weight, height, role, created_at, last_active_at, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];
    
    // 🖼️ Get avatar URLs in all sizes if avatar exists
    let avatarUrls = null;
    if (user.avatar_url && userId) {
      try {
        // Get user's latest avatar ID
        const avatarQuery = await pool.query(
          'SELECT id FROM avatar_files WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [userId]
        );
        
        if (avatarQuery.rows.length > 0) {
          const avatarId = avatarQuery.rows[0].id;
          const avatarResult = await avatarService.getAvatarUrls(avatarId);
          
          if (avatarResult) {
            avatarUrls = avatarResult;
            console.log('✅ [Profile] Avatar URLs retrieved:', {
              userId,
              avatarId,
              sizes: Object.keys(avatarResult),
              originalSize: avatarResult.original ? 'available' : 'missing'
            });
          }
        }
      } catch (avatarError) {
        console.warn('⚠️ [Profile] Failed to get avatar URLs:', avatarError);
        // Continue with basic avatar_url
      }
    }

    const response = {
      ...user,
      avatar_urls: avatarUrls // ✨ All avatar sizes for full-screen viewing
    };

    res.status(200).json(response);

  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Error fetching user profile.' });
  }
};

// 🚫 Block System Endpoints

export const blockUser = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { user_id } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!user_id) {
    return res.status(400).json({ message: 'User ID to block is required' });
  }

  if (userId === user_id) {
    return res.status(400).json({ message: 'You cannot block yourself' });
  }

  try {
    // Kullanıcının var olup olmadığını kontrol et
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Zaten bloklanmış mı kontrol et
    const alreadyBlocked = await pool.query(
      'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [userId, user_id]
    );

    if (alreadyBlocked.rows.length > 0) {
      return res.status(409).json({ message: 'User is already blocked' });
    }

    // Kullanıcıyı blokla
    const result = await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) RETURNING id, created_at',
      [userId, user_id]
    );

    // Eğer aktif bir chat room varsa onu sonlandır
    try {
      await pool.query(
        'UPDATE chats SET status = $1, updated_at = NOW() WHERE (user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2) AND status = $4',
        ['ended_by_users', userId, user_id, 'active']
      );
    } catch (chatError) {
      console.warn('Could not end chat rooms:', chatError);
    }

    res.status(201).json({
      message: 'User blocked successfully',
      block_id: result.rows[0].id,
      blocked_at: result.rows[0].created_at
    });

  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Error blocking user' });
  }
};

export const getBlockedUsers = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Bloklanmış kullanıcıları getir
    const blockedResult = await pool.query(`
      SELECT bu.id, bu.blocked_id, bu.created_at,
             u.username, u.first_name, u.last_name, u.avatar_url
      FROM blocked_users bu
      JOIN users u ON bu.blocked_id = u.id
      WHERE bu.blocker_id = $1
      ORDER BY bu.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Toplam sayı
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM blocked_users WHERE blocker_id = $1',
      [userId]
    );

    const blockedUsers = blockedResult.rows.map(row => ({
      block_id: row.id,
      user: {
        id: row.blocked_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url
      },
      blocked_at: row.created_at
    }));

    res.status(200).json({
      blocked_users: blockedUsers,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        total_count: parseInt(countResult.rows[0].total),
        limit
      }
    });

  } catch (error: any) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Error getting blocked users' });
  }
};

export const unblockUser = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params; // block_id

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!id) {
    return res.status(400).json({ message: 'Block ID is required' });
  }

  try {
    // Blok kaydının sahibi olup olmadığını kontrol et ve sil
    const result = await pool.query(
      'DELETE FROM blocked_users WHERE id = $1 AND blocker_id = $2 RETURNING blocked_id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Block record not found or you are not authorized to remove it' });
    }

    res.status(200).json({
      message: 'User unblocked successfully',
      unblocked_user_id: result.rows[0].blocked_id
    });

  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Error unblocking user' });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await pool.query<User>(
            'SELECT id, email, name, bio, avatar_url FROM users WHERE id = $1',
            [req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching user profile.' });
    }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, bio, avatar_url } = req.body;
        
        const currentUserResult = await pool.query<User>('SELECT avatar_url FROM users WHERE id = $1', [req.user!.id]);
        if (currentUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const currentUser = currentUserResult.rows[0];

        const fields: { [key: string]: any } = {};
        if (name !== undefined) fields.name = name;
        if (bio !== undefined) fields.bio = bio;

        if (avatar_url === null && currentUser.avatar_url) {
            const oldAvatarPath = buildAvatarFilePath(currentUser.avatar_url);
            if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
            fields.avatar_url = null;
        }

        const keys = Object.keys(fields);
        if (keys.length === 0) {
            return res.status(200).json({ message: 'No fields to update.' });
        }

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(fields);

        const updateResult = await pool.query(
            `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING id, email, name, bio, avatar_url`,
            [...values, req.user!.id]
        );

        res.status(200).json({
            message: 'Profile updated successfully',
            user: updateResult.rows[0]
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

export const uploadAvatar = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const correlationId = `avatar-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 [${correlationId}] Avatar upload request from user ${userId}`);

        if (!req.file) {
        console.log(`❌ [${correlationId}] No file provided`);
        return res.status(400).json({ 
            success: false,
            message: 'Lütfen bir dosya seçin.',
            correlationId 
        });
        }

    if (!userId) {
        console.log(`❌ [${correlationId}] User not authenticated`);
        return res.status(401).json({ 
            success: false,
            message: 'Authentication required.',
            correlationId 
        });
        }

    try {
        console.log(`📋 [${correlationId}] File info: ${req.file.originalname}, ${req.file.size} bytes, ${req.file.mimetype}`);
        
        // Upload via new avatar service with enterprise features
        const result = await avatarService.uploadAvatar(
            userId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        if (!result.success) {
            console.log(`❌ [${correlationId}] Upload failed: ${result.error}`);
            return res.status(500).json({
                success: false,
                message: result.error || 'Avatar upload failed',
                correlationId
            });
        }

        console.log(`✅ [${correlationId}] Avatar uploaded successfully: ${result.avatarId}`);

        res.status(200).json({
            success: true,
            message: result.isDuplicate 
                ? 'Avatar yüklendi (mevcut dosya kullanıldı)' 
                : 'Avatar başarıyla yüklendi.',
            avatarUrl: result.urls?.medium, // Default medium size for backward compatibility
            avatarId: result.avatarId,
            urls: result.urls, // All sizes available
            isDuplicate: result.isDuplicate || false,
            correlationId,
            meta: {
                uploadTime: Date.now(),
                fileSize: req.file.size,
                optimized: true
            }
        });

    } catch (error: unknown) {
        console.error(`❌ [${correlationId}] Avatar upload error:`, error);
        res.status(500).json({ 
            success: false,
            message: 'Avatar yüklenirken bir sunucu hatası oluştu.',
            correlationId
        });
    }
};

// Avatar silme endpoint
export const deleteUserAvatar = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const correlationId = `delete-avatar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🗑️  [${correlationId}] Avatar deletion request from user ${userId}`);

  if (!userId) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required.',
      correlationId 
    });
    }

  try {
    const success = await avatarService.deleteUserAvatar(userId);

    if (!success) {
      console.log(`❌ [${correlationId}] Avatar deletion failed`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete avatar',
        correlationId
      });
      }

    console.log(`✅ [${correlationId}] Avatar deleted successfully`);

    res.status(200).json({
      success: true,
      message: 'Profil fotoğrafı silindi.',
      correlationId,
      meta: {
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    console.error(`❌ [${correlationId}] Error deleting avatar:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Profil fotoğrafı silinirken bir hata oluştu.',
      correlationId
    });
  }
}; 