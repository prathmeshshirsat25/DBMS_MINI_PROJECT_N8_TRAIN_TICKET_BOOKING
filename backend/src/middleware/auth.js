// src/middleware/auth.js
// JWT authentication middleware

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'railway_booking_jwt_secret_key_2024_secure_random';

/**
 * Verify JWT token from Authorization header.
 * Attaches req.user = { user_id, email, role }
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Normalize: G3 used 'id', G4 used 'user_id' — map both
    req.user = {
      user_id: decoded.user_id || decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
}

/**
 * Optional authentication: attaches user if token present, continues if not
 */
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: decoded.user_id || decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER',
    };
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireAdmin, JWT_SECRET };
