const { ValidationError, UserExistsError, DatabaseError, AuthenticationError } = require('../utils/errors');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

/**
 * Centralized error handling middleware
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  // Handle custom errors
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors
    });
  }

  if (error instanceof UserExistsError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  if (error instanceof DatabaseError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  if (error instanceof AuthenticationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  // Handle Mongoose validation errors
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: getLocalizedMessageFromRequest('error.validation.error', req),
      errors: validationErrors
    });
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: getLocalizedMessageFromRequest('error.invalid.id.format', req)
    });
  }

  // Handle duplicate key errors
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: getLocalizedMessageFromRequest('error.duplicate.field', req)
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: getLocalizedMessageFromRequest('error.server.error', req),
    error: process.env.NODE_ENV === 'development' ? error.message : getLocalizedMessageFromRequest('error.internal.server.error', req)
  });
};

module.exports = errorHandler; 