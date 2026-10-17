'use strict';

/**
 * authRoutes.js
 * Mounts all authentication endpoints under the /auth prefix.
 *
 * Public routes (no token required):
 *   POST   /auth/register
 *   POST   /auth/login
 *   POST   /auth/forgot-password
 *   POST   /auth/verify-otp
 *   POST   /auth/reset-password
 *
 * Protected routes (Bearer JWT required):
 *   GET    /auth/me
 *   PUT    /auth/profile
 *   PUT    /auth/change-password
 *   POST   /auth/logout
 */

const express      = require('express');
const router       = express.Router();

const { authenticate } = require('../middleware/auth.js');
const {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  logout,
} = require('../controllers/authController.js');

// ─── Public Routes ────────────────────────────────────────────────────────────

/** Register a new user account */
router.post('/register', register);

/** Authenticate and receive a JWT */
router.post('/login', login);

/** Request a password-reset OTP (sent via email; returned in dev mode) */
router.post('/forgot-password', forgotPassword);

/** Verify that a submitted OTP is valid without consuming it */
router.post('/verify-otp', verifyOtp);

/** Reset password using a valid OTP */
router.post('/reset-password', resetPassword);

// ─── Protected Routes ─────────────────────────────────────────────────────────

/** Get current authenticated user's profile */
router.get('/me', authenticate, getMe);

/** Update name and/or phone for the authenticated user */
router.put('/profile', authenticate, updateProfile);

/** Change password (must supply old password) */
router.put('/change-password', authenticate, changePassword);

/** Logout — instructs client to discard JWT (stateless) */
router.post('/logout', authenticate, logout);

// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
