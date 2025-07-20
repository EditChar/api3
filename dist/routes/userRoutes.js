"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const uploadMiddleware_1 = __importDefault(require("../middlewares/uploadMiddleware"));
const router = (0, express_1.Router)();
// @route   GET api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authMiddleware_1.authMiddleware, userController_1.getUserProfile);
// @route   PUT api/users/profile/avatar
// @desc    Update user avatar
// @access  Private
router.put('/profile/avatar', authMiddleware_1.authMiddleware, uploadMiddleware_1.default.single('avatar'), userController_1.updateUserAvatar);
// @route   DELETE api/users/profile/avatar
// @desc    Delete user avatar
// @access  Private
router.delete('/profile/avatar', authMiddleware_1.authMiddleware, userController_1.deleteUserAvatar);
// @route   PUT api/users/profile
// @desc    Update user profile details
// @access  Private
router.put('/profile', authMiddleware_1.authMiddleware, userController_1.updateUserProfile);
// 🚫 Block System Routes
// @route   POST api/users/block
// @desc    Block a user
// @access  Private
router.post('/block', authMiddleware_1.authMiddleware, userController_1.blockUser);
// @route   GET api/users/blocked
// @desc    Get blocked users list
// @access  Private
router.get('/blocked', authMiddleware_1.authMiddleware, userController_1.getBlockedUsers);
// @route   DELETE api/users/block/:id
// @desc    Unblock a user
// @access  Private
router.delete('/block/:id', authMiddleware_1.authMiddleware, userController_1.unblockUser);
exports.default = router;
