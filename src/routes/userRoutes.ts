import { Router } from 'express';
import { updateUserProfile, getUserProfile, updateUserAvatar, deleteUserAvatar, blockUser, getBlockedUsers, unblockUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import upload from '../middlewares/uploadMiddleware';

const router = Router();

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

export default router; 