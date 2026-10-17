'use strict';

/**
 * authController.js
 * Handles all authentication and user-account operations for the Railway Booking System.
 *
 * Endpoints covered:
 *   POST   /auth/register
 *   POST   /auth/login
 *   GET    /auth/me          (protected)
 *   PUT    /auth/profile     (protected)
 *   POST   /auth/forgot-password
 *   POST   /auth/verify-otp
 *   POST   /auth/reset-password
 *   PUT    /auth/change-password (protected)
 *   POST   /auth/logout      (protected)
 */

const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const nodemailer = require('nodemailer');

const db = require('../config/db.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET =
  process.env.JWT_SECRET || 'railway_booking_jwt_secret_key_2024_secure_random';

const JWT_EXPIRES_IN    = '7d';
const BCRYPT_ROUNDS     = 10;
const OTP_EXPIRY_MS     = 30 * 60 * 1000; // 30 minutes
const RESET_OTP_SECRET  = process.env.RESET_OTP_SECRET || 'railway_otp_hmac_secret_2024';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signs a JWT with the canonical payload shape.
 * @param {{ user_id: number, email: string, role: string }} payload
 * @returns {string} signed JWT
 */
const signToken = ({ user_id, email, role }) =>
  jwt.sign({ user_id, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Validates password strength.
 * Rules: min 8 chars, at least one uppercase, one lowercase, one digit.
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one digit.' };
  }
  return { valid: true };
};

/**
 * Validates phone number — minimum 10 digits (digits only).
 * @param {string} phone
 * @returns {boolean}
 */
const validatePhone = (phone) => /^\d{10,}$/.test((phone || '').replace(/[\s\-\+\(\)]/g, ''));

/**
 * Generates a random 6-digit numeric OTP string.
 * @returns {string}
 */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Creates an HMAC-SHA256 hash of the OTP using RESET_OTP_SECRET.
 * @param {string} otp
 * @returns {string} hex digest
 */
const hashOtp = (otp) =>
  crypto.createHmac('sha256', RESET_OTP_SECRET).update(otp).digest('hex');

/**
 * Attempts to send a password-reset OTP email via nodemailer (SMTP_* env vars).
 * Errors are swallowed so that the endpoint can still succeed in dev without SMTP.
 * @param {string} toEmail
 * @param {string} otp
 */
const sendResetEmail = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT)   || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      toEmail,
      subject: 'Railway Booking System – Password Reset OTP',
      text: [
        'You requested a password reset.',
        `Your OTP is: ${otp}`,
        'It expires in 30 minutes.',
        'If you did not request this, ignore this email.',
      ].join('\n'),
      html: `
        <p>You requested a password reset for your Railway Booking System account.</p>
        <h2 style="letter-spacing:4px;">${otp}</h2>
        <p>This OTP expires in <strong>30 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
  } catch (emailErr) {
    // Non-fatal — log but do not propagate.
    console.warn('[authController] sendResetEmail failed:', emailErr.message);
  }
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Registers a new user, returns JWT + basic user data.
 */
const register = async (req, res) => {
  try {
    const { name, email, phone, password, confirm_password } = req.body;

    // --- Input validation ---
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (!validatePhone(phone)) {
      return res.status(400).json({ success: false, message: 'Phone must be at least 10 digits.' });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: pwCheck.message });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // --- Email uniqueness check ---
    const existsResult = await db.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    if (existsResult.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    // --- Hash password & insert user ---
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const insertResult = await db.query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, phone, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone.trim(), password_hash]
    );

    const user  = insertResult.rows[0];
    const token = signToken({ user_id: user.user_id, email: user.email, role: user.role });

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: { token, user },
    });
  } catch (err) {
    console.error('[authController.register]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Authenticates user by email + password, returns JWT + user data (no hash).
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // --- Find user ---
    const result = await db.query(
      `SELECT user_id, name, email, phone, password_hash, role, created_at, is_blocked
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact support.' });
    }

    // --- Verify password ---
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken({ user_id: user.user_id, email: user.email, role: user.role });

    // Strip sensitive fields before returning
    const { password_hash: _ph, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: { token, user: safeUser },
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /auth/me  (protected)
 * Returns the authenticated user's data from the DB.
 */
const getMe = async (req, res) => {
  try {
    const { user_id } = req.user; // populated by authenticate middleware

    const result = await db.query(
      `SELECT user_id, name, email, phone, role, created_at, is_blocked
       FROM users
       WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'User fetched successfully.',
      data: { ...result.rows[0], user: result.rows[0] },
    });
  } catch (err) {
    console.error('[authController.getMe]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /auth/profile  (protected)
 * Updates the authenticated user's name and/or phone.
 */
const updateProfile = async (req, res) => {
  try {
    const { user_id } = req.user;
    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({ success: false, message: 'Provide at least name or phone to update.' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ success: false, message: 'Phone must be at least 10 digits.' });
    }

    // Build dynamic SET clause — only update provided fields
    const fields  = [];
    const values  = [];
    let   paramIdx = 1;

    if (name && name.trim()) {
      fields.push(`name = $${paramIdx++}`);
      values.push(name.trim());
    }
    if (phone) {
      fields.push(`phone = $${paramIdx++}`);
      values.push(phone.trim());
    }

    values.push(user_id); // for WHERE clause

    const result = await db.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE user_id = $${paramIdx}
       RETURNING user_id, name, email, phone, role, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user: result.rows[0] },
    });
  } catch (err) {
    console.error('[authController.updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/forgot-password
 * Generates a 6-digit OTP, stores its HMAC hash + expiry in DB.
 * In development mode the OTP is returned in the response body.
 * Also attempts to send an email via SMTP if configured.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const result = await db.query(
      'SELECT user_id, name, email FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    // Always return 200 to avoid user enumeration
    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, an OTP has been sent.',
      });
    }

    const user       = result.rows[0];
    const otp        = generateOtp();
    const otpHash    = hashOtp(otp);
    const expiresAt  = new Date(Date.now() + OTP_EXPIRY_MS);

    await db.query(
      `UPDATE users
       SET reset_otp_hash = $1, reset_otp_expires_at = $2
       WHERE user_id = $3`,
      [otpHash, expiresAt, user.user_id]
    );

    // Non-blocking email attempt
    sendResetEmail(user.email, otp);

    const isDev = (process.env.NODE_ENV || 'development') === 'development';

    return res.status(200).json({
      success: true,
      message: 'If that email is registered, an OTP has been sent.',
      ...(isDev && { dev_otp: otp }), // expose OTP only in dev
    });
  } catch (err) {
    console.error('[authController.forgotPassword]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/verify-otp
 * Checks a submitted OTP against the stored HMAC hash & expiry without
 * consuming it (so the user can then call reset-password).
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const result = await db.query(
      `SELECT reset_otp_hash, reset_otp_expires_at
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid OTP or email.' });
    }

    const { reset_otp_hash, reset_otp_expires_at } = result.rows[0];

    if (!reset_otp_hash || !reset_otp_expires_at) {
      return res.status(400).json({ success: false, message: 'No OTP request found. Please request a new OTP.' });
    }

    if (new Date() > new Date(reset_otp_expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const submittedHash = hashOtp(String(otp));
    if (submittedHash !== reset_otp_hash) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You may now reset your password.',
    });
  } catch (err) {
    console.error('[authController.verifyOtp]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/reset-password
 * Verifies OTP then sets a new bcrypt-hashed password, clearing OTP fields.
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password, confirm_password } = req.body;

    if (!email || !otp || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, new_password, and confirm_password are required.',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const pwCheck = validatePassword(new_password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: pwCheck.message });
    }

    // --- Re-verify OTP ---
    const result = await db.query(
      `SELECT user_id, reset_otp_hash, reset_otp_expires_at
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or OTP.' });
    }

    const { user_id, reset_otp_hash, reset_otp_expires_at } = result.rows[0];

    if (!reset_otp_hash || !reset_otp_expires_at) {
      return res.status(400).json({ success: false, message: 'No OTP request found. Please request a new OTP.' });
    }

    if (new Date() > new Date(reset_otp_expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const submittedHash = hashOtp(String(otp));
    if (submittedHash !== reset_otp_hash) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    // --- Update password and clear OTP fields ---
    const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

    await db.query(
      `UPDATE users
       SET password_hash = $1, reset_otp_hash = NULL, reset_otp_expires_at = NULL
       WHERE user_id = $2`,
      [password_hash, user_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    console.error('[authController.resetPassword]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /auth/change-password  (protected)
 * Verifies old password, then sets a new bcrypt-hashed password.
 */
const changePassword = async (req, res) => {
  try {
    const { user_id } = req.user;
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'old_password, new_password, and confirm_password are required.',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const pwCheck = validatePassword(new_password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: pwCheck.message });
    }

    // --- Fetch stored hash ---
    const result = await db.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const match = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect.' });
    }

    if (old_password === new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the old password.',
      });
    }

    const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [password_hash, user_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    console.error('[authController.changePassword]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/logout  (protected)
 * JWT is stateless — instructs the client to discard the token.
 */
const logout = async (req, res) => {
  try {
    // No server-side token invalidation needed for stateless JWT.
    // The client must delete the token from storage.
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please remove your token on the client side.',
    });
  } catch (err) {
    console.error('[authController.logout]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  logout,
};
