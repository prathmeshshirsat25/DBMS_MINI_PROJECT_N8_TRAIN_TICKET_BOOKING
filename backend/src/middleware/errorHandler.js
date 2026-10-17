// src/middleware/errorHandler.js
// Centralized Express error handling middleware

/**
 * Express error handler — must have 4 parameters to be recognized as error handler
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err);
  } else {
    if (statusCode >= 500) {
      console.error(`Server error on ${req.method} ${req.originalUrl}:`, message);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
}

/**
 * 404 handler for unrecognized routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorHandler, notFoundHandler };
