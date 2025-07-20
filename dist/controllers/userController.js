"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAvatar = exports.uploadAvatar = exports.updateProfile = exports.getProfile = exports.unblockUser = exports.getBlockedUsers = exports.blockUser = exports.getUserProfile = exports.updateUserAvatar = exports.updateUserProfile = void 0;
const database_1 = __importDefault(require("../config/database"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Yeni yardımcı fonksiyon: avatar dosya yolunu güvenli şekilde oluştur
const buildAvatarFilePath = (avatarUrl) => {
    if (!avatarUrl)
        return null;
    try {
        // Tam URL ise pathname kısmını al ve baştaki / işaretini kaldır
        const pathname = new URL(avatarUrl).pathname.replace(/^\//, '');
        return path_1.default.join(__dirname, '..', '..', 'public', pathname);
    }
    catch (_) {
        // Göreceli yol ise baştaki / işaretini kaldırarak kullan
        const normalized = avatarUrl.startsWith('/') ? avatarUrl.slice(1) : avatarUrl;
        return path_1.default.join(__dirname, '..', '..', 'public', normalized);
    }
};
const updateUserProfile = async (req, res) => {
    const userId = req.user?.id;
    const { residence_country, residence_city, languages, gender, weight, height, name, bio, avatar_url } = req.body;
    try {
        const fieldsToUpdate = {};
        if (residence_country)
            fieldsToUpdate.residence_country = residence_country;
        if (residence_city)
            fieldsToUpdate.residence_city = residence_city;
        if (languages)
            fieldsToUpdate.languages = languages;
        if (gender)
            fieldsToUpdate.gender = gender;
        if (weight !== undefined)
            fieldsToUpdate.weight = weight;
        if (height !== undefined)
            fieldsToUpdate.height = height;
        if (name)
            fieldsToUpdate.name = name;
        if (bio)
            fieldsToUpdate.bio = bio;
        if (avatar_url === null) {
            const userResult = await database_1.default.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0 && userResult.rows[0].avatar_url) {
                const oldAvatarPath = buildAvatarFilePath(userResult.rows[0].avatar_url);
                if (oldAvatarPath && fs_1.default.existsSync(oldAvatarPath)) {
                    fs_1.default.unlinkSync(oldAvatarPath);
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
        const result = await database_1.default.query(updateQuery, [...queryValues, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = result.rows[0];
        res.status(200).json({ message: 'Profile updated successfully.', user: { ...user } });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Error updating user profile.' });
    }
};
exports.updateUserProfile = updateUserProfile;
const updateUserAvatar = async (req, res) => {
    const userId = req.user?.id;
    if (!req.file) {
        return res.status(400).json({ message: 'Lütfen bir dosya seçin.' });
    }
    try {
        const userResult = await database_1.default.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].avatar_url) {
            const oldAvatarPath = buildAvatarFilePath(userResult.rows[0].avatar_url);
            if (oldAvatarPath && fs_1.default.existsSync(oldAvatarPath)) {
                fs_1.default.unlinkSync(oldAvatarPath);
            }
        }
        const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
        const result = await database_1.default.query('UPDATE users SET avatar_url = $1, last_active_at = NOW() WHERE id = $2 RETURNING avatar_url', [avatarUrl, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        res.status(200).json({ message: 'Profil fotoğrafı başarıyla güncellendi.', avatar_url: result.rows[0].avatar_url });
    }
    catch (error) {
        console.error('Update avatar error:', error);
        res.status(500).json({ message: 'Profil fotoğrafı güncellenirken bir hata oluştu.' });
    }
};
exports.updateUserAvatar = updateUserAvatar;
const getUserProfile = async (req, res) => {
    const userId = req.user?.id;
    try {
        const result = await database_1.default.query('SELECT id, username, email, first_name, last_name, age, country, residence_country, residence_city, languages, gender, weight, height, role, created_at, last_active_at, avatar_url FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = result.rows[0];
        res.status(200).json({ ...user });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Error fetching user profile.' });
    }
};
exports.getUserProfile = getUserProfile;
// 🚫 Block System Endpoints
const blockUser = async (req, res) => {
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
        const userExists = await database_1.default.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Zaten bloklanmış mı kontrol et
        const alreadyBlocked = await database_1.default.query('SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2', [userId, user_id]);
        if (alreadyBlocked.rows.length > 0) {
            return res.status(409).json({ message: 'User is already blocked' });
        }
        // Kullanıcıyı blokla
        const result = await database_1.default.query('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) RETURNING id, created_at', [userId, user_id]);
        // Eğer aktif bir chat room varsa onu sonlandır
        try {
            await database_1.default.query('UPDATE chats SET status = $1, updated_at = NOW() WHERE (user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2) AND status = $4', ['ended_by_users', userId, user_id, 'active']);
        }
        catch (chatError) {
            console.warn('Could not end chat rooms:', chatError);
        }
        res.status(201).json({
            message: 'User blocked successfully',
            block_id: result.rows[0].id,
            blocked_at: result.rows[0].created_at
        });
    }
    catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ message: 'Error blocking user' });
    }
};
exports.blockUser = blockUser;
const getBlockedUsers = async (req, res) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Bloklanmış kullanıcıları getir
        const blockedResult = await database_1.default.query(`
      SELECT bu.id, bu.blocked_id, bu.created_at,
             u.username, u.first_name, u.last_name, u.avatar_url
      FROM blocked_users bu
      JOIN users u ON bu.blocked_id = u.id
      WHERE bu.blocker_id = $1
      ORDER BY bu.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
        // Toplam sayı
        const countResult = await database_1.default.query('SELECT COUNT(*) as total FROM blocked_users WHERE blocker_id = $1', [userId]);
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
    }
    catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ message: 'Error getting blocked users' });
    }
};
exports.getBlockedUsers = getBlockedUsers;
const unblockUser = async (req, res) => {
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
        const result = await database_1.default.query('DELETE FROM blocked_users WHERE id = $1 AND blocker_id = $2 RETURNING blocked_id', [id, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Block record not found or you are not authorized to remove it' });
        }
        res.status(200).json({
            message: 'User unblocked successfully',
            unblocked_user_id: result.rows[0].blocked_id
        });
    }
    catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ message: 'Error unblocking user' });
    }
};
exports.unblockUser = unblockUser;
const getProfile = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT id, email, name, bio, avatar_url FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching user profile.' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const { name, bio, avatar_url } = req.body;
        const currentUserResult = await database_1.default.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
        if (currentUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const currentUser = currentUserResult.rows[0];
        const fields = {};
        if (name !== undefined)
            fields.name = name;
        if (bio !== undefined)
            fields.bio = bio;
        if (avatar_url === null && currentUser.avatar_url) {
            const oldAvatarPath = buildAvatarFilePath(currentUser.avatar_url);
            if (oldAvatarPath && fs_1.default.existsSync(oldAvatarPath)) {
                fs_1.default.unlinkSync(oldAvatarPath);
            }
            fields.avatar_url = null;
        }
        const keys = Object.keys(fields);
        if (keys.length === 0) {
            return res.status(200).json({ message: 'No fields to update.' });
        }
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(fields);
        const updateResult = await database_1.default.query(`UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING id, email, name, bio, avatar_url`, [...values, req.user.id]);
        res.status(200).json({
            message: 'Profile updated successfully',
            user: updateResult.rows[0]
        });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};
exports.updateProfile = updateProfile;
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Lütfen bir dosya seçin.' });
        }
        const currentUserResult = await database_1.default.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
        if (currentUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        const currentUser = currentUserResult.rows[0];
        if (currentUser.avatar_url) {
            const oldAvatarPath = buildAvatarFilePath(currentUser.avatar_url);
            if (oldAvatarPath && fs_1.default.existsSync(oldAvatarPath)) {
                fs_1.default.unlinkSync(oldAvatarPath);
            }
        }
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        await database_1.default.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
        res.status(200).json({
            message: 'Avatar başarıyla yüklendi.',
            avatarUrl: avatarUrl
        });
    }
    catch (error) {
        console.error('Avatar yükleme hatası:', error);
        res.status(500).json({ message: 'Avatar yüklenirken bir sunucu hatası oluştu.' });
    }
};
exports.uploadAvatar = uploadAvatar;
// Yeni endpoint: avatar silme
const deleteUserAvatar = async (req, res) => {
    const userId = req.user?.id;
    try {
        const userResult = await database_1.default.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        const currentAvatarUrl = userResult.rows[0].avatar_url;
        if (currentAvatarUrl) {
            const avatarPath = buildAvatarFilePath(currentAvatarUrl);
            if (avatarPath && fs_1.default.existsSync(avatarPath)) {
                fs_1.default.unlinkSync(avatarPath);
            }
        }
        await database_1.default.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Profil fotoğrafı silindi.' });
    }
    catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ message: 'Profil fotoğrafı silinirken bir hata oluştu.' });
    }
};
exports.deleteUserAvatar = deleteUserAvatar;
